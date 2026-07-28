import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TIMELINE: Unifica eventos de todos os módulos por obra
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ ok: false, code: 'NAO_AUTORIZADO', message: 'Login necessário' }, { status: 401 });
    }
    
    const payload = await req.json();
    const { obra_id } = payload;
    
    if (!obra_id) {
      return Response.json({ ok: false, code: 'OBRA_REQUIRED', message: 'obra_id obrigatório' }, { status: 400 });
    }
    
    const eventos = [];
    
    // Buscar eventos de cada módulo em paralelo
    const [requisicoes, ocs, recebimentos, movimentos, nfs, contas, medicoes, receitas] = await Promise.all([
      base44.entities.RequisicaoCompra.filter({ obra_id }).catch(() => []),
      base44.entities.OrdemCompra.filter({ obra_id }).catch(() => []),
      base44.entities.RecebimentoMaterial.filter({ obra_id }).catch(() => []),
      base44.entities.MovimentacaoEstoque.filter({ obra_id }).catch(() => []),
      base44.entities.NotaFiscal.filter({ obra_id }).catch(() => []),
      base44.entities.ContaFinanceira.filter({ obra_id }).catch(() => []),
      base44.entities.Medicao.filter({ obra_id }).catch(() => []),
      base44.entities.ReceitaObra.filter({ obra_id }).catch(() => [])
    ]);
    
    (requisicoes || []).forEach(r => eventos.push({ data: r.data_solicitacao || r.created_date, modulo: 'compras', tipo: 'requisicao', acao: 'Requisição criada', numero: r.titulo, status: r.status, usuario: r.solicitante, id_item: r.id, valor: r.valor_total_estimado }));
    (ocs || []).forEach(oc => {
      eventos.push({ data: oc.data_emissao || oc.created_date, modulo: 'compras', tipo: 'ordem_compra', acao: 'OC criada', numero: oc.numero, status: oc.status, usuario: oc.aprovado_por, id_item: oc.id, valor: oc.valor_total });
      if (oc.data_aprovacao) eventos.push({ data: oc.data_aprovacao, modulo: 'compras', tipo: 'ordem_compra', acao: 'OC aprovada', numero: oc.numero, status: 'aprovada', usuario: oc.aprovado_por, id_item: oc.id, valor: oc.valor_total });
    });
    (recebimentos || []).forEach(rec => eventos.push({ data: rec.data_recebimento, modulo: 'estoque', tipo: 'recebimento', acao: 'Material recebido', numero: rec.numero_oc, status: rec.status_recebimento, usuario: rec.responsavel_almoxarife, id_item: rec.id }));
    (movimentos || []).forEach(mov => eventos.push({ data: mov.data, modulo: 'estoque', tipo: 'movimentacao', acao: mov.tipo || 'Movimentação', numero: mov.descricao_insumo, status: mov.tipo, usuario: mov.usuario_id, id_item: mov.id, valor: mov.valor_total }));
    (nfs || []).forEach(nf => eventos.push({ data: nf.data, modulo: 'financeiro', tipo: 'nota_fiscal', acao: 'Nota fiscal', numero: nf.numero_nf, status: nf.status, usuario: nf.created_by, id_item: nf.id, valor: nf.valor_bruto }));
    (contas || []).forEach(c => {
      eventos.push({ data: c.created_date, modulo: 'financeiro', tipo: 'conta', acao: 'Conta criada', numero: c.nota_fiscal, status: c.status, usuario: c.created_by, id_item: c.id, valor: c.valor });
      if (c.data_pagamento) eventos.push({ data: c.data_pagamento, modulo: 'financeiro', tipo: 'pagamento', acao: 'Conta paga', status: 'pago', usuario: c.created_by, id_item: c.id, valor: c.valor_pago });
    });
    (medicoes || []).forEach(med => {
      eventos.push({ data: med.data_medicao, modulo: 'medicoes', tipo: 'medicao', acao: 'Medição criada', numero: med.numero, status: med.status, usuario: med.responsavel_email, id_item: med.id, valor: med.valor_total_realizado });
      if (med.data_aprovacao) eventos.push({ data: med.data_aprovacao, modulo: 'medicoes', tipo: 'medicao', acao: 'Medição aprovada', numero: med.numero, status: 'aprovada', usuario: med.aprovado_por, id_item: med.id, valor: med.valor_total_realizado });
    });
    (receitas || []).forEach(rec => eventos.push({ data: rec.data_emissao, modulo: 'financeiro', tipo: 'receita', acao: 'Receita', numero: rec.numero_nf_saida, status: rec.status, usuario: rec.created_by, id_item: rec.id, valor: rec.valor_liquido }));
    
    eventos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
    
    return Response.json({ ok: true, data: { eventos, total: eventos.length } });
  } catch (error) {
    console.error('[getTimelineObra] erro:', error?.message);
    return Response.json({ ok: false, code: 'ERRO_INTERNO', message: 'Erro ao carregar timeline' }, { status: 500 });
  }
});