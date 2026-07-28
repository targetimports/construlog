/**
 * Configuração Central de Permissões (RBAC)
 */

export const ROLES = {
  DIRETOR: 'diretor',
  ENGENHARIA: 'engenharia',
  ALMOXARIFE: 'almoxarife',
  COMPRAS: 'compras',
  FINANCEIRO: 'financeiro',
  LEITURA: 'leitura'
};

export const ROUTE_PERMISSIONS = {
  '/ContasReceber': ['diretor', 'financeiro'],
  '/ContasPagar': ['diretor', 'financeiro'],
  '/Financeiro': ['diretor', 'financeiro'],
  '/FinanceiroAvancado': ['diretor', 'financeiro'],
  '/MovimentacoesEstoque': ['diretor', 'almoxarife', 'compras'],
  '/Estoque': ['diretor', 'almoxarife', 'compras', 'engenharia'],
  '/Compras': ['diretor', 'compras'],
  '/DiarioObra': ['diretor', 'engenharia', 'admin_empresa'],
  '/Medicoes': ['diretor', 'engenharia'],
  '/Dashboard': '*'
};

export const ROLE_LABELS = {
  diretor: 'Diretor',
  engenharia: 'Engenharia',
  almoxarife: 'Almoxarife',
  compras: 'Compras',
  financeiro: 'Financeiro',
  leitura: 'Leitura'
};

export function canAccessRoute(userRole, routePath) {
  if (!userRole) return false;
  if (userRole === 'diretor') return true;
  
  const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const allowedRoles = ROUTE_PERMISSIONS[normalizedPath];
  
  if (!allowedRoles) return true;
  if (allowedRoles === '*') return true;
  
  return allowedRoles.includes(userRole);
}