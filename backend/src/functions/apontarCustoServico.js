import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';
import {
  ORIGENS, ORIGENS_VALIDAS, carregarOrigem, servicosDaObra, totalApontado, r2, TOLERANCIA,
} from './custoServicoCore.js';

// Grava o rateio de UMA origem de custo entre os serviços do contrato.
//
// A chamada substitui o conjunto inteiro daquela origem (não acumula): a tela
// manda como a divisão deve ficar, e é assim que ela fica. Isso torna a operação
// idempotente — repetir o mesmo POST não duplica rateio — e faz a correção ser
// uma regravação simples, sem estorno.
//
// Mandar `rateios: []` limpa o apontamento e devolve o custo para "não apontado".

const num = (v) => Number(v) || 0;
const erro = (msg, status = 400) => Object.assign(new Error(msg), { status });

export default async function apontarCustoServico({ body, user }) {
  const { origem_tipo, origem_id, rateios } = body || {};

  if (!ORIGENS_VALIDAS.includes(origem_tipo)) {
    throw erro(`origem_tipo inválido. Aceitos: ${ORIGENS_VALIDAS.join(', ')}.`);
  }
  if (!origem_id) throw erro('origem_id obrigatório');
  if (!Array.isArray(rateios)) throw erro('rateios deve ser uma lista');

  const origem = await carregarOrigem(origem_tipo, origem_id);
  if (!origem) throw erro('Origem de custo não encontrada (ou não é uma despesa).', 404);
  if (!origem.obra_id) throw erro('Esta despesa não está vinculada a uma obra, então não há serviço a apontar.');

  const obra = (await store.filter('Obra', { id: origem.obra_id }))[0];
  if (!obra) throw erro('Obra da despesa não encontrada.', 404);
  if (!podeEditarObra(user, obra)) throw erro('Sem permissão para apontar custos desta obra.', 403);

  // Serviços válidos = itens do contrato ATIVO da obra. Apontar num item de
  // outra obra misturaria os desvios das duas.
  const { porId, versao } = await servicosDaObra(origem.obra_id);
  if (!versao) {
    throw erro('A obra ainda não tem contrato ativo — gere o contrato a partir do orçamento antes de apontar custos.');
  }

  // ── Validação das linhas ────────────────────────────────────────────────
  const limpas = [];
  const vistos = new Set();
  for (const [i, l] of rateios.entries()) {
    const linha = i + 1;
    const itemId = String(l?.contrato_item_id || '');
    const valor = r2(l?.valor);

    if (!itemId) throw erro(`Linha ${linha}: serviço não informado.`);
    if (!porId.has(itemId)) throw erro(`Linha ${linha}: o serviço informado não pertence a esta obra.`);
    if (vistos.has(itemId)) throw erro(`Linha ${linha}: o serviço aparece duas vezes — some os valores numa linha só.`);
    if (!(valor > 0)) throw erro(`Linha ${linha}: informe um valor maior que zero.`);
    vistos.add(itemId);

    const qtd = l?.quantidade == null || l.quantidade === '' ? null : num(l.quantidade);
    if (qtd != null && qtd < 0) throw erro(`Linha ${linha}: quantidade não pode ser negativa.`);

    limpas.push({
      contrato_item_id: itemId,
      valor,
      quantidade: qtd,
      observacao: String(l?.observacao || '').slice(0, 500) || null,
    });
  }

  // Não se aponta mais do que a despesa vale. Sem esta trava, duas classificações
  // parciais somariam mais que a nota e o "custo real" do relatório passaria o da
  // DRE — o relatório perderia a credibilidade justamente onde ela mais importa.
  const somaRateios = r2(limpas.reduce((s, l) => s + l.valor, 0));
  if (somaRateios > origem.valor + TOLERANCIA) {
    throw erro(
      `A soma dos rateios (${somaRateios.toFixed(2)}) passa o valor da despesa (${origem.valor.toFixed(2)}).`,
    );
  }

  // ── Gravação: substitui o conjunto da origem ────────────────────────────
  const { linhas: existentes } = await totalApontado(origem_tipo, origem_id);
  for (const e of existentes) {
    await store.delete('ApontamentoCustoServico', e.id).catch(() => {});
  }

  const criados = [];
  for (const l of limpas) {
    const item = porId.get(l.contrato_item_id);
    const rec = await store.create('ApontamentoCustoServico', {
      obra_id: origem.obra_id,
      empresa_id: obra.empresa_id || null,
      contrato_item_id: l.contrato_item_id,
      contrato_versao_id: versao.id,
      origem_tipo,
      origem_id,
      valor: l.valor,
      quantidade: l.quantidade,
      unidade: item?.unidade || null,
      // Guardados no apontamento porque são o EIXO do relatório e precisam
      // sobreviver a uma edição posterior da origem: se a conta mudar de mês,
      // o desvio já fechado daquele mês não pode se mexer sozinho.
      competencia: origem.competencia,
      categoria: origem.categoria_normalizada,
      realizado: origem.realizado,
      observacao: l.observacao,
      apontado_por: user?.email || null,
      apontado_em: new Date().toISOString(),
    }, user?.email || null);
    criados.push(rec);
  }

  // Mês já fechado? Avisa, mas não impede. Bloquear de imediato emperraria a
  // operação por nota atrasada, que é rotina em obra; o fechamento endurece
  // depois, quando a rotina estiver madura. O importante é que quem lançou
  // saiba que mexeu num período já analisado.
  let aviso = null;
  if (origem.competencia) {
    const fech = (await store.filter('FechamentoObra', { obra_id: origem.obra_id, competencia: origem.competencia }, undefined, 5)
      .catch(() => []))[0];
    if (fech && fech.status === 'fechado') {
      aviso = `A competência ${origem.competencia} já foi fechada em `
        + `${String(fech.fechado_em || '').slice(0, 10)}. O apontamento foi gravado, mas o retrato congelado do mês não muda — `
        + 'reabra a competência se o número precisa ser corrigido.';
    }
  }

  const naoApontado = r2(origem.valor - somaRateios);
  return {
    ok: true,
    aviso,
    origem: {
      tipo: origem_tipo,
      id: origem_id,
      descricao: origem.descricao,
      valor: origem.valor,
      realizado: origem.realizado,
      rotulo: ORIGENS[origem_tipo].rotulo,
    },
    obra_id: origem.obra_id,
    rateios: criados.length,
    valor_apontado: somaRateios,
    valor_nao_apontado: naoApontado,
    totalmente_apontado: naoApontado <= TOLERANCIA,
  };
}
