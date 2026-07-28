/**
 * Middleware para bloquear edições retroativas quando período está fechado
 * 
 * Uso:
 * const valido = await validarPeriodoAberto(base44, obra_id, empresa_id, data_operacao);
 * if (!valido.pode_editar) {
 *   throw new Error('Período fechado - edição retroativa bloqueada');
 * }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

export interface ValidacaoPeriodo {
  pode_editar: boolean;
  requer_break_glass: boolean;
  motivo: string;
  periodo_id?: string;
  competencia?: string;
}

export async function validarPeriodoAberto(
  base44: any,
  obra_id: string,
  empresa_id: string,
  data_operacao?: string,
  user?: any
): Promise<ValidacaoPeriodo> {
  try {
    // Extrair competência da data (YYYY-MM)
    const data = data_operacao ? new Date(data_operacao) : new Date();
    const competencia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;

    // Buscar período fechado
    const periodos = await base44.asServiceRole.entities.PeriodoFechamento.filter({
      competencia,
      empresa_id,
      ...(obra_id && { obra_id })
    });

    if (!periodos || periodos.length === 0) {
      // Sem período = aberto
      return {
        pode_editar: true,
        requer_break_glass: false,
        motivo: '✅ Período aberto'
      };
    }

    const periodo = periodos[0];

    if (periodo.status === 'aberto') {
      return {
        pode_editar: true,
        requer_break_glass: false,
        motivo: '✅ Período aberto',
        periodo_id: periodo.id,
        competencia
      };
    }

    if (periodo.status === 'fechado') {
      return {
        pode_editar: false,
        requer_break_glass: true,
        motivo: `🔒 Período ${competencia} está FECHADO desde ${periodo.data_fechamento}`,
        periodo_id: periodo.id,
        competencia
      };
    }

    if (periodo.status === 'bloqueado') {
      return {
        pode_editar: false,
        requer_break_glass: true,
        motivo: `⛔ Período ${competencia} está BLOQUEADO - não editar`,
        periodo_id: periodo.id,
        competencia
      };
    }

    return {
      pode_editar: false,
      requer_break_glass: true,
      motivo: 'Status do período desconhecido'
    };

  } catch (error) {
    console.error('[validadorPeriodoFechado] Erro:', error);
    // Em erro, permitir edição (falha aberta)
    return {
      pode_editar: true,
      requer_break_glass: false,
      motivo: 'Erro ao validar período - permitido por padrão'
    };
  }
}

/**
 * Middleware wrapper para usar em functions
 */
export function withPeriodoFechado(handler: any) {
  return async (req: any) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return new Response(
        JSON.stringify({ ok: false, code: 'UNAUTHORIZED', message: 'Não autenticado' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }

    const payload = await req.json();
    const { obra_id, empresa_id, data_operacao } = payload;

    // Validar período
    const validacao = await validarPeriodoAberto(base44, obra_id, empresa_id, data_operacao, user);

    if (!validacao.pode_editar) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: 'PERIODO_FECHADO',
          message: validacao.motivo,
          periodo_id: validacao.periodo_id,
          requer_break_glass: validacao.requer_break_glass
        }),
        { status: 403, headers: { 'content-type': 'application/json' } }
      );
    }

    // Período está aberto - executar handler
    return handler(req, base44, user);
  };
}