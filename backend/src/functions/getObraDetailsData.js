import { store } from '../entityStore.js';
import { podeAcessarObra } from '../escopoObra.js';

// Porte de getObraDetailsData: agrega dados da obra para a tela de detalhes.
export default async function getObraDetailsData({ body, user }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  // 1. Obra (por id ou por codigo)
  let obras = [];
  try { obras = await store.filter('Obra', { id: obra_id }) || []; } catch (_) { /* id inválido */ }
  if (!obras || obras.length === 0) obras = await store.filter('Obra', { codigo: obra_id }) || [];
  const obra = obras?.[0] || null;
  if (!obra) throw Object.assign(new Error('Obra não encontrada'), { status: 404 });
  if (!(await podeAcessarObra(user, obra.id))) throw Object.assign(new Error('Sem acesso a esta obra (outra empresa)'), { status: 403 });
  const realObraId = obra.id;

  // 2. Orçamento
  const orcamentos = (await store.filter('Orcamento', { obra_id: realObraId })) || [];
  const orcamentoAtivo = orcamentos.find((o) => o.status === 'vigente' || o.status === 'aprovado') || orcamentos[0] || null;
  let itensOrcamento = [];
  if (orcamentoAtivo) itensOrcamento = (await store.filter('ItemOrcamento', { orcamento_id: orcamentoAtivo.id })) || [];

  const somaItens = itensOrcamento.reduce((s, i) => s + (i.valor_total || i.custo_total || 0), 0);
  const valorOrcado =
    (obra.total_final_orcamento > 0 ? obra.total_final_orcamento : null) ??
    (obra.total_orcamento > 0 ? obra.total_orcamento : null) ??
    (obra.valor_orcado > 0 ? obra.valor_orcado : null) ??
    (orcamentoAtivo?.valor_total > 0 ? orcamentoAtivo.valor_total : null) ??
    (somaItens > 0 ? somaItens : 0);

  const resumoOrcamento = {
    hasOrcamento: !!orcamentoAtivo,
    orcamento_id: orcamentoAtivo?.id || null,
    versao: orcamentoAtivo?.versao || null,
    status: orcamentoAtivo?.status || null,
    total_orcado: valorOrcado,
    total_itens: itensOrcamento.length,
    valor_realizado: obra.valor_realizado || 0,
    percentual_consumido: valorOrcado > 0 ? ((obra.valor_realizado || 0) / valorOrcado * 100) : 0,
  };

  // 3. Cronograma
  let cronogramaItems = [];
  let marcosLegados = [];
  try { cronogramaItems = (await store.filter('CronogramaItem', { obraId: realObraId })) || []; } catch (_) { /* noop */ }
  try { marcosLegados = (await store.filter('MarcoObra', { obra_id: realObraId })) || []; } catch (_) { /* noop */ }

  const totalAtividades = cronogramaItems.length > 0 ? cronogramaItems.length : marcosLegados.length;
  const atividadesConcluidas = cronogramaItems.length > 0
    ? cronogramaItems.filter((i) => i.status === 'Concluído' || i.percentualConcluido >= 100).length
    : marcosLegados.filter((m) => m.status === 'concluido').length;
  const progressoGeral = totalAtividades > 0 ? Math.round((atividadesConcluidas / totalAtividades) * 100) : 0;

  const resumoCronograma = {
    hasData: totalAtividades > 0,
    total_atividades: totalAtividades,
    concluidas: atividadesConcluidas,
    em_andamento: cronogramaItems.length > 0
      ? cronogramaItems.filter((i) => i.status === 'Em andamento').length
      : marcosLegados.filter((m) => m.status === 'em_andamento').length,
    progresso_geral: progressoGeral,
    data_inicio: obra.data_inicio || null,
    data_prevista_fim: obra.data_prevista_fim || null,
  };

  // 4. Financeiro
  let contas = [];
  try { contas = (await store.filter('ContaFinanceira', { obra_id: realObraId })) || []; } catch (_) { /* noop */ }
  const receitas = contas.filter((c) => c.tipo === 'receber').reduce((a, c) => a + (c.valor || 0), 0);
  const despesas = contas.filter((c) => c.tipo === 'pagar').reduce((a, c) => a + (c.valor || 0), 0);
  const receitasRecebidas = contas.filter((c) => c.tipo === 'receber' && c.status === 'pago').reduce((a, c) => a + (c.valor_recebido || c.valor || 0), 0);
  const despesasPagas = contas.filter((c) => c.tipo === 'pagar' && c.status === 'pago').reduce((a, c) => a + (c.valor_pago || c.valor || 0), 0);

  const resumoFinanceiro = {
    hasData: contas.length > 0,
    total_receitas: receitas,
    total_despesas: despesas,
    saldo: receitas - despesas,
    receitas_recebidas: receitasRecebidas,
    despesas_pagas: despesasPagas,
    percentual_consumido_orcamento: valorOrcado > 0 ? (despesas / valorOrcado * 100) : 0,
    qtd_contas_pagar: contas.filter((c) => c.tipo === 'pagar').length,
    qtd_contas_receber: contas.filter((c) => c.tipo === 'receber').length,
  };

  // 5. Suprimentos
  let requisicoes = [];
  let documentos = [];
  try { requisicoes = (await store.filter('RequisicaoCompra', { obra_id: realObraId })) || []; } catch (_) { /* noop */ }
  try { documentos = (await store.filter('AnexoObra', { obra_id: realObraId })) || []; } catch (_) { /* noop */ }
  const contagens = {
    requisicoes: requisicoes.length,
    requisicoes_pendentes: requisicoes.filter((r) => r.status === 'aguardando_aprovacao' || r.status === 'aberta').length,
    documentos: documentos.length,
  };

  return { obra, resumoOrcamento, resumoCronograma, resumoFinanceiro, contagens };
}
