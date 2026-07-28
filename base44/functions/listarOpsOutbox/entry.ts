import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { successResponse, errorResponse, internalErrorResponse } from './_shared/responseHandler.ts';

/**
 * Listar OpsOutbox com filtros, paginação e validação de escopo
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ✅ Autenticação
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Não autorizado', 401);
    }

    // ✅ Permissão
    const temPermissao = await validarPermissao(base44, user, 'OPS_OUTBOX_VER');
    if (!temPermissao) {
      return errorResponse('FORBIDDEN', 'Sem permissão para visualizar outbox', 403);
    }

    const { status, tipo, obraId, limit = 50, cursor } = await req.json();

    // ✅ Construir filtro
    const filtro: any = {};
    
    if (status) filtro.status = status;
    if (tipo) filtro.tipo = tipo;
    if (obraId) filtro.obra_id = obraId;

    // Se não for admin, aplicar escopo de empresa/obra
    if (user.role !== 'admin') {
      // Buscar empresas do usuário
      const empresas = await obterEmpresasDoUsuario(base44, user);
      if (empresas.length > 0) {
        filtro.empresa_id = { $in: empresas };
      }
    }

    // ✅ Buscar com paginação
    const parsedLimit = Math.min(parseInt(limit) || 50, 100); // máximo 100
    const skip = cursor ? parseInt(cursor) : 0;

    const items = await base44.asServiceRole.entities.OpsOutbox.filter(
      filtro,
      '-created_date',
      parsedLimit + 1 // pega um a mais para detectar próxima página
    );

    const hasNextPage = items.length > parsedLimit;
    const resultado = hasNextPage ? items.slice(0, parsedLimit) : items;
    const nextCursor = hasNextPage ? (skip + parsedLimit).toString() : null;

    return successResponse({ items: resultado, nextCursor });

  } catch (error) {
    console.error('[listarOpsOutbox] erro:', error);
    return internalErrorResponse(error);
  }
});

/**
 * Valida permissão do usuário
 */
async function validarPermissao(
  base44: any,
  user: any,
  permission: string
): Promise<boolean> {
  try {
    if (user.role === 'admin') return true;
    if (user.permissoes?.includes(permission)) return true;

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
 * Obter empresas/obras do usuário (escopo)
 */
async function obterEmpresasDoUsuario(
  base44: any,
  user: any
): Promise<string[]> {
  try {
    // Buscar vinculações do usuário em empresas
    const colaborador = await base44.entities.Colaborador.filter({
      user_email: user.email
    });

    if (colaborador.length === 0) return [];

    // Se tem vinculação com obras, usar essas obras
    const obra = colaborador[0]?.obra_atual_id;
    return obra ? [obra] : [];
  } catch (err) {
    console.warn('[obterEmpresasDoUsuario] erro:', err);
    return [];
  }
}