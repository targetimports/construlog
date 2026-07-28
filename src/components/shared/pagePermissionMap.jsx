/**
 * MAPA CENTRAL: PÁGINA → PERMISSION KEY V2
 * 
 * Mapeia nome de página para requiredPermissionKey usado em RouteGuardFinalV2
 * Padrão: PAGE_NAME -> MODULE_ACTION (ex: OBRAS_VIEW, COMPRAS_CREATE)
 */

export const pagePermissionMap = {
  // ==================== DASHBOARD ====================
  'Dashboard': 'DASHBOARD_VIEW',
  'DashboardLogistica': 'LOGISTICA_VIEW',
  'DashboardEngenharia': 'ENGENHARIA_VIEW',
  'DashboardCompras': 'COMPRAS_VIEW',
  'DashboardAlmoxarifado': 'ESTOQUE_VIEW',
  'DashboardCampo': 'RH_VIEW',
  'ExecutivoDashboard': 'FINANCEIRO_VIEW',
  'ExecutionDashboard': 'OBRAS_VIEW',
  'FinanceiroAvancado': 'FINANCEIRO_VIEW',
  'DashboardEquipamentos': 'EQUIPAMENTOS_VIEW',

  // ==================== CALENDÁRIO ====================
  'Agenda': 'CALENDARIO_VIEW',
  'ApontamentoMateriaisSemanal': 'CALENDARIO_VIEW',

  // ==================== OBRAS ====================
  'Obras': 'OBRAS_VIEW',
  'ObraDetalhes': 'OBRAS_VIEW',
  'ObraForm': 'OBRAS_CREATE',
  'GestaoObras': 'OBRAS_EDIT',
  'DiarioObra': 'DIARIO_CREATE',
  'GestaoObrasAvancada': 'OBRAS_EDIT',

  // ==================== ENGENHARIA & QUALIDADE ====================
  'Engenharia': 'ENGENHARIA_VIEW',
  'EngenhariaeQualidade': 'ENGENHARIA_VIEW',

  // ==================== MEDIÇÕES ====================
  'Medicoes': 'MEDICOES_VIEW',
  'MedicaoForm': 'MEDICOES_CREATE',
  'MapaMedicoes': 'MEDICOES_VIEW',
  'MedicoesObra': 'MEDICOES_VIEW',
  'MedicaoObraAnalitica': 'MEDICOES_CREATE',
  'MedicaoContratos': 'MEDICOES_VIEW',
  'MedicaoComOrcamento': 'MEDICOES_CREATE',

  // ==================== COMPRAS ====================
  'Compras': 'COMPRAS_VIEW',
  'SolicitarCompra': 'COMPRAS_CREATE',
  'Requisicoes': 'COMPRAS_VIEW',
  'SolicitacaoDetalhes': 'COMPRAS_VIEW',
  'SolicitacaoForm': 'COMPRAS_CREATE',
  'Cotacoes': 'COMPRAS_VIEW',
  'CotacaoDetalhes': 'COMPRAS_VIEW',
  'OrdensCompra': 'COMPRAS_VIEW',
  'CompraDetalhes': 'COMPRAS_VIEW',
  'AprovarCompras': 'COMPRAS_APPROVE',
  'AprovacaoCompras': 'COMPRAS_APPROVE',
  'AprovacaoMaquinas': 'LOGISTICA_VIEW',

  // ==================== CONTRATOS ====================
  'Contratos': 'CONTRATOS_VIEW',
  'ContratoDetalhes': 'CONTRATOS_VIEW',
  'ContratoForm': 'CONTRATOS_CREATE',
  'ContratosAvancado': 'CONTRATOS_VIEW',

  // ==================== ESTOQUE ====================
  'Estoque': 'ESTOQUE_VIEW',
  'MovimentacoesEstoque': 'ESTOQUE_VIEW',
  'Almoxarifados': 'ESTOQUE_VIEW',
  'Depositos': 'ESTOQUE_VIEW',
  'SaldoEstoque': 'ESTOQUE_VIEW',
  'RecebimentoAlmoxarifado': 'ESTOQUE_CREATE',
  'ImportarNotaFiscal': 'ESTOQUE_CREATE',
  'TransferenciaEstoqueObra': 'ESTOQUE_EDIT',
  'ConfirmarRecebimentoTransferencia': 'ESTOQUE_EDIT',
  'RelatoriosEstoqueAvancado': 'RELATORIOS_VIEW',

  // ==================== LOGÍSTICA & FROTA ====================
  'MinhasViagens': 'LOGISTICA_VIEW',
  'ViagensAbastecimentos': 'LOGISTICA_VIEW',
  'SolicitacoesVeiculos': 'LOGISTICA_CREATE',
  'SolicitacoesMaquinas': 'LOGISTICA_CREATE',
  'Frota': 'LOGISTICA_VIEW',
  'CadastroVeiculos': 'LOGISTICA_VIEW',
  'Motoristas': 'LOGISTICA_VIEW',
  'RastreamentoGPS': 'LOGISTICA_VIEW',
  'GestorCustosViagens': 'FINANCEIRO_VIEW',
  'RotasMotorista': 'LOGISTICA_VIEW',
  'Telemetria': 'LOGISTICA_VIEW',
  'TelemetriaVeiculo': 'LOGISTICA_VIEW',
  'VisualizadorRotasAvancado': 'LOGISTICA_VIEW',
  'MonitoramentoViagens': 'LOGISTICA_VIEW',
  'ViagensPorAbastecer': 'LOGISTICA_VIEW',
  'LogisticaAvancada': 'LOGISTICA_VIEW',

  // ==================== EQUIPAMENTOS ====================
  'Equipamentos': 'EQUIPAMENTOS_VIEW',
  'SolicitacaoEquipamentos': 'EQUIPAMENTOS_VIEW',
  'Manutencoes': 'EQUIPAMENTOS_VIEW',

  // ==================== FINANCEIRO ====================
  'Lancamentos': 'FINANCEIRO_VIEW',
  'ContasPagar': 'FINANCEIRO_VIEW',
  'ContasReceber': 'FINANCEIRO_VIEW',
  'Conciliacao': 'FINANCEIRO_VIEW',
  'DreObra': 'FINANCEIRO_VIEW',
  'FinanceiroEstrategico': 'FINANCEIRO_VIEW',
  'FinanceiroObraAvancado': 'FINANCEIRO_VIEW',
  'CurvaSFluxoCaixa': 'FINANCEIRO_VIEW',

  // ==================== RH & PESSOAS ====================
  'Colaboradores': 'RH_VIEW',
  'ColaboradorDetalhes': 'RH_VIEW',
  'Equipes': 'RH_VIEW',
  'GestaoMaoDeObra': 'RH_VIEW',
  'ApontamentoHoras': 'RH_VIEW',
  'ControleHorasAtivos': 'RH_VIEW',
  'CustoHoraColaboradores': 'RH_VIEW',
  'ApontamentosObrigatorios': 'RH_VIEW',
  'ControleEPIs': 'RH_VIEW',
  'SST': 'RH_VIEW',
  'ProfissionaisTerceirizados': 'RH_VIEW',
  'FolhasPagamento': 'RH_VIEW',

  // ==================== CADASTROS ====================
  'Clientes': 'CADASTROS_VIEW',
  'Fornecedores': 'CADASTROS_VIEW',
  'BaseCustos': 'CADASTROS_VIEW',
  'BasesPrecos': 'CADASTROS_VIEW',
  'AtualizarPrecos': 'CADASTROS_VIEW',
  'Insumos': 'CADASTROS_VIEW',
  'Composicoes': 'CADASTROS_VIEW',
  'GruposInsumos': 'CADASTROS_VIEW',
  'Ativos': 'CADASTROS_VIEW',
  'RelatoriosAtivos': 'RELATORIOS_VIEW',

  // ==================== RELATÓRIOS ====================
  'Relatorios': 'RELATORIOS_VIEW',
  'RelatoriosObras': 'RELATORIOS_VIEW',
  'RelatoriosAvancados': 'RELATORIOS_VIEW',
  'RelatoriosAgendados': 'RELATORIOS_VIEW',
  'BI': 'RELATORIOS_VIEW',
  'BICompras': 'RELATORIOS_VIEW',
  'BIMultiobras': 'RELATORIOS_VIEW',
  'DashboardPersonalizado': 'RELATORIOS_VIEW',

  // ==================== ADMINISTRAÇÃO & OPS ====================
  'GestaoUsuarios': 'ADMIN_CONFIG',
  'AprovacaoUsuarios': 'ADMIN_CONFIG',
  'GerenciarPermissoes': 'ADMIN_CONFIG',
  'OpsConsole': 'ADMIN_CONFIG',
  'OpsCertificacao': 'ADMIN_CONFIG',
  'OpsMudancas': 'ADMIN_CONFIG',
  'OpsRunbook': 'ADMIN_CONFIG',
  'Producao': 'ADMIN_CONFIG',
  'SaudeSistema': 'ADMIN_CONFIG',
  'Auditoria': 'ADMIN_CONFIG',
  'Rollbacks': 'ADMIN_CONFIG',

  // ==================== AJUSTES ====================
  'AjustesPessoais': 'PROFILE_EDIT',
  'AjustesGlobais': 'ADMIN_CONFIG',
  'ConfiguracaoFluxoAprovacao': 'ADMIN_CONFIG',
  'Configuracao': 'ADMIN_CONFIG',

  // ==================== PÚBLICAS (null = sem requisito) ====================
  'Ajuda': null,
  'Atalhos': null,
  'GerenciadorAtalhos': null,
  'MinhasNotificacoes': null,
  'AssistenteOperacionalIA': null,
  'SupervisorOperacional': null,
  'IAPreditiva': null,
  'AlertasIA': null,
  'BuscaGlobal': null,
  'TimelineObra': null,

  // ==================== PÁGINAS DE ERRO ====================
  'SemPermissao': null,
  'PageNotFound': null,

  // ==================== MIGRAÇÃO/DESENVOLVIMENTO ====================
  'EmDesenvolvimento': 'DASHBOARD_VIEW',
  'Implementacoes': 'ADMIN_CONFIG'
};

/**
 * Função helper: obter permission para uma página
 * @param {string} pageName - nome da página (sem extensão)
 * @returns {string|null} - requiredPermissionKey ou null se pública
 */
export function getPermissionForPage(pageName) {
  return pagePermissionMap[pageName] || null;
}

/**
 * Função helper: validar se página está mapeada
 * @param {string} pageName - nome da página
 * @returns {boolean} - true se está no mapa
 */
export function isPageMapped(pageName) {
  return pageName in pagePermissionMap;
}