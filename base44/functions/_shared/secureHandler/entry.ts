import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { successResponse, errorResponse, internalErrorResponse } from './responseHandler.ts';
import { FunctionLogger } from './logger.ts';

/**
 * Secure Handler - Centraliza autenticação, RBAC, validação, escopo, auditoria
 */

export interface SecureHandlerConfig {
  requiredPermission?: string;
  requiredRole?: 'user' | 'admin';
  validateInput?: (data: any) => { valid: boolean; error?: string };
  requireObraScope?: boolean;
  requireEmpresaScope?: boolean;
  auditAction: string; // ex: "CRIAR_OC", "APROVAR_MEDICAO"
}

export interface SecureContext {
  user: any;
  base44: any;
  obraId?: string;
  empresaId?: string;
  payload: any;
}

export class SecureHandlerError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'SecureHandlerError';
  }
}

/**
 * Wrapper seguro para funções backend
 */
export async function withSecureHandler(
  req: Request,
  config: SecureHandlerConfig,
  handler: (ctx: SecureContext) => Promise<any>
): Promise<Response> {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger(config.auditAction, base44);
  let payload: any = {};
  
  try {
    try {
      payload = await req.json();
    } catch (parseErr) {
      logger.startTime = Date.now(); // Reset timer
      await logger.validationError(null, {}, 'Payload inválido (JSON parseError)');
      return errorResponse('BAD_REQUEST', 'Payload inválido (JSON parseError)', 400);
    }

    // ✅ 1. AUTENTICAÇÃO OBRIGATÓRIA
    const user = await base44.auth.me();
    if (!user) {
      await logger.unauthorized(null, payload);
      throw new SecureHandlerError('UNAUTHORIZED', 401, 'Usuário não autenticado');
    }

    // ✅ 2. VALIDAÇÃO RBAC POR PERMISSION
    if (config.requiredPermission) {
      const hasPermission = await validarPermissao(
        base44,
        user,
        config.requiredPermission
      );
      if (!hasPermission) {
        await auditarTentativa(base44, user, config.auditAction, false, 'SEM_PERMISSAO');
        await logger.forbidden(user, payload, `Sem permissão: ${config.requiredPermission}`);
        throw new SecureHandlerError('FORBIDDEN', 403, `Sem permissão: ${config.requiredPermission}`);
      }
    }

    // ✅ 3. VALIDAÇÃO DE ROLE
    if (config.requiredRole === 'admin' && user.role !== 'admin') {
      await logger.forbidden(user, payload, 'Apenas administradores');
      throw new SecureHandlerError('FORBIDDEN', 403, 'Apenas administradores');
    }

    // ✅ 4. VALIDAÇÃO DE INPUT
    if (config.validateInput) {
      const validation = config.validateInput(payload);
      if (!validation.valid) {
        await logger.validationError(user, payload, validation.error || 'Dados inválidos');
        throw new SecureHandlerError('BAD_REQUEST', 400, validation.error || 'Dados inválidos');
      }
    }

    // ✅ 5. VALIDAÇÃO DE ESCOPO
    let obraId: string | undefined;
    let empresaId: string | undefined;

    if (config.requireObraScope) {
      obraId = payload.obra_id;
      if (!obraId) {
        throw new SecureHandlerError('BAD_REQUEST', 400, 'obra_id é obrigatório');
      }

      // Verificar se usuário tem acesso à obra
      const temAcesso = await validarAcessoObra(base44, user, obraId);
      if (!temAcesso && user.role !== 'admin') {
        await auditarTentativa(base44, user, config.auditAction, false, 'SEM_ACESSO_OBRA');
        throw new SecureHandlerError('FORBIDDEN', 403, `Sem acesso à obra ${obraId}`);
      }
    }

    if (config.requireEmpresaScope) {
      empresaId = payload.empresa_id;
      if (!empresaId) {
        throw new SecureHandlerError('BAD_REQUEST', 400, 'empresa_id é obrigatório');
      }
    }

    // ✅ 6. EXECUTAR HANDLER
    const resultado = await handler({
      user,
      base44,
      obraId,
      empresaId,
      payload
    });

    // ✅ AUDITORIA DE SUCESSO
    await auditarTentativa(base44, user, config.auditAction, true, 'SUCESSO', {
      obra_id: obraId,
      empresa_id: empresaId
    });
    
    // ✅ LOG DE SUCESSO
    await logger.success(user, payload, resultado, {
      obra_id: obraId,
      empresa_id: empresaId
    });

    return successResponse(resultado);

  } catch (error) {
    // ✅ TRATAMENTO PADRONIZADO DE ERRO
    const err = error as any;

    if (err instanceof SecureHandlerError) {
      if (err.code === 'UNAUTHORIZED') {
        await logger.unauthorized(null, payload);
      } else if (err.code === 'FORBIDDEN') {
        await logger.forbidden(null, payload, err.message);
      }
      return errorResponse(err.code, err.message, err.statusCode);
    }

    console.error('[secureHandler] erro não tratado:', {
      name: error?.name,
      message: error?.message,
      stack: error?.stack
    });
    
    // Log de erro genérico
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, payload, error, 'INTERNAL_ERROR');
    
    return internalErrorResponse(error);
  }
}

