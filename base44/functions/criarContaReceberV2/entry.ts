import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // Validação via função centralizada
    const validacao = await base44.asServiceRole.functions.invoke('validarLancamentoFinanceiro', payload);
    
    if (!validacao.ok) {
      return Response.json({ error: validacao.error }, { status: validacao.status || 400 });
    }

    const dadosNormalizados = validacao.payload;

    // Criar ContaFinanceira com dados validados
    const conta = await base44.entities.ContaFinanceira.create({
      tipo: 'receber',
      descricao: dadosNormalizados.descricao,
      valor: dadosNormalizados.valor,
      data_vencimento: dadosNormalizados.data_vencimento,
      categoria: dadosNormalizados.categoria || 'outros',
      fornecedor_cliente: dadosNormalizados.fornecedor_cliente,
      forma_pagamento: dadosNormalizados.forma_pagamento || 'transferencia',
      obra_id: dadosNormalizados.obra_id,
      categoria_id: dadosNormalizados.categoria_id,
      centro_custo_id: dadosNormalizados.centro_custo_id,
      administrativo: dadosNormalizados.administrativo,
      observacao: dadosNormalizados.observacao,
      status: 'pendente'
    });

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'criar_conta_receber_v2',
      modulo: 'financeiro',
      entidade: 'ContaFinanceira',
      entidade_id: conta.id,
      dados_novos: conta,
      sucesso: true
    });

    return Response.json({ ok: true, conta_id: conta.id, conta });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});