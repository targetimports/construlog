/**
 * Middleware de Validação de Permissão Backend
 * 
 * Uso:
 * await requireRole(base44, ['diretor', 'financeiro']);
 * 
 * Lança erro 403 se usuário não tem permissão
 */

const ROLES = {
  DIRETOR: 'diretor',
  ENGENHARIA: 'engenharia',
  ALMOXARIFE: 'almoxarife',
  COMPRAS: 'compras',
  FINANCEIRO: 'financeiro',
  LEITURA: 'leitura'
};

export async function requireRole(base44, allowedRoles = []) {
  // Obter usuário autenticado
  const user = await base44.auth.me();

  if (!user) {
    throw new Response(JSON.stringify({
      error: 'Não autenticado',
      code: 'UNAUTHORIZED'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Obter role do usuário (fallback para 'leitura')
  const userRole = user.cargo || 'leitura';

  // Diretor sempre tem acesso
  if (userRole === ROLES.DIRETOR) {
    return { user, userRole };
  }

  // Verificar se role está na lista permitida
  if (!allowedRoles.includes(userRole)) {
    throw new Response(JSON.stringify({
      error: 'Sem permissão para esta ação',
      code: 'FORBIDDEN',
      userRole,
      allowedRoles
    }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return { user, userRole };
}