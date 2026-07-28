/**
 * Resolvedor de rotas dinâmico
 * Mapeia chaves de cards/ações para rotas válidas existentes no menu
 * 
 * Retorna:
 * - path: string => rota existente e navegável
 * - null => rota não encontrada (card será desabilitado)
 */

export const ROUTE_KEY_MAP = {
  // Obras e Projetos
  'OBRAS': '/Obras',
  'OBRAS_CADASTRADAS': '/Obras',
  'OBRAS_ATRASADAS': '/Obras',
  'GESTAO_OBRAS': '/GestaoObras',
  
  // Materiais / Insumos
  'INSUMOS': '/Insumos',
  'MATERIAIS_CADASTRADOS': '/Insumos',
  'ESTOQUE': '/Estoque',
  
  // Compras
  'COMPRAS': '/Compras',
  'COMPRAS_PENDENTES': '/Compras',
  'SOLICITACOES_COMPRA': '/Solicitacoes',
  'REQUISICOES': '/Solicitacoes',
  'ORDENS_COMPRA': '/OrdensCompra',
  
  // Financeiro
  'FINANCEIRO': '/Financeiro',
  'FINANCEIRO_AVANCADO': '/FinanceiroAvancado',
  'CONTAS_RECEBER': '/ContasReceber',
  'CONTAS_PAGAR': '/ContasPagar',
  'FLUXO_CAIXA': '/FinanceiroAvancado',
  'DRE': '/DreObra',
  'LANCAMENTOS': '/Lancamentos',
  
  // Logística e Frota
  'FROTA': '/Frota',
  'VEICULOS': '/Frota',
  'VIAGENS': '/MinhasViagens',
  'SOLICITACOES_VEICULO': '/SolicitacoesVeiculos',
  
  // RH
  'COLABORADORES': '/Colaboradores',
  'RH': '/RecursosHumanos',
  'APONTAMENTOS_HORAS': '/ApontamentoHoras',
  
  // Medicões e Contratos
  'MEDICOES': '/Medicoes',
  'MEDICOES_OBRA': '/MedicioesObra',
  'CONTRATOS': '/Contratos',
  'MEDICOES_CONTRATO': '/MedicoesContrato',
  
  // Diário
  'DIARIO_OBRA': '/DiarioObra',
  'CAMPO': '/DiarioCampo',
  
  // Relatórios
  'RELATORIOS': '/Relatorios',
  'BI': '/BI',
  
  // Agenda e Eventos
  'AGENDA': '/Agenda',
  
  // Notificações
  'NOTIFICACOES': '/MinhasNotificacoes',
  
  // Auditoria
  'AUDITORIA': '/Auditoria',
};

/**
 * Resolve uma rota por chave
 * @param {string} routeKey - chave do mapa (ex: 'OBRAS', 'FINANCEIRO')
 * @returns {string|null} - rota válida ou null se não encontrada
 */
export function resolveRouteByKey(routeKey) {
  if (!routeKey) return null;
  const normalized = String(routeKey).toUpperCase().trim();
  return ROUTE_KEY_MAP[normalized] || null;
}

/**
 * Resolve rota com fallback (usa parametros da URL)
 * @param {string} routeKey - chave da rota
 * @param {object} params - parâmetros opcionais para a URL (ex: { obraId, periodo })
 * @returns {string|null}
 */
export function resolveRouteWithParams(routeKey, params = {}) {
  let path = resolveRouteByKey(routeKey);
  if (!path) return null;
  
  // Adicionar parâmetros de query se fornecidos
  const queryParams = [];
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });
  
  if (queryParams.length > 0) {
    path = `${path}?${queryParams.join('&')}`;
  }
  
  return path;
}

/**
 * Validar se uma rota existe
 * @param {string} routePath - caminho completo da rota
 * @returns {boolean}
 */
export function isValidRoute(routePath) {
  if (!routePath) return false;
  
  // Qualquer rota que comece com "/" é considerada válida
  // O mapa ROUTE_KEY_MAP é apenas para resolução de chaves, não para validação
  const pathWithoutQuery = routePath.split('?')[0];
  if (pathWithoutQuery.startsWith('/')) return true;
  
  // Fallback: verificar se está no mapa
  return Object.values(ROUTE_KEY_MAP).includes(pathWithoutQuery);
}

/**
 * Config padrão de cards do Dashboard
 * Cada card tem: title, routeKey, icon, requiredPermission
 */
export const DASHBOARD_CARDS_CONFIG = [
  {
    key: 'obras',
    title: 'Obras Cadastradas',
    routeKey: 'OBRAS',
    requiredPermission: 'OBRAS_VIEW',
    icon: 'Building2'
  },
  {
    key: 'materiais',
    title: 'Materiais Cadastrados',
    routeKey: 'INSUMOS',
    requiredPermission: 'INSUMOS_VIEW',
    icon: 'Database'
  },
  {
    key: 'compras',
    title: 'Compras Pendentes',
    routeKey: 'COMPRAS',
    requiredPermission: 'COMPRAS_VIEW',
    icon: 'Truck'
  },
  {
    key: 'receber',
    title: 'A Receber',
    routeKey: 'FINANCEIRO_AVANCADO',
    requiredPermission: 'FINANCEIRO_VIEW',
    icon: 'DollarSign'
  },
  {
    key: 'custos',
    title: 'Custos no Período',
    routeKey: 'FINANCEIRO_AVANCADO',
    requiredPermission: 'FINANCEIRO_VIEW',
    icon: 'TrendingUp'
  },
  {
    key: 'saldo',
    title: 'Saldo de Caixa',
    routeKey: 'FINANCEIRO_AVANCADO',
    requiredPermission: 'FINANCEIRO_VIEW',
    icon: 'DollarSign'
  },
  {
    key: 'frota',
    title: 'Frota',
    routeKey: 'FROTA',
    requiredPermission: null,
    icon: 'Truck'
  },
  {
    key: 'colaboradores',
    title: 'Colaboradores',
    routeKey: 'COLABORADORES',
    requiredPermission: null,
    icon: 'Users'
  }
];