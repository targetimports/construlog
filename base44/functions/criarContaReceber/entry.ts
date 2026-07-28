import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.ts';
import { logAuditoria } from './_lib/logAuditoria.ts';

/**
 * Criar Conta a Receber com Validação Obrigatória de Obra
 * 
 * REGRA DE NEGÓCIO: Todas as contas a receber DEVEM ter obra_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: apenas diretor e financeiro podem criar contas
    const { user } = await requireRole(base44, ['diretor', 'financeiro']);

    const payload = await req.json();

    // VALIDAÇÃO CRÍTICA: obra_id é obrigatório
    if (!payload.obra_id) {
      return Response.json({
        error: 'obra_id é obrigatório para contas a receber',
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

    // Validar se obra existe (filter seguro — .get lança 500)
    const obras = await base44.asServiceRole.entities.Obra.filter({}).then(list => list.filter(o => o.id === payload.obra_id));
    if (!obras || obras.length === 0) {
      return Response.json({
        ok: false,
        error: 'Obra não encontrada',
        field: 'obra_id'
      }, { status: 404 });
    }

    // Criar conta com valores padrão seguros
    const novaConta = await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'receber',
      obra_id: payload.obra_id,
      descricao: payload.descricao,
      valor: payload.valor,
      data_vencimento: payload.data_vencimento,
      fornecedor_cliente: payload.fornecedor_cliente || '',
      cliente_id: payload.cliente_id || null,
      categoria: payload.categoria || 'outros',
      referencia_tipo: payload.referencia_tipo || null,
      referencia_id: payload.referencia_id || null,
      observacao: payload.observacao || null,
      status: 'pendente',
      valor_recebido: 0,
      historico_baixas: []
    });

    // Auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      entidade: 'ContaFinanceira',
      entidade_id: novaConta.id,
      acao: 'criar',
      modulo: 'financeiro',
      dados_novos: { tipo: 'receber', obra_id: payload.obra_id, valor: payload.valor },
      detalhes: `Conta a receber criada: ${payload.descricao}`,
      sucesso: true
    });

    return Response.json({
      ok: true,
      conta: novaConta,
      message: 'Conta a receber criada com sucesso'
    });

  } catch (error) {
    console.error('[ERROR] criarContaReceber:', error);
    return Response.json({
      error: error.message || 'Erro ao criar conta'
    }, { status: 500 });
  }
});