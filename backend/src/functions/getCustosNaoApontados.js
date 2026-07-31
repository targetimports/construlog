import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';
import {
  ORIGENS, prepararOrigens, normalizarCategoria, competenciaDe, r2, TOLERANCIA,
} from './custoServicoCore.js';

// O "Diário de Entradas" da obra: tudo que virou custo e ainda não foi dito a
// que serviço pertence.
//
// Existe porque ninguém acerta a classificação no ato do lançamento. Quem paga a
// nota no financeiro raramente sabe se o cimento foi para a fundação ou para o
// contrapiso; quem sabe é a obra, depois. Sem uma fila de pendências, o
// apontamento só aconteceria no momento do lançamento — e não aconteceria.
//
// Mostra também o PARCIALMENTE apontado: uma nota de R$ 50 mil com R$ 30 mil
// classificados tem R$ 20 mil invisíveis, que é justamente o caso que passa
// despercebido quando a lista só tem "apontado / não apontado".

const num = (v) => Number(v) || 0;

export default async function getCustosNaoApontados({ body, user }) {
  const {
    obra_id,
    categoria = null,        // 'material' | 'mao_de_obra' | ... (normalizada)
    competencia = null,      // 'YYYY-MM'
    incluir_pendentes = true, // conta a pagar ainda não paga = custo comprometido
    incluir_parciais = true,
    limite = 500,
  } = body || {};

  if (!obra_id) throw Object.assign(new Error('obra_id é obrigatório'), { status: 400 });
  if (!(await podeAcessarObra(user, obra_id))) {
    throw Object.assign(new Error('Sem acesso a esta obra.'), { status: 403 });
  }

  // Índice do que já foi apontado, por origem. Uma consulta só: a lista pode ter
  // centenas de origens e não vale uma ida ao banco por linha.
  const apontamentos = await store.filter('ApontamentoCustoServico', { obra_id }, undefined, 50000).catch(() => []);
  const apontadoPorOrigem = new Map();
  for (const a of apontamentos) {
    const k = `${a.origem_tipo}:${a.origem_id}`;
    apontadoPorOrigem.set(k, r2(num(apontadoPorOrigem.get(k)) + num(a.valor)));
  }

  const linhas = [];
  const totais = { origens: 0, valor_total: 0, valor_apontado: 0, valor_nao_apontado: 0 };

  // Mão de obra mensalista tem custo DERIVADO da folha; o contexto traz esse
  // cálculo pronto para não refazê-lo a cada linha.
  const ctx = await prepararOrigens(obra_id);

  for (const [tipo, desc] of Object.entries(ORIGENS)) {
    const registros = await store.filter(desc.entidade, { obra_id }, '-created_date', 20000).catch(() => []);

    for (const reg of registros) {
      if (!desc.aceita(reg)) continue;

      const valor = r2(desc.valor(reg, ctx[tipo]));
      if (valor <= 0) continue;

      const realizado = !!desc.realizado(reg);
      if (!realizado && !incluir_pendentes) continue;

      const cat = normalizarCategoria(desc.categoria(reg));
      if (categoria && cat !== categoria) continue;

      const data = desc.data(reg);
      const comp = competenciaDe(data);
      if (competencia && comp !== competencia) continue;

      const apontado = num(apontadoPorOrigem.get(`${tipo}:${reg.id}`));
      const naoApontado = r2(valor - apontado);

      // Nada a fazer: já está inteiramente classificado.
      if (naoApontado <= TOLERANCIA) continue;
      if (apontado > 0 && !incluir_parciais) continue;

      linhas.push({
        origem_tipo: tipo,
        origem_id: reg.id,
        origem_rotulo: desc.rotulo,
        descricao: desc.descricao(reg),
        fornecedor: reg.fornecedor_cliente || reg.fornecedor_nome || null,
        categoria: cat,
        categoria_original: desc.categoria(reg),
        data,
        competencia: comp,
        valor,
        valor_apontado: r2(apontado),
        valor_nao_apontado: naoApontado,
        parcial: apontado > 0,
        // Falso = ainda não é custo na DRE; é compromisso assumido. A tela
        // separa os dois porque a leitura gerencial é diferente.
        realizado,
      });

      totais.origens += 1;
      totais.valor_total = r2(totais.valor_total + valor);
      totais.valor_apontado = r2(totais.valor_apontado + apontado);
      totais.valor_nao_apontado = r2(totais.valor_nao_apontado + naoApontado);
    }
  }

  // Maior primeiro: é onde o apontamento rende mais (regra 80/20 do manual —
  // classificar as dez maiores notas explica quase todo o custo da obra).
  linhas.sort((a, b) => b.valor_nao_apontado - a.valor_nao_apontado);

  const cortadas = Math.max(0, linhas.length - limite);
  return {
    ok: true,
    obra_id,
    totais,
    truncado: cortadas > 0,
    ocultas: cortadas,
    linhas: linhas.slice(0, limite),
  };
}
