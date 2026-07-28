import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { successResponse, errorResponse, internalErrorResponse } from './_shared/responseHandler.ts';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';
import { validarPagamento } from './_lib/validadorFinanceiro.js';

/**
 * PAGAR CONTA: ContaFinanceira(pagar) → atualiza status + registra pagamento
 * 
 * 1. Valida conta pode ser paga
 * 2. Registra pagamento no histórico
 * 3. Atualiza valor_pago e status
 * 4. Marca NF como paga (se vinculada)
 * 5. Registra auditoria
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Não autorizado', 401);
    }
    
    logar(correlationId, 'info', `${user.email} pagando conta`);
    
    // 1. Parse payload
    const payload = await req.json();
    const {
      conta_id,
      valor_pagamento,
      forma_pagamento,
      numero_comprovante,
      observacao
    } = payload;
    
    if (!conta_id || !valor_pagamento) {
      return errorResponse('BAD_REQUEST', 'Conta e valor obrigatórios', 400);
    }
    
    // 2. Buscar conta
    const contas = await base44.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contas || contas.length === 0) {
      return errorResponse('NOT_FOUND', 'Conta não encontrada', 404);
    }
    
    const conta = contas[0];
    logar(correlationId, 'info', 'Conta encontrada', {
      descricao: conta.descricao,
      valor: conta.valor,
      status: conta.status
    });
    
    // 3. Validar pagamento
    try {
      await validarPagamento(base44, conta, valor_pagamento);
    } catch (error) {
      logarErro(correlationId, error.code, error.message);
      return Response.json(error.body, { status: error.status });
    }
    
    // 4. Registrar pagamento no histórico
    const historico_baixas = conta.historico_baixas || [];
    historico_baixas.push({
      data: new Date().toISOString(),
      valor: valor_pagamento,
      forma_pagamento: forma_pagamento || 'transferencia',
      responsavel: user.email,
      numero_comprovante: numero_comprovante || null,
      observacao: observacao || 'Pagamento registrado'
    });
    
    // 5. Calcular novo status
    const valor_pago_novo = (conta.valor_pago || 0) + valor_pagamento;
    const valor_total = conta.valor;
    let novo_status = 'pago';
    
    if (valor_pago_novo < valor_total) {
      novo_status = 'parcial';
    } else if (valor_pago_novo > valor_total) {
      return errorResponse('INVALID_VALUE', 'Pagamento total excede valor da conta', 400);
    }
    
    // 6. Atualizar conta
    const contaAtualizada = {
      ...conta,
      valor_pago: valor_pago_novo,
      status: novo_status,
      data_pagamento: new Date().toISOString(),
      historico_baixas
    };
    
    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, contaAtualizada);
    logar(correlationId, 'info', `Conta atualizada: status=${novo_status}`);
    
    // 7. Marcar NF como paga (se vinculada)
    if (conta.referencia_tipo === 'nota_fiscal' && conta.referencia_id && novo_status === 'pago') {
      try {
        await base44.asServiceRole.entities.NotaFiscal.update(conta.referencia_id, {
          status: 'paga'
        });
        logar(correlationId, 'info', 'NF marcada como paga ✓');
      } catch (error) {
        logar(correlationId, 'warn', 'Erro ao marcar NF como paga (não crítico)');
      }
    }
    
    // 8. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'ContaFinanceira',
      entidadeId: conta_id,
      operacao: 'atualizar',
      obraId: conta.obra_id,
      usuarioId: user.email,
      funcao: 'pagarConta',
      beforeData: conta,
      afterData: contaAtualizada,
      detalhes: {
        valor_pago: valor_pagamento,
        novo_status,
        forma_pagamento,
        numero_comprovante,
        saldo_restante: valor_total - valor_pago_novo
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return successResponse({
      conta: contaAtualizada,
      pagamento: {
        valor: valor_pagamento,
        forma: forma_pagamento,
        comprovante: numero_comprovante
      },
      status_novo: novo_status,
      saldo_restante: valor_total - valor_pago_novo
    });
    
  } catch (error) {
    throw error;
  }
});

export default handler;