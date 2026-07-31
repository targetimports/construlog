import { store } from '../entityStore.js';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Porte de gerarContratoDoOrcamento: cria uma ContratoVersao ATIVA + ContratoItem
// a partir do orçamento da obra. É o pré-requisito para criar Boletins de Medição (BM).
export default async function gerarContratoDoOrcamento({ body, user }) {
  const { obra_id } = body || {};
  if (!obra_id) throw Object.assign(new Error('obra_id obrigatório'), { status: 400 });

  const ativas = (await store.filter('ContratoVersao', { obra_id, status: 'ATIVA' })) || [];
  if (ativas.length > 0) {
    return { ok: true, message: 'Já existe um contrato ativo para esta obra.', contrato_versao_id: ativas[0].id };
  }

  const orcamentos = (await store.filter('Orcamento', { obra_id })) || [];
  const orc = orcamentos.find((o) => o.status === 'vigente' || o.status === 'aprovado') || orcamentos[0];
  if (!orc) throw Object.assign(new Error('Nenhum orçamento encontrado para a obra.'), { status: 400 });

  const itens = (await store.filter('ItemOrcamento', { orcamento_id: orc.id })) || [];
  if (itens.length === 0) throw Object.assign(new Error('O orçamento não possui itens.'), { status: 400 });

  const totalContrato = itens.reduce((s, it) => s + (Number(it.valor_total) || 0), 0);

  // CUSTO PREVISTO — a linha-base. O contrato congela, junto com o preço de
  // venda, o custo que o orçamento previa para cada serviço. É contra ESTE
  // número que o custo real vai ser comparado, e não contra o orçamento, que
  // segue editável: sem congelar, quem edita o orçamento apaga o próprio desvio
  // e a obra parece sempre no rumo.
  const obra = (await store.filter('Obra', { id: obra_id }))[0] || {};
  const bdiObra = Number(obra.bdi_percentual) || 0;
  const custoDoItem = (it, precoVenda) => {
    const c = Number(it.custo_unitario);
    // O orçamento tem custo próprio e ele é menor que a venda? É o caso normal.
    if (c > 0 && c < precoVenda * 1.0001) return { valor: c, origem: 'orcamento' };
    // Custo igual à venda (importação antiga) ou ausente: deriva do BDI da obra.
    if (bdiObra > 0 && precoVenda > 0) {
      return { valor: r2(precoVenda / (1 + bdiObra / 100)), origem: 'bdi_obra' };
    }
    return { valor: 0, origem: 'indisponivel' };
  };
  let totalCustoPrevisto = 0;

  const todasVersoes = (await store.filter('ContratoVersao', { obra_id })) || [];
  const numeroVersao = todasVersoes.reduce((m, v) => Math.max(m, Number(v.numero_versao) || 0), 0) + 1;

  const versao = await store.create('ContratoVersao', {
    obra_id,
    orcamento_id: orc.id,
    numero_versao: numeroVersao,
    status: 'ATIVA',
    total_contrato: r2(totalContrato),
    origem: 'orcamento',
    data_criacao: new Date().toISOString(),
  }, user?.email || null);

  let ordem = 0;
  for (const it of itens) {
    ordem += 1;
    const qtd = Number(it.quantidade) || 0;
    // total do item = valor_total da planilha (já com BDI). O preço unitário do
    // contrato é derivado de total/qtd para que qtd × preço == total (consistência
    // do motor de cálculo da medição).
    const total = Number(it.valor_total) || r2(qtd * (Number(it.valor_unitario) || Number(it.custo_unitario) || 0));
    const preco = qtd > 0 ? r2(total / qtd) : (Number(it.valor_unitario) || Number(it.custo_unitario) || 0);
    const etapa = it.etapa || 'Geral';
    const custo = custoDoItem(it, preco);
    totalCustoPrevisto += custo.valor * qtd;
    await store.create('ContratoItem', {
      contrato_versao_id: versao.id,
      obra_id,
      item_codigo: it.item_codigo || it.item || it.codigo || String(ordem),
      item_label: it.item_label || (it.descricao ? it.descricao.slice(0, 60) : `Item ${ordem}`),
      descricao: it.descricao || 'Item',
      grupo: etapa,
      etapa,
      etapa_codigo: it.etapa_codigo || '',
      trecho: it.trecho || '',
      unidade: it.unidade || 'un',
      qtd_contrato: qtd,
      preco_unit: preco,
      preco_unit_com_bdi: preco,
      preco_total: total,
      total,
      custo_unit_previsto: custo.valor,
      custo_total_previsto: r2(custo.valor * qtd),
      custo_origem: custo.origem,
      ordem,
    }, user?.email || null);
  }

  // Grava o custo previsto do contrato na própria versão: é o retrato da
  // linha-base no momento em que ela foi criada. Recalcular depois somando os
  // itens daria outro número se alguém editar um item — e aí não seria base.
  const margem = totalContrato > 0 ? ((totalContrato - totalCustoPrevisto) / totalContrato) * 100 : 0;
  await store.update('ContratoVersao', versao.id, {
    custo_previsto_total: r2(totalCustoPrevisto),
    margem_prevista_percentual: Math.round(margem * 100) / 100,
  }).catch(() => {});

  return {
    ok: true,
    message: `Contrato gerado com ${itens.length} item(ns).`,
    contrato_versao_id: versao.id,
    total_contrato: r2(totalContrato),
    custo_previsto_total: r2(totalCustoPrevisto),
    margem_prevista_percentual: Math.round(margem * 100) / 100,
  };
}
