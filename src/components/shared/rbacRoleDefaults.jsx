/**
 * RBAC Role Defaults
 * Fonte de verdade para a VISIBILIDADE DE MENU/MÓDULOS por perfil.
 * Nunca retorna vazio - sempre há um fallback ('geral').
 *
 * Perfis alinhados ao plano (§31): admin, financeiro, supervisor, encarregado,
 * almoxarife, motorista, operacional. Mais dois técnicos: `programador`
 * (super admin / acesso total) e `geral` (fallback mínimo).
 */

export const ROLE_DEFAULTS = {
  // ───── Técnicos ─────
  programador: {
    isSuperAdmin: true,
    label: 'Programador',
    allowAll: true,
    denyModules: [], // Programador acessa TUDO, inclusive TI
    description: 'Acesso total ao sistema (técnico)'
  },

  // ───── Perfis do plano (§31) ─────
  admin: {
    isSuperAdmin: false,
    label: 'Administrador',
    allowAll: true,
    denyModules: ['TI'],
    description: 'Acesso total ao sistema (exceto TI)'
  },

  financeiro: {
    isSuperAdmin: false,
    label: 'Financeiro',
    allowModules: [
      'Financeiro', 'FinanceiroAvancado', 'ContasPagar', 'ContasReceber',
      'RelatoriosFinanceiros', 'DashboardFinanceiro', 'Relatórios',
      'Obras', 'Cadastros', 'Agenda', 'Consultas', 'Notificações', 'Ajustes'
    ],
    denyModules: ['TI', 'Administração'],
    description: 'Caixa, recebimentos, pagamentos, ativação de obra e reservas'
  },

  supervisor: {
    isSuperAdmin: false,
    label: 'Supervisor',
    allowModules: [
      'Dashboard', 'Obras', 'ObraDetalhes', 'GestaoObras', 'DiarioObra', 'DiarioCampo',
      'Medicoes', 'MedicaoObraAnalitica', 'MedicaoContratos', 'Suprimentos', 'Compras',
      'Estoque', 'Colaboradores', 'Relatórios', 'RelatoriosObra', 'Agenda', 'Consultas',
      'Notificações', 'Ajustes', 'Cadastros'
    ],
    denyModules: ['TI', 'Administração', 'FinanceiroAvancado'],
    description: 'Obras, diário, medições, equipe e solicitações'
  },

  rh: {
    isSuperAdmin: false,
    label: 'RH / Dep. Pessoal',
    allowModules: [
      'Dashboard', 'RH', 'RecursosHumanos', 'Colaboradores', 'ColaboradorDetalhes',
      'ApontamentoHoras', 'FolhasPagamento', 'GestaoMaoDeObra', 'RelatoriosRH',
      'Pessoas', 'Relatórios', 'Agenda', 'Consultas', 'Notificações', 'Ajustes'
    ],
    denyModules: ['Financeiro', 'FinanceiroAvancado', 'Obras', 'Estoque', 'Compras', 'TI', 'Administração'],
    description: 'Colaboradores, folha, apontamentos, benefícios e relatórios de RH'
  },

  encarregado: {
    isSuperAdmin: false,
    label: 'Encarregado',
    allowModules: [
      'Dashboard', 'Obras', 'ObraDetalhes', 'DiarioObra', 'DiarioCampo', 'Medicoes',
      'Colaboradores', 'Agenda', 'Consultas', 'Notificações', 'Ajustes'
    ],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH', 'Compras'],
    description: 'Diário, presença, fotos, produção e vistoria simples'
  },

  almoxarife: {
    isSuperAdmin: false,
    label: 'Almoxarife',
    allowModules: [
      'Dashboard', 'Estoque', 'MovimentacoesEstoque', 'Suprimentos',
      'Cadastros', 'Insumos', 'Agenda', 'Consultas', 'Notificações', 'Ajustes'
    ],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH', 'Engenharia'],
    description: 'Estoque: entrada, saída e transferência'
  },

  motorista: {
    isSuperAdmin: false,
    label: 'Motorista',
    allowModules: [
      'MinhasViagens', 'SolicitacoesVeiculos', 'Agenda', 'Consultas'
    ],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH', 'Estoques', 'Compras'],
    description: 'Vistoria, movimentação de veículo, km e fotos'
  },

  operacional: {
    isSuperAdmin: false,
    label: 'Operacional',
    allowModules: [
      'Dashboard', 'DiarioObra', 'DiarioCampo', 'Agenda', 'Consultas', 'Notificações', 'Ajustes'
    ],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH', 'Compras', 'Estoques'],
    description: 'Mão de obra: diário e produção da própria obra'
  },

  // ───── Fallback ─────
  geral: {
    isSuperAdmin: false,
    label: 'Geral',
    allowModules: [
      'Dashboard', 'Agenda', 'Consultas', 'Ajustes', 'Notificações'
    ],
    denyModules: ['Financeiro', 'TI', 'Administração', 'RH'],
    description: 'Acesso básico (fallback)'
  }
};

