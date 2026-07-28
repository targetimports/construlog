/**
 * Reabrir Período Financeiro
 * 
 * - Requer permissão BREAK_GLASS (apenas admins com override)
 * - Registra tentativa de reabertura
 * - Libera edições retroativas novamente
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
      return errorResponse('FORBIDDEN', 'Apenas admins podem reabrir períodos', 403);
    }

    const payload = await req.json();
    const { periodo_id, motivo_reabertura, breakGlassToken } = payload;

    if (!periodo_id || !motivo_reabertura) {
      return errorResponse('INVALID_INPUT', 'periodo_id e motivo_reabertura obrigatórios');
    }

    // ============================================================
    // 1. Validar BREAK_GLASS token
    // ============================================================
    if (!breakGlassToken) {
      return errorResponse(
        'BREAK_GLASS_REQUIRED',
        'Reabertura de período requer token BREAK_GLASS'
      );
    }

    // Verificar se o token é válido
    const tokens = await base44.asServiceRole.entities.BreakGlassToken.filter({
      token: breakGlassToken,
      usado: false
    });

    if (!tokens || tokens.length === 0) {
      console.warn('[reabrirPeriodo] Token BREAK_GLASS inválido:', breakGlassToken);
      return errorResponse('INVALID_TOKEN', 'Token BREAK_GLASS inválido ou já utilizado');
    }

    const token = tokens[0];

    // ============================================================
    // 2. Obter período
    // ============================================================
    const periodo = await base44.asServiceRole.entities.PeriodoFechamento.filter(
      { id: periodo_id }
    );

    if (!periodo || periodo.length === 0) {
      return errorResponse('NOT_FOUND', 'Período não encontrado');
    }

    const periodoData = periodo[0];

    if (periodoData.status !== 'fechado') {
      return errorResponse('INVALID_STATE', `Período já está ${periodoData.status}`);
    }

    // ============================================================
    // 3. Reabrir período
    // ============================================================
    const periodAtualizado = await base44.asServiceRole.entities.PeriodoFechamento.update(
      periodo_id,
      {
        status: 'aberto',
        reabertura_solicitada: false,
        auditoria: [
          ...(periodoData.auditoria || []),
          {
            acao: 'reabertoBreakGlass',
            usuario: user.email,
            data: new Date().toISOString(),
            motivo: motivo_reabertura
          }
        ]
      }
    );

    // ============================================================
    // 4. Marcar token como utilizado
    // ============================================================
    await base44.asServiceRole.entities.BreakGlassToken.update(token.id, {
      usado: true,
      data_uso: new Date().toISOString(),
      usado_por: user.email
    });

    // ============================================================
    // 5. Registrar auditoria
    // ============================================================
    console.warn('[reabrirPeriodo] ⚠️ PERÍODO REABERETO COM BREAK_GLASS:', {
      periodo: periodoData.competencia,
      usuario: user.email,
      motivo: motivo_reabertura,
      timestamp: new Date().toISOString()
    });

    return successResponse({
      periodId: periodo_id,
      status: 'aberto',
      reabertoEm: new Date().toISOString(),
      motivo: motivo_reabertura,
      warning: 'Período reabererto com BREAK_GLASS - auditar todas as alterações'
    });

  } catch (error) {
    console.error('[reabrirPeriodo] Erro:', error);
    return internalErrorResponse(error);
  }
});