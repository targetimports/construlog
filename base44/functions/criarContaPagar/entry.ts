import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.js';
import { logAuditoria } from './_lib/logAuditoria.js';

/**
 * Criar Conta a Pagar com Validação Obrigatória de Obra
 * 
 * REGRA DE NEGÓCIO: Todas as contas a pagar DEVEM ter obra_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: apenas diretor e financeiro podem criar contas a pagar
    const { user } = await requireRole(base44, ['diretor', 'financeiro']);

    const payload = await req.json();

    // VALIDAÇÃO CRÍTICA: obra_id é obrigatório
    if (!payload.obra_id) {
      return Response.json({
        error: 'obra_id é obrigatório para contas a pagar',
        field: 'obra_id'
      }, { status: 400 });
    }

    // Validar campos obrigatórios básicos
    if (!payload.descricao || !payload.valor || !payload.data_vencimento) {
      return Response.json({
        error: 'Campos obrigatórios: descricao, valor, data_vencimento, obra_id'
      }, { status: 400 });
    }

    if (payload.valor <= 0) {
      return Response.json({
        error: 'Valor deve ser maior que zero'
      }, { status: 400 });
    }

    // Validar se obra existe
    const obras = await base44.asServiceRole.entities.Obra.filter({ id: payload.obra_id });
    if (!obras || obras.length === 0) {
      return Response.json({
        error: 'Obra não encontrada',
        field: 'obra_id'
      }, { status: 404 });
    }

    // Criar conta a pagar
    const novaConta = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'pagar',
      obra_id: payload.obra_id,
      descricao: payload.descricao,
      valor: payload.valor,
      data_vencimento: payload.data_vencimento,
      fornecedor_cliente: payload.fornecedor_cliente || '',
      categoria: payload.categoria || 'outros',
      referencia_tipo: payload.referencia_tipo || null,
      referencia_id: payload.referencia_id || null,
      observacao: payload.observacao || null,
      nota_fiscal: payload.nota_fiscal || null,
      forma_pagamento: payload.forma_pagamento || null,
      centro_custo: payload.centro_custo || null,
      status: 'pendente'
    });

    // Auditoria (util central)
    await logAuditoria(base44, {
      entidade_tipo: 'ContaFinanceira',
      entidade_id: novaConta.id,
      acao: 'CREATE',
      resumo: `Conta a pagar criada: ${payload.descricao}`,
      dados_novos: { tipo: 'pagar', obra_id: payload.obra_id, valor: payload.valor, categoria: payload.categoria },
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'financeiro'
    });

    return Response.json({
      ok: true,
      conta: novaConta,
      message: 'Conta a pagar criada com sucesso'
    });

  } catch (error) {
    console.error('[ERROR] criarContaPagar:', error);
    return Response.json({
      error: error.message || 'Erro ao criar conta'
    }, { status: 500 });
  }
});