/**
 * Retorna os defaults de um role
 * Nunca retorna undefined - sempre retorna um fallback
 */
export function getRoleDefaults(roleId) {
  if (!roleId) {
    console.warn('[RBAC] getRoleDefaults: roleId vazio, usando "geral"');
    return ROLE_DEFAULTS.geral;
  }

  const normalized = String(roleId).toLowerCase().trim();
  const defaults = ROLE_DEFAULTS[normalized];

  if (!defaults) {
    console.warn(`[RBAC] getRoleDefaults: role "${roleId}" inválida, usando "geral"`);
    return ROLE_DEFAULTS.geral;
  }

  return defaults;
}

/**
 * Verifica se um role é super admin
 */
export function isSuperAdminRole(roleId) {
  const defaults = getRoleDefaults(roleId);
  return defaults.isSuperAdmin === true;
}

/**
 * Calcula set final de módulos permitidos
 * Considera allowAll + denyModules + allowModules específicos
 */
export function getEffectiveModules(roleId) {
  const defaults = getRoleDefaults(roleId);

  if (defaults.allowAll) {
    // Se allowAll, retornar lista completa menos denyModules
    return getAllModules().filter(m => !defaults.denyModules.includes(m));
  }

  // Caso contrário, retornar apenas allowModules
  return defaults.allowModules || [];
}

/**
 * Lista COMPLETA de todos os módulos do sistema
 * (usada para calcular allowAll)
 */
export function getAllModules() {
  return [
    'Dashboard', 'DashboardExecutivo', 'ExecutivoDashboard',
    'Obras', 'ObraDetalhes', 'GestaoObras', 'ObraForm',
    'DiarioObra', 'DiarioCampo',
    'Medicoes', 'MedicaoObraAnalitica', 'MedicaoForm',
    'Financeiro', 'FinanceiroAvancado', 'FinanceiroEstrategico', 'FinanceiroObraAvancado',
    'DashboardFinanceiro', 'DashboardConsolidadoEmpresa',
    'ContasPagar', 'ContasReceber',
    'Lancamentos', 'LancamentosFinanceiros',
    'RelatoriosFinanceiros', 'Relatórios', 'RelatoriosAvancados', 'RelatoriosObra',
    'RelatoriosCompras',
    'Suprimentos', 'SuprimentosAvancado', 'Compras', 'ComprasForm',
    'CotacaoDetalhes', 'RequisicaoForm', 'OrdensCompra', 'OrdemCompra',
    'Estoque', 'MovimentacoesEstoque',
    'Logística', 'LogisticaAvancada', 'MinhasViagens', 'SolicitacoesVeiculos',
    'MonitoramentoViagens', 'RotasMotorista',
    'Equipamentos', 'SolicitacaoEquipamentos',
    'Frota', 'Veiculo', 'VeiculoDetalhes', 'Manutencoes',
    'Fornecedores', 'Pessoas', 'Clientes',
    'Cadastros', 'Insumos', 'Composicoes',
    'RH', 'RecursosHumanos', 'Colaboradores', 'ColaboradorDetalhes',
    'ApontamentoHoras', 'FolhasPagamento', 'GestaoMaoDeObra',
    'RelatoriosRH',
    'Ativos', 'AtivosForm', 'RelatoriosAtivos',
    'Agenda', 'AgendaCalendario',
    'Consultas', 'BuscaGlobal',
    'Ajustes', 'Configuracoes', 'ConfiguracoesSistema', 'GerenciarPermissoes',
    'Usuarios', 'GestaoUsuarios',
    'Notificações', 'MinhasNotificacoes', 'AlertasCompletos',
    'Implementacoes',
    'TI', 'OpsConsole', 'OpsMudancas', 'OpsAprovacoes',
    'Administração', 'AuditoriaLogs', 'StatusSistema'
  ];
}

/**
 * Verifica se usuário tem acesso a um módulo específico
 */
export function canAccessModule(roleId, moduleId) {
  const defaults = getRoleDefaults(roleId);

  // Super admin acessa tudo
  if (defaults.isSuperAdmin) {
    return true;
  }

  // Se está em denyModules, negar
  if (defaults.denyModules && defaults.denyModules.includes(moduleId)) {
    return false;
  }

  // Se allowAll, permitir (já passou no denyModules)
  if (defaults.allowAll) {
    return true;
  }

  // Caso contrário, só permite se está em allowModules
  return defaults.allowModules && defaults.allowModules.includes(moduleId);
}
