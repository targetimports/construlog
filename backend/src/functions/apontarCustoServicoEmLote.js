import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import {
  ORIGENS, ORIGENS_VALIDAS, prepararOrigens, normalizarCategoria, competenciaDe,
  servicosDaObra, r2, TOLERANCIA,
} from './custoServicoCore.js';

// APONTAR MUITAS DESPESAS A UM SERVIÇO DE UMA VEZ.
//
// Existe por causa da mão de obra. Cada dia de cada pessoa é um registro do
// Ponto: uma obra com cinquenta trabalhadores produz mais de mil lançamentos por
// mês, de duzentos reais cada. Classificar um a um é trabalho que ninguém faz —
// e apontamento que não acontece devolve relatório vazio.
//
// O lote acompanha como a obra realmente pensa: "a equipe de maio inteira foi
// para a fundação". Um filtro (categoria, competência) recorta o conjunto, e o
// conjunto vai para um serviço.
//
// CADA ORIGEM CONTINUA SENDO UMA LINHA de apontamento — o lote é só a porta de
// entrada. Assim a correção posterior de um dia específico continua possível, e
// a trilha por documento não se perde.
//
// APONTA O SALDO, não o valor cheio: se parte da despesa já foi classificada em
// outro serviço, o lote completa o que falta em vez de estourar a trava.

const num = (v) => Number(v) || 0;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

export default async function apontarCustoServicoEmLote({ body, user }) {
  const {
    obra_id,
    contrato_item_id,
    origens,                 // [{ tipo, id }] — explícito
    filtro,                  // { categoria, competencia, origem_tipo } — ou por filtro
    observacao,
    limite = 5000,
  } = body || {};

  if (!obra_id) throw erro('obra_id é obrigatório');
  if (!contrato_item_id) throw erro('Escolha o serviço que vai receber o custo.');

  const obra = (await store.filter('Obra', { id: obra_id }))[0];
  if (!obra) throw erro('Obra não encontrada.', 404);
  if (!podeEditarObra(user, obra)) throw erro('Sem permissão para apontar custos desta obra.', 403);

  const { porId, versao } = await servicosDaObra(obra_id);
  if (!versao) throw erro('A obra não tem contrato ativo.');
  if (!porId.has(String(contrato_item_id))) throw erro('O serviço informado não pertence a esta obra.');
  const item = porId.get(String(contrato_item_id));

  // Quanto cada origem já tem apontado — para o lote completar o saldo.
  const jaApontado = new Map();
  for (const a of await store.filter('ApontamentoCustoServico', { obra_id }, undefined, 50000).catch(() => [])) {
    const k = `${a.origem_tipo}:${a.origem_id}`;
    jaApontado.set(k, r2(num(jaApontado.get(k)) + num(a.valor)));
  }

  const ctx = await prepararOrigens(obra_id);

  // Monta o conjunto: ou a lista explícita, ou tudo o que casa com o filtro.
  const alvos = [];
  const querido = new Set((origens || []).map((o) => `${o.tipo}:${o.id}`));
  const usarFiltro = !origens || origens.length === 0;
  if (usarFiltro && !filtro) throw erro('Informe as despesas ou um filtro.');

  for (const [tipo, desc] of Object.entries(ORIGENS)) {
    if (usarFiltro && filtro?.origem_tipo && filtro.origem_tipo !== tipo) continue;
    if (!usarFiltro && !ORIGENS_VALIDAS.includes(tipo)) continue;

    const registros = await store.filter(desc.entidade, { obra_id }, '-created_date', 20000).catch(() => []);
    for (const reg of registros) {
      const chave = `${tipo}:${reg.id}`;
      if (!usarFiltro && !querido.has(chave)) continue;
      if (!desc.aceita(reg)) continue;

      const valor = r2(desc.valor(reg, ctx[tipo]));
      if (valor <= 0) continue;

      if (usarFiltro) {
        if (filtro.categoria && normalizarCategoria(desc.categoria(reg)) !== filtro.categoria) continue;
        if (filtro.competencia && competenciaDe(desc.data(reg)) !== filtro.competencia) continue;
        // Só o que já é custo: compromisso ainda não pago fica de fora do lote,
        // porque o valor dele ainda pode mudar.
        if (filtro.somente_realizado !== false && !desc.realizado(reg)) continue;
      }

      const saldo = r2(valor - num(jaApontado.get(chave)));
      if (saldo <= TOLERANCIA) continue;

      alvos.push({
        tipo, id: reg.id, saldo,
        competencia: competenciaDe(desc.data(reg)),
        categoria: normalizarCategoria(desc.categoria(reg)),
        realizado: !!desc.realizado(reg),
      });
      if (alvos.length >= limite) break;
    }
    if (alvos.length >= limite) break;
  }

  if (alvos.length === 0) {
    return { ok: true, apontadas: 0, valor_total: 0, mensagem: 'Nada a apontar com esse recorte.' };
  }

  let total = 0;
  const agora = new Date().toISOString();
  for (const a of alvos) {
    await store.create('ApontamentoCustoServico', {
      obra_id,
      empresa_id: obra.empresa_id || null,
      contrato_item_id,
      contrato_versao_id: versao.id,
      origem_tipo: a.tipo,
      origem_id: a.id,
      valor: a.saldo,
      quantidade: null,
      unidade: item?.unidade || null,
      competencia: a.competencia,
      categoria: a.categoria,
      realizado: a.realizado,
      observacao: String(observacao || '').slice(0, 500) || null,
      apontado_por: user?.email || null,
      apontado_em: agora,
    }, user?.email || null);
    total = r2(total + a.saldo);
  }

  // Mesma regra do apontamento individual: competência já fechada não impede o
  // lançamento, mas quem lançou precisa saber que mexeu num período analisado.
  // Sem isto, o lote era justamente o caminho por onde se alterava um mês
  // fechado em silêncio — e em volume.
  const competenciasFechadas = new Set();
  const comps = [...new Set(alvos.map((a) => a.competencia).filter(Boolean))];
  for (const c of comps) {
    const f = (await store.filter('FechamentoObra', { obra_id, competencia: c }, undefined, 5).catch(() => []))[0];
    if (f && f.status === 'fechado') competenciasFechadas.add(c);
  }

  return {
    ok: true,
    apontadas: alvos.length,
    valor_total: total,
    servico: item?.descricao || item?.item_label || null,
    aviso: competenciasFechadas.size
      ? `Parte do lote caiu em competência já fechada (${[...competenciasFechadas].sort().join(', ')}). `
        + 'Os apontamentos foram gravados, mas o retrato congelado desses meses não muda — '
        + 'reabra a competência se os números precisam ser corrigidos.'
      : null,
  };
}
