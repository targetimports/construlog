/**
 * Definição de menus por PERFIL (não cargo)
 * Sistema RBAC centralizado
 */

export const MENUS_POR_PERFIL = {
  admin: ['*'], // Acesso total
  programador: ['*'], // Super admin - acesso total
  
  engenharia: [
    'DashboardEngenharia',
    'Obras',
    'GestaoObras',
    'OrcamentoAnalitico',
    'Medicoes',
    'DiarioObra',
    'Engenharia',
    'MapaMedicoes',
    'Composicoes',
    'Insumos',
    'Relatorios',
    'RelatoriosObras',
    'GerenciarArquivos',
    'Colaboradores',
    'Equipes',
    'Cronograma'
  ],
  
  compras: [
    'DashboardCompras',
    'Compras',
    'SolicitarCompra',
    'AprovarCompras',
    'OrdensCompra',
    'Fornecedores',
    'Contratos',
    'Estoque', // Leitura
    'SaldoEstoque', // Leitura
    'Relatorios',
    'Insumos'
  ],
  
  almoxarifado: [
    'DashboardAlmoxarifado',
    'Estoque',
    'SaldoEstoque',
    'Depositos',
    'RecebimentoAlmoxarifado',
    'ImportarNotaFiscal',
    'TransferenciaEstoqueObra',
    'ConfirmarRecebimentoTransferencia',
    'MovimentacoesEstoque',
    'Relatorios',
    'Insumos',
    'Compras' // Visualização
  ],
  
  logistica: [
    'DashboardLogistica',
    'MinhasViagens',
    'ViagensAbastecimentos',
    'Frota',
    'Motoristas',
    'RastreamentoGPS',
    'AlertasIA',
    'GestorCustosViagens',
    'DashboardEquipamentos',
    'Equipamentos',
    'SolicitacaoEquipamentos',
    'Manutencoes',
    'Relatorios'
  ],
  
  financeiro: [
    'Dashboard',
    'FinanceiroAvancado',
    'ContasPagar',
    'ContasReceber',
    'DreObra',
    'RelatoriosAvancados',
    'Conciliacao',
    'ExecutivoDashboard',
    'FinanceiroEstrategico',
    'Obras', // Visualização
    'Relatorios',
    'BI',
    'CurvaSFluxoCaixa'
  ],
  
  campo: [
    'DashboardCampo',
    'DiarioObra',
    'ApontamentoHoras',
    'ApontamentoMateriaisSemanal',
    'Equipes',
    'Colaboradores',
    'Obras', // Visualização
    'Estoque', // Leitura
    'Relatorios'
  ],
  
  motorista: [
    'Dashboard',
    'Logistica',
    'MinhasViagens'
  ],

  diretoria: [
    'Dashboard',
    'ExecutivoDashboard',
    'ExecutionDashboard',
    'FinanceiroEstrategico',
    'DreObra',
    'RelatoriosAvancados',
    'BI',
    'CurvaSFluxoCaixa',
    'Obras',
    'GestaoObras',
    'Relatorios',
    'RelatoriosObras',
    'Implementacoes'
  ]
};

/**
 * Obter menus permitidos por perfil
 */
export function obterMenusPorPerfil(perfil, todosMenus) {
  if (!perfil) {
    console.warn('Perfil não definido, usando campo como padrão');
    perfil = 'campo';
  }
  
  // Admin e Programador têm acesso total
  if (perfil === 'admin' || perfil === 'programador') {
    return todosMenus;
  }
  
  const menusPermitidos = MENUS_POR_PERFIL[perfil];
  
  if (!menusPermitidos || menusPermitidos.length === 0) {
    console.warn(`Perfil ${perfil} sem menus configurados, usando fallback`);
    // Fallback: apenas Dashboard e Ajuda
    return todosMenus.filter(menu => ['Dashboard', 'Ajuda', 'Ajustes'].includes(menu.id));
  }
  
  return todosMenus.filter(menu => 
    menusPermitidos.includes(menu.page) || 
    menusPermitidos.includes(menu.id)
  );
}

/**
 * Verificar se perfil pode acessar rota
 */
export function podeAcessarRota(pageName, perfil) {
  if (!perfil) {
    console.warn('Perfil não definido para validação de rota');
    return false;
  }
  
  // Admin e Programador têm acesso total
  if (perfil === 'admin' || perfil === 'programador') {
    return true;
  }
  
  // Páginas de sistema sempre permitidas (exceto Dashboard que é protegido)
  const paginasSistema = ['SemPermissao', 'Ajuda', 'Ajustes', 'Agenda'];
  if (paginasSistema.includes(pageName)) {
    return true;
  }
  
  // Dashboard principal apenas para admin e financeiro
  if (pageName === 'Dashboard' && !['admin', 'financeiro', 'diretoria', 'motorista'].includes(perfil)) {
    return false;
  }
  
  const menusPermitidos = MENUS_POR_PERFIL[perfil];
  
  if (!menusPermitidos) {
    console.warn(`Perfil ${perfil} não encontrado, bloqueando acesso`);
    return false;
  }
  
  return menusPermitidos.includes(pageName);
}