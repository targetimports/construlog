import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';

// Unifica eventos de todos os módulos de uma obra numa linha do tempo (mais recente primeiro).
export default async function getTimelineObra({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });

  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });
  if (!(await podeAcessarObra(user, obra_id))) throw Object.assign(new Error('Sem acesso a esta obra (outra empresa)'), { status: 403 });

  const [requisicoes, ocs, recebimentos, movimentos, nfs, contas, bms, receitas] = await Promise.all([
    store.filter('RequisicaoCompra', { obra_id }).catch(() => []),
    store.filter('OrdemCompra', { obra_id }).catch(() => []),
    store.filter('RecebimentoMaterial', { obra_id }).catch(() => []),
    store.filter('MovimentacaoEstoque', { obra_id }).catch(() => []),
    store.filter('NotaFiscal', { obra_id }).catch(() => []),
    store.filter('ContaFinanceira', { obra_id }).catch(() => []),
    store.filter('BM', { obra_id }).catch(() => []),
    store.filter('ReceitaObra', { obra_id }).catch(() => [])
  ]);

  const eventos = [];

  (requisicoes || []).forEach((r) => eventos.push({ data: r.data_solicitacao || r.created_date, modulo: 'compras', tipo: 'requisicao', acao: 'Requisição criada', numero: r.titulo, status: r.status, usuario: r.solicitante, id_item: r.id, valor: r.valor_total_estimado }));
  (ocs || []).forEach((oc) => {
    eventos.push({ data: oc.data_emissao || oc.created_date, modulo: 'compras', tipo: 'ordem_compra', acao: 'OC criada', numero: oc.numero, status: oc.status, usuario: oc.aprovado_por, id_item: oc.id, valor: oc.valor_total });
    if (oc.data_aprovacao) eventos.push({ data: oc.data_aprovacao, modulo: 'compras', tipo: 'ordem_compra', acao: 'OC aprovada', numero: oc.numero, status: 'aprovada', usuario: oc.aprovado_por, id_item: oc.id, valor: oc.valor_total });
  });
  (recebimentos || []).forEach((rec) => eventos.push({ data: rec.data_recebimento, modulo: 'estoque', tipo: 'recebimento', acao: 'Material recebido', numero: rec.numero_oc, status: rec.status_recebimento, usuario: rec.responsavel_almoxarife, id_item: rec.id }));
  (movimentos || []).forEach((mov) => eventos.push({ data: mov.data || mov.data_movimentacao, modulo: 'estoque', tipo: 'movimentacao', acao: mov.tipo || 'Movimentação', numero: mov.descricao_insumo, status: mov.tipo, usuario: mov.usuario_id || mov.responsavel, id_item: mov.id, valor: mov.valor_total }));
  (nfs || []).forEach((nf) => eventos.push({ data: nf.data || nf.data_emissao, modulo: 'financeiro', tipo: 'nota_fiscal', acao: 'Nota fiscal', numero: nf.numero_nf || nf.numero, status: nf.status, usuario: nf.created_by, id_item: nf.id, valor: nf.valor_bruto || nf.valor_total }));
  (contas || []).forEach((c) => {
    eventos.push({ data: c.created_date, modulo: 'financeiro', tipo: 'conta', acao: 'Conta criada', numero: c.nota_fiscal, status: c.status, usuario: c.created_by, id_item: c.id, valor: c.valor });
    if (c.data_pagamento) eventos.push({ data: c.data_pagamento, modulo: 'financeiro', tipo: 'pagamento', acao: 'Conta paga', status: 'pago', usuario: c.created_by, id_item: c.id, valor: c.valor_pago });
  });
  // Medição canônica = BM (via contrato_versao_id). Medicao/MedicaoContrato são legado.
  (bms || []).forEach((bm) => {
    eventos.push({ data: bm.data_medicao || bm.periodo_fim || bm.created_date, modulo: 'medicoes', tipo: 'medicao', acao: `BM ${bm.numero || ''} criada`.trim(), numero: bm.numero, status: bm.status, usuario: bm.criado_por || bm.created_by, id_item: bm.id, valor: bm.total_periodo });
    if (bm.data_aprovacao) eventos.push({ data: bm.data_aprovacao, modulo: 'medicoes', tipo: 'medicao', acao: `BM ${bm.numero || ''} aprovada`.trim(), numero: bm.numero, status: 'APROVADA', usuario: bm.aprovada_por, id_item: bm.id, valor: bm.total_periodo });
  });
  (receitas || []).forEach((rec) => eventos.push({ data: rec.data_emissao, modulo: 'financeiro', tipo: 'receita', acao: 'Receita', numero: rec.numero_nf_saida, status: rec.status, usuario: rec.created_by, id_item: rec.id, valor: rec.valor_liquido }));

  eventos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

  // Retorno "plano": o dispatcher /functions/:name já embrulha em { data }.
  // (Antes vinha { ok, data:{eventos} }, gerando data.data.eventos no front.)
  return { eventos, total: eventos.length };
}
