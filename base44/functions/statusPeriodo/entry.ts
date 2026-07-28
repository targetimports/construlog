/**
 * Obter Status do Período
 * 
 * - Retorna status: aberto, fechado, bloqueado
 * - Retorna validações executadas
 * - Retorna histórico de alterações
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

    const payload = await req.json();
    const { competencia, empresa_id, obra_id } = payload;

    if (!competencia || !empresa_id) {
      return errorResponse('INVALID_INPUT', 'competencia e empresa_id obrigatórios');
    }

    // ============================================================
    // 1. Buscar período
    // ============================================================
    const periodos = await base44.asServiceRole.entities.PeriodoFechamento.filter({
      competencia,
      empresa_id,
      ...(obra_id && { obra_id })
    });

    if (!periodos || periodos.length === 0) {
      // Período não existe = está aberto (padrão)
      return successResponse({
        competencia,
        empresa_id,
        obra_id,
        status: 'aberto',
        pode_editar: true,
        motivo: 'Período sem registro de fechamento (padrão: aberto)',
        periodo_id: null
      });
    }

    const periodo = periodos[0];

    // ============================================================
    // 2. Montar resposta com informações completas
    // ============================================================
    const podeEditar = periodo.status === 'aberto';
    const requerBreakGlass = periodo.status === 'bloqueado';

    return successResponse({
      periodo_id: periodo.id,
      competencia,
      empresa_id,
      obra_id,
      status: periodo.status,
      pode_editar: podeEditar,
      requer_break_glass: requerBreakGlass,
      data_fechamento: periodo.data_fechamento,
      fechado_por: periodo.fechado_por,
      motivo_fechamento: periodo.motivo_fechamento,
      validacoes_executadas: periodo.validacoes_executadas || [],
      reabertura_solicitada: periodo.reabertura_solicitada || false,
      reabertura_motivo: periodo.reabertura_motivo,
      reabertura_solicitada_por: periodo.reabertura_solicitada_por,
      reabertura_data_solicitacao: periodo.reabertura_data_solicitacao,
      auditoria: periodo.auditoria || [],
      info: {
        msg_status:
          periodo.status === 'aberto'
            ? '✅ Período aberto - edições permitidas'
            : periodo.status === 'fechado'
            ? '🔒 Período fechado - requer BREAK_GLASS para editar'
            : '⛔ Período bloqueado - não editar'
      }
    });

  } catch (error) {
    console.error('[statusPeriodo] Erro:', error);
    return internalErrorResponse(error);
  }
});