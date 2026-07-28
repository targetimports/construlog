import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Suporta chamada direta (requisicao_id + novo_status)
    // e automação de entidade ({ event, data, old_data })
    let req_data, novo_status;

    if (payload.event && payload.data) {
      // Chamada via automação de entidade
      req_data = payload.data;
      // Se payload_too_large, buscar manualmente
      if (!req_data && payload.event?.entity_id) {
        req_data = await base44.asServiceRole.entities.RequisicaoCompra.get(payload.event.entity_id);
      }
      novo_status = req_data?.status;
    } else {
      // Chamada direta (manual/frontend)
      const { requisicao_id, novo_status: ns } = payload;
      novo_status = ns;
      if (!requisicao_id || !novo_status) {
        return Response.json({ error: 'requisicao_id e novo_status obrigatórios' }, { status: 400 });
      }
      const found = await base44.asServiceRole.entities.RequisicaoCompra.filter({ id: requisicao_id });
      req_data = found?.[0];
    }

    if (!req_data) {
      return Response.json({ error: 'Requisição não encontrada' }, { status: 404 });
    }

    // Gerar conta quando requisição é APROVADA
    if (novo_status === 'aprovada') {
      // Criar conta a pagar (fornecedor não pagou ainda)
      await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: `Requisição Compra #${req_data.id.substring(0, 8)} - ${req_data.titulo || 'Sem título'}`,
        valor: req_data.valor_total_estimado || 0,
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        obra_id: req_data.obra_id || null,
        categoria: 'material',
        fornecedor_cliente: 'A definir',
        centro_custo: req_data.obra_id || 'geral',
        observacao: `Auto-gerado de Requisição ${req_data.id.substring(0, 8)}`
      });
    }

    // Gerar conta quando requisição é RECEBIDA
    if (novo_status === 'recebida') {
      // Criar conta a pagar com data de vencimento real
      await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'pagar',
        descricao: `Recebimento Requisição #${req_data.id.substring(0, 8)} - Pagar Fornecedor`,
        valor: req_data.valor_total_estimado || 0,
        data_vencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pendente',
        obra_id: req_data.obra_id || null,
        categoria: 'material',
        fornecedor_cliente: 'A definir',
        centro_custo: req_data.obra_id || 'geral',
        observacao: `Auto-gerado de Recebimento Requisição ${req_data.id.substring(0, 8)}`
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Conta financeira gerada automaticamente'
    });

  } catch (error) {
    console.error('Erro ao gerar conta financeira:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});