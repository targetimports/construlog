/**
 * Mapa de rotas -> permissões requeridas
 * Fonte única para alinhar RBAC com rotas
 */
export const routePermissions = {
  // Dashboard
  'dashboard': 'DASH_VIEW',
  'dashboard-executivo': 'DASH_VIEW_EXEC',
  'dashboard-operacional': 'DASH_VIEW_OPER',

  // Calendário
  'agenda': 'CAL_VIEW',
  'apontamento-semanal': 'CAL_APOINT_VIEW',

  // Obras
  'obras': 'OBRAS_VIEW',
  'obras-todas': 'OBRAS_VIEW',
  'obras-gestao': 'OBRAS_GESTAO',
  'obras-diario': 'OBRAS_DIARIO_VIEW',
  'obras-engenharia': 'OBRAS_ENG_VIEW',
  'obras-medicoes': 'OBRAS_MED_VIEW',
  'obras-mapa-medicoes': 'OBRAS_MED_MAP_VIEW',

  // Suprimentos
  'suprimentos': 'SUPR_VIEW',
  'suprimentos-solicitar': 'SUPR_REQ_CREATE',
  'suprimentos-requisicoes': 'SUPR_REQ_VIEW',
  'suprimentos-aprovar': 'SUPR_APROVE',
  'suprimentos-cotacoes': 'SUPR_COTACAO_VIEW',
  'suprimentos-ordens-compra': 'SUPR_OC_VIEW',
  'suprimentos-contratos': 'SUPR_CONTR_VIEW',

  // Estoques
  'estoques': 'STOCK_VIEW',
  'estoques-painel': 'STOCK_PANEL_VIEW',
  'estoques-saldo': 'STOCK_BALANCE_VIEW',
  'estoques-depositos': 'STOCK_DEPO_VIEW',
  'estoques-recebimento': 'STOCK_RECV_VIEW',
  'estoques-transferencia': 'STOCK_TRANS_VIEW',
  'estoques-receber-transferencia': 'STOCK_TRANS_RECV',

  // Logística
  'logistica': 'LOG_VIEW',
  'logistica-solicitar-transporte': 'LOG_REQ_VEH_CREATE',
  'logistica-solicitar-maquinas': 'LOG_REQ_MACH_CREATE',
  'logistica-minhas-rotas': 'LOG_ROUTES_VIEW',
  'logistica-viagens': 'LOG_TRIPS_VIEW',
  'logistica-relatorios': 'LOG_REPORT_VIEW',
  'logistica-frota': 'LOG_FLEET_VIEW',
  'logistica-motoristas': 'LOG_DRIVERS_VIEW',
  'logistica-rastreamento': 'LOG_TRACK_VIEW',
  'logistica-custos': 'LOG_COST_VIEW',

  // Equipamentos
  'equipamentos': 'EQUIP_VIEW',
  'equipamentos-painel': 'EQUIP_PANEL_VIEW',
  'equipamentos-gestao': 'EQUIP_MANAGE_VIEW',
  'equipamentos-agendamento': 'EQUIP_SCHEDULE_VIEW',
  'equipamentos-manutencao': 'EQUIP_MAINT_VIEW',

  // Financeiro
  'financeiro': 'FIN_VIEW',
  'financeiro-lancamentos': 'FIN_TRANS_VIEW',
  'financeiro-contas-pagar': 'FIN_PAYABLE_VIEW',
  'financeiro-contas-receber': 'FIN_RECEIVABLE_VIEW',

  // RH
  'rh': 'RH_VIEW',
  'rh-colaboradores': 'RH_EMP_VIEW',
  'rh-apontamento-horas': 'RH_HOURS_VIEW',

  // Relatórios
  'relatorios': 'REPORT_VIEW',

  // Admin
  'administracao': 'ADMIN_VIEW',
  'gestao-usuarios': 'ADMIN_USERS',
};

/**
 * Mapa inverso: permissão -> rota default
 * Usado para redirecionar quando acesso negado
 */
export const permissionToRoute = {
  'DASH_VIEW': 'dashboard',
  'DASH_VIEW_EXEC': 'dashboard',
  'DASH_VIEW_OPER': 'dashboard',
  'LOG_VIEW': 'logistica-minhas-rotas',
  'LOG_ROUTES_VIEW': 'logistica-minhas-rotas',
  'EQUIP_VIEW': 'equipamentos-painel',
  'OBRAS_VIEW': 'obras',
  'SUPR_VIEW': 'suprimentos-requisicoes',
  'STOCK_VIEW': 'estoques-painel',
  'FIN_VIEW': 'financeiro-lancamentos',
  'RH_VIEW': 'rh-colaboradores',
  'REPORT_VIEW': 'relatorios',
};

export function getRequiredPermission(routeId) {
  return routePermissions[routeId] || 'DASH_VIEW';
}

export function getDefaultRouteForPermission(permission) {
  return permissionToRoute[permission] || 'dashboard';
}