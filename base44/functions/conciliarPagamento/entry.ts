import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { erroSeguro, sucesso } from './_lib/erroSeguradoResponse.js';
import { obterCorrelationId, logar, logarErro } from './_lib/correlationId.js';
import { registrarAuditoria } from './_lib/auditoriaEvento.js';
import { comErroGlobal } from './_lib/middlewareErroGlobal.js';

/**
 * CONCILIAR PAGAMENTO: vincula transação bancária a pagamento de conta
 * 
 * 1. Busca conta a pagar
 * 2. Registra vinculação a transação bancária
 * 3. Marca como conciliada
 * 4. Registra auditoria
 */

const handler = comErroGlobal(async (req, correlationId) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      const { body, status } = erroSeguro('NAO_AUTORIZADO');
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', `${user.email} conciliando pagamento`);
    
    // 1. Parse payload
    const payload = await req.json();
    const {
      conta_id,
      transacao_bancaria_id,
      valor_transacao,
      observacao
    } = payload;
    
    if (!conta_id || !transacao_bancaria_id) {
      const { body, status } = erroSeguro('VALIDACAO', 'Conta e transação obrigatórias');
      return Response.json(body, { status });
    }
    
    // 2. Buscar conta
    const contas = await base44.entities.ContaFinanceira.filter({ id: conta_id });
    if (!contas || contas.length === 0) {
      const { body, status } = erroSeguro('RECURSO_NAO_ENCONTRADO', 'Conta não encontrada');
      return Response.json(body, { status });
    }
    
    const conta = contas[0];
    
    if (!['pago', 'parcial'].includes(conta.status)) {
      const { body, status } = erroSeguro(
        'ESTADO_INVALIDO',
        `Apenas contas pagas/parciais podem ser conciliadas. Status atual: ${conta.status}`
      );
      return Response.json(body, { status });
    }
    
    logar(correlationId, 'info', 'Conta validada', { status: conta.status });
    
    // 3. Validar valor (opcional)
    if (valor_transacao && Math.abs(valor_transacao - conta.valor_pago) > 0.01) {
      logar(correlationId, 'warn', 'Divergência de valor', {
        valor_conta: conta.valor_pago,
        valor_transacao
      });
    }
    
    // 4. Adicionar metadados de conciliação
    const contaAtualizada = {
      ...conta,
      conciliacao: {
        transacao_bancaria_id,
        data_conciliacao: new Date().toISOString(),
        usuario_conciliacao: user.email,
        valor_reconciliado: valor_transacao || conta.valor_pago,
        observacao: observacao || 'Conciliação automática'
      },
      status: 'pago' // Força status final
    };
    
    // 5. Atualizar conta
    await base44.asServiceRole.entities.ContaFinanceira.update(conta_id, contaAtualizada);
    logar(correlationId, 'info', 'Conta conciliada ✓');
    
    // 6. Registrar auditoria
    await registrarAuditoria(base44, {
      entidade: 'ContaFinanceira',
      entidadeId: conta_id,
      operacao: 'atualizar',
      obraId: conta.obra_id,
      usuarioId: user.email,
      funcao: 'conciliarPagamento',
      beforeData: conta,
      afterData: contaAtualizada,
      detalhes: {
        transacao_bancaria_id,
        valor_reconciliado: valor_transacao || conta.valor_pago,
        status_novo: 'pago',
        observacao
      }
    });
    
    logar(correlationId, 'info', 'Auditoria registrada ✓');
    
    return Response.json(
      sucesso(
        {
          conta: contaAtualizada,
          conciliacao: {
            transacao_id: transacao_bancaria_id,
            data: new Date().toISOString(),
            status: 'conciliada'
          }
        },
        'Pagamento conciliado com sucesso'
      ),
      { status: 200 }
    );
    
  } catch (error) {
    throw error;
  }
});

export default handler;