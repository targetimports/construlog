/**
 * Fechar Período Financeiro
 * 
 * - Valida integridade (médições aprovadas, contas conciliadas, etc)
 * - Registra as validações executadas
 * - Bloqueia edições retroativas neste período
 * - Apenas admins podem fechar
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { successResponse, errorResponse, internalErrorResponse } from './_shared/responseHandler.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Usuário não autenticado', 401);
    }

    if (user.role !== 'admin') {
      return errorResponse('FORBIDDEN', 'Apenas admins podem fechar períodos', 403);
    }

    const payload = await req.json();
    const { competencia, empresa_id, obra_id, motivo_fechamento } = payload;

    if (!competencia || !empresa_id) {
      return errorResponse('INVALID_INPUT', 'competencia e empresa_id obrigatórios');
    }

    // ============================================================
    // 1. Verificar se já existe período aberto
    // ============================================================
    const periodosExistentes = await base44.asServiceRole.entities.PeriodoFechamento.filter({
      competencia,
      empresa_id,
      ...(obra_id && { obra_id })
    });

    if (periodosExistentes && periodosExistentes.length > 0) {
      const periodo = periodosExistentes[0];
      if (periodo.status === 'fechado') {
        return errorResponse('ALREADY_CLOSED', `Período ${competencia} já está fechado`);
      }
    }

    // ============================================================
    // 2. Executar Validações
    // ============================================================
    const validacoes: any[] = [];

    // Validação 1: Integridade Financeira
    try {
      const contas = await base44.asServiceRole.entities.ContaFinanceira.filter(
        {
          empresa_id,
          ...(obra_id && { obra_id }),
          status: 'pendente'
        }
      );

      const integridadeOk = !contas || contas.length === 0;
      validacoes.push({
        tipo: 'integridade_financeira',
        resultado: integridadeOk,
        detalhes: integridadeOk
          ? 'Todas as contas conciliadas'
          : `${contas.length} contas pendentes ainda não conciliadas`,
        data: new Date().toISOString()
      });
    } catch (e) {
      console.error('[fecharPeriodo] Erro na validação financeira:', e);
      return internalErrorResponse(e);
    }

    // Validação 2: Medições Aprovadas
    try {
      const medicoes = await base44.asServiceRole.entities.Medicao.filter(
        {
          empresa_id,
          ...(obra_id && { obra_id }),
          status: { $ne: 'aprovada' }
        }
      );

      const medicoesOk = !medicoes || medicoes.length === 0;
      validacoes.push({
        tipo: 'medicoes_aprovadas',
        resultado: medicoesOk,
        detalhes: medicoesOk
          ? 'Todas as medições aprovadas'
          : `${medicoes.length} medições não aprovadas`,
        data: new Date().toISOString()
      });
    } catch (e) {
      console.error('[fecharPeriodo] Erro na validação de medições:', e);
      return internalErrorResponse(e);
    }

    // Validação 3: Ordens Recebidas
    try {
      const ocs = await base44.asServiceRole.entities.OrdemCompra.filter(
        {
          empresa_id,
          ...(obra_id && { obra_id }),
          status: 'pendente_recebimento'
        }
      );

      const ocsOk = !ocs || ocs.length === 0;
      validacoes.push({
        tipo: 'ordens_recebidas',
        resultado: ocsOk,
        detalhes: ocsOk
          ? 'Todas as OCs recebidas'
          : `${ocs.length} OCs aguardando recebimento`,
        data: new Date().toISOString()
      });
    } catch (e) {
      console.error('[fecharPeriodo] Erro na validação de OCs:', e);
      return internalErrorResponse(e);
    }

    // Validação 4: Contas Conciliadas
    try {
      const contasNaoConciliadas = await base44.asServiceRole.entities.ContaFinanceira.filter(
        {
          empresa_id,
          ...(obra_id && { obra_id }),
          status: { $ne: 'pago' }
        }
      );

      const conciliacaoOk = !contasNaoConciliadas || contasNaoConciliadas.length === 0;
      validacoes.push({
        tipo: 'contas_conciliadas',
        resultado: conciliacaoOk,
        detalhes: conciliacaoOk
          ? 'Todas as contas conciliadas'
          : `${contasNaoConciliadas.length} contas não conciliadas`,
        data: new Date().toISOString()
      });
    } catch (e) {
      console.error('[fecharPeriodo] Erro na validação de conciliação:', e);
      return internalErrorResponse(e);
    }

    // ============================================================
    // 3. Verificar se todas as validações passaram
    // ============================================================
    const todasValidacoes = validacoes.every(v => v.resultado === true);
    
    if (!todasValidacoes) {
      return errorResponse(
        'VALIDATION_FAILED',
        'Período não pode ser fechado. Existem pendências:',
        400
      );
    }

    // ============================================================
    // 4. Criar ou atualizar registro de PeriodoFechamento
    // ============================================================
    let periodo;

    if (periodosExistentes && periodosExistentes.length > 0) {
      periodo = await base44.asServiceRole.entities.PeriodoFechamento.update(
        periodosExistentes[0].id,
        {
          status: 'fechado',
          data_fechamento: new Date().toISOString(),
          fechado_por: user.email,
          motivo_fechamento,
          validacoes_executadas: validacoes,
          auditoria: [
            ...(periodosExistentes[0].auditoria || []),
            {
              acao: 'fechado',
              usuario: user.email,
              data: new Date().toISOString(),
              motivo: motivo_fechamento
            }
          ]
        }
      );
    } else {
      periodo = await base44.asServiceRole.entities.PeriodoFechamento.create({
        competencia,
        empresa_id,
        obra_id,
        status: 'fechado',
        data_fechamento: new Date().toISOString(),
        fechado_por: user.email,
        motivo_fechamento,
        validacoes_executadas: validacoes,
        auditoria: [
          {
            acao: 'fechado',
            usuario: user.email,
            data: new Date().toISOString(),
            motivo: motivo_fechamento
          }
        ]
      });
    }

    // ============================================================
    // 5. Registrar auditoria
    // ============================================================
    console.log('[fecharPeriodo] Período fechado:', {
      competencia,
      empresa_id,
      obra_id,
      usuario: user.email,
      validacoes
    });

    return successResponse({
      periodId: periodo.id,
      competencia,
      status: 'fechado',
      validacoes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[fecharPeriodo] Erro:', error);
    return internalErrorResponse(error);
  }
});