/**
 * Validar permissão RBAC
 */
async function validarPermissao(
  base44: any,
  user: any,
  permission: string
): Promise<boolean> {
  try {
    if (user.role === 'admin') return true;

    // Verificar permissões diretas do usuário
    if (user.permissoes?.includes(permission)) return true;

    // Verificar overrides de permissão
    const overrides = await base44.entities.UserPermissionOverride.filter({
      user_id: user.email,
      permission_key: permission
    });

    return overrides?.length > 0 && overrides[0].allowed === true;
  } catch (err) {
    console.warn('[validarPermissao] erro:', err);
    return false;
  }
}

/**
 * Validar acesso do usuário à obra
 */
async function validarAcessoObra(
  base44: any,
  user: any,
  obraId: string
): Promise<boolean> {
  try {
    // Admin tem acesso a tudo
    if (user.role === 'admin') return true;

    // Verificar se está vinculado à obra
    const colaborador = await base44.entities.Colaborador.filter({
      user_email: user.email,
      obra_atual_id: obraId
    });

    if (colaborador.length > 0) return true;

    // Verificar permissão específica da obra
    const permObra = await base44.entities.PermissaoObra?.filter({
      user_email: user.email,
      obra_id: obraId
    }).catch(() => []);

    return permObra?.length > 0;
  } catch (err) {
    console.warn('[validarAcessoObra] erro:', err);
    return false;
  }
}

/**
 * Auditar tentativa de ação
 */
async function auditarTentativa(
  base44: any,
  user: any,
  action: string,
  sucesso: boolean,
  motivo: string,
  metadata?: any
): Promise<void> {
  try {
    await base44.asServiceRole.entities.LogAuditoria?.create({
      user_email: user.email,
      acao: action,
      resultado: sucesso ? 'SUCESSO' : 'FALHA',
      motivo,
      metadata: JSON.stringify(metadata || {}),
      data_hora: new Date().toISOString(),
      ip_origem: '', // Pode ser extraído do request se necessário
      user_agent: ''
    }).catch(() => {}); // Não falhar se auditoria falhar
  } catch (err) {
    console.warn('[auditarTentativa] erro:', err);
  }
}

/**
 * Validador padrão de input com Zod-like API (simples)
 */
export const SchemaValidator = {
  string: (required = true) => (val: any) => {
    if (required && !val) return { valid: false, error: 'Campo obrigatório' };
    if (val && typeof val !== 'string') return { valid: false, error: 'Deve ser string' };
    return { valid: true };
  },

  number: (required = true) => (val: any) => {
    if (required && val === undefined) return { valid: false, error: 'Campo obrigatório' };
    if (val && typeof val !== 'number') return { valid: false, error: 'Deve ser número' };
    return { valid: true };
  },

  object: (schema: Record<string, (val: any) => { valid: boolean; error?: string }>) => 
    (data: any) => {
      if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Deve ser um objeto' };
      }
      for (const [key, validator] of Object.entries(schema)) {
        const result = validator(data[key]);
        if (!result.valid) {
          return { valid: false, error: `${key}: ${result.error}` };
        }
      }
      return { valid: true };
    }
};