import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { requireRole } from './_lib/requireRole.ts';
import { logAuditoria } from './_lib/logAuditoria.ts';

/**
 * Dar Baixa em Conta a Receber
 * 
 * Permite baixa parcial ou total com auditoria completa
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // RBAC: apenas diretor e financeiro podem dar baixa
    const { user } = await requireRole(base44, ['diretor', 'financeiro']);

    const {
      conta_id,
      data_pagamento,
      valor_recebido,
      forma_pagamento,
      observacao = ''
    } = await req.json();

    // VALIDAÇÕES
    if (!conta_id || !data_pagamento || !valor_recebido || !forma_pagamento) {
      return Response.json({
        error: 'Campos obrigatórios: conta_id, data_pagamento, valor_recebido, forma_pagamento'
      }, { status: 400 });
    }

    if (valor_recebido <= 0) {
      return Response.json({
        error: 'Valor recebido deve ser maior que zero'
      }, { status: 400 });
    }

    // Buscar conta
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({ id: conta_id });
    const conta = contas[0];

    if (!conta) {
      return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
    }

    if (conta.tipo !== 'receber') {
      return Response.json({
        error: 'Esta conta não é do tipo "receber"'
      }, { status: 422 });
    }

    // VALIDAÇÃO: conta deve ter obra_id
    if (!conta.obra_id) {
      return Response.json({
        error: 'Conta inválida: obra_id ausente. Use backend para corrigir.'
      }, { status: 422 });
    }

    // Calcular totais
    const valorTotalConta = conta.valor || 0;
    const valorJaRecebido = conta.valor_recebido || 0;
    const novoTotalRecebido = valorJaRecebido + valor_recebido;

    // Validar se não excede o total
    if (novoTotalRecebido > valorTotalConta) {
      return Response.json({
        error: `Valor recebido (${novoTotalRecebido.toFixed(2)}) excede o valor total da conta (${valorTotalConta.toFixed(2)})`
      }, { status: 422 });
    }

    // Determinar novo status
    let novoStatus;
    if (novoTotalRecebido >= valorTotalConta) {
      novoStatus = 'pago'; // Total recebido
    } else if (novoTotalRecebido > 0) {
      novoStatus = 'parcial'; // Parcialmente recebido
    } else {
      novoStatus = 'pendente';
    }

    // Criar registro de baixa no histórico
    const historicoBaixas = conta.historico_baixas || [];
    historicoBaixas.push({
      data: new Date().toISOString(),
      valor: valor_recebido,
      forma_pagamento,
      responsavel: user.email,
      observacao
    });

    // Atualizar conta
    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, {
      valor_recebido: novoTotalRecebido,
      status: novoStatus,
      data_pagamento: novoStatus === 'pago' ? data_pagamento : conta.data_pagamento,
      forma_pagamento,
      historico_baixas: historicoBaixas,
      observacao: observacao || conta.observacao
    });

    // Auditoria (util central)
    await logAuditoria(base44, {
      entidade_tipo: 'ContaFinanceira',
      entidade_id: conta_id,
      acao: 'BAIXA',
      resumo: `Baixa de R$ ${valor_recebido.toFixed(2)} via ${forma_pagamento}`,
      dados_anteriores: { valor_recebido: valorJaRecebido, status: conta.status },
      dados_novos: { valor_recebido: novoTotalRecebido, status: novoStatus, valor_baixa: valor_recebido },
      user_email: user.email,
      role: user.cargo,
      origem: 'ui',
      modulo: 'financeiro'
    });

    return Response.json({
      ok: true,
      conta_id,
      status_anterior: conta.status,
      status_novo: novoStatus,
      valor_recebido: valor_recebido,
      valor_total_recebido: novoTotalRecebido,
      valor_restante: valorTotalConta - novoTotalRecebido,
      message: novoStatus === 'pago' 
        ? 'Recebimento total confirmado' 
        : `Recebimento parcial registrado. Restante: R$ ${(valorTotalConta - novoTotalRecebido).toFixed(2)}`
    });

  } catch (error) {
    console.error('[ERROR] darBaixaRecebimento:', error);
    return Response.json({
      error: error.message || 'Erro ao processar baixa'
    }, { status: 500 });
  }
});