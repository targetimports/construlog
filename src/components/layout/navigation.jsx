import {
  LayoutDashboard,
  Building2,
  Truck,
  DollarSign,
  Users,
  FileText,
  Settings,
  BarChart3,
  ShoppingCart,
  ClipboardList,
  MessageCircleQuestion,
  Wrench,
  Warehouse,
  Package,
  Lightbulb,
  BookOpen,
  Calendar,
  Bell,
  Bolt,
  UserCircle
} from 'lucide-react';

// ============ MENU PRINCIPAL COM GRUPOS INTERNOS ============
export const menuItems = [
  // 1. DASHBOARD (Operacional - todos os perfis)
  {
   id: 'dashboard',
   name: 'Dashboard',
   icon: LayoutDashboard,
   page: 'Dashboard',
   shortcutable: true,
   requiredPermissionKey: 'DASHBOARD_VIEW'
  },
  
  // 1.1 DASHBOARDS ESPECÍFICOS (hidden, redireciona automaticamente por role)
  {
    id: 'dashboard-engenharia',
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'DashboardEngenharia',
    shortcutable: true,
    requiredPermissionKey: 'ENGENHARIA_VIEW',
    visivel: false
  },
  {
    id: 'dashboard-compras',
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'DashboardCompras',
    shortcutable: true,
    requiredPermissionKey: 'COMPRAS_VIEW',
    visivel: false
  },
  {
    id: 'dashboard-almoxarifado',
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'DashboardAlmoxarifado',
    shortcutable: true,
    requiredPermissionKey: 'ESTOQUE_VIEW',
    visivel: false
  },
  {
    id: 'dashboard-logistica',
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'DashboardLogistica',
    shortcutable: true,
    requiredPermissionKey: 'LOGISTICA_VIEW',
    visivel: false
  },
  {
    id: 'dashboard-campo',
    name: 'Dashboard',
    icon: LayoutDashboard,
    page: 'DashboardCampo',
    shortcutable: true,
    requiredPermissionKey: 'RH_VIEW',
    visivel: false
  },

  // 1.1 CALENDÁRIO
  {
    id: 'calendario',
    name: 'Calendário',
    icon: Calendar,
    page: 'Agenda',
    shortcutable: true,
    requiredPermissionKey: 'CALENDARIO_VIEW'
  },

  // 2. OBRAS
  {
    id: 'obras',
    name: 'Obras',
    icon: Building2,
    page: 'Obras',
    shortcutable: true,
    requiredPermissionKey: 'OBRAS_VIEW',
    groups: [
      {
        id: 'obras-listagem',
        title: 'Obras',
        items: [
          { id: 'obras-todas', name: 'Todas as Obras', page: 'Obras', shortcutable: true, requiredPermissionKey: 'OBRAS_VIEW' }
        ]
      },
      {
        id: 'obras-orcamentos',
        title: 'Orçamentos',
        items: [
          { id: 'obras-orcamentos-visao', name: 'Visão Geral de Orçamentos', page: 'Orcamentos', shortcutable: true, requiredPermissionKey: 'ORCAMENTO_VIEW' }
        ]
      },
      {
        id: 'obras-execucao',
        title: 'Execução',
        items: [
          { id: 'obras-diario', name: 'Diário de Obra', page: 'DiarioObra', shortcutable: true, requiredPermissionKey: 'DIARIO_CREATE' }
        ]
      },
      {
        id: 'obras-contratos',
        title: 'Contratos',
        items: [
          { id: 'obras-contratos-lista', name: 'Contratos', page: 'Contratos', shortcutable: true, requiredPermissionKey: 'CONTRATOS_VIEW' }
        ]
      },
      {
        id: 'obras-bases',
        title: 'Bases & Custos',
        items: [
          { id: 'obras-atualizar-precos', name: 'Atualizar Preços', page: 'AtualizarPrecos', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' },
          { id: 'obras-importar-sinapi', name: 'Importar SINAPI', page: 'ImportarSINAPI', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' },
          { id: 'obras-tabela-sinapi', name: 'Tabela SINAPI', page: 'TabelaSINAPI', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' }
        ]
      }
      ]
      },

  // 3. SUPRIMENTOS (COMPRAS + ESTOQUE unificados)
  {
    id: 'suprimentos',
    name: 'Compras',
    icon: ShoppingCart,
    page: 'SuprimentosDashboard',
    shortcutable: true,
    requiredPermissionKey: 'COMPRAS_VIEW',
    groups: [
      {
        id: 'suprimentos-visao',
        title: 'Visão Geral',
        items: [
          { id: 'suprimentos-dashboard', name: 'Dashboard Compras', page: 'SuprimentosDashboard', shortcutable: true, requiredPermissionKey: 'COMPRAS_VIEW' }
        ]
      },
      {
        id: 'suprimentos-cadastros',
        title: 'Cadastros',
        items: [
          { id: 'suprimentos-insumos', name: 'Insumos', page: 'Insumos', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' },
          { id: 'suprimentos-fornecedores', name: 'Fornecedores', page: 'SuprimentosFornecedores', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' }
        ]
      },
      {
        id: 'suprimentos-compras-fluxo',
        title: 'Fluxo de Compras',
        items: [
          { id: 'suprimentos-solicitacoes', name: 'Solicitações de Compra', page: 'SuprimentosSolicitacoes', shortcutable: true, requiredPermissionKey: 'COMPRAS_VIEW' },
          { id: 'suprimentos-pedidos', name: 'Pedidos de Compra', page: 'SuprimentosPedidos', shortcutable: true, requiredPermissionKey: 'COMPRAS_VIEW' },
          { id: 'suprimentos-recebimentos', name: 'Recebimentos', page: 'SuprimentosRecebimentos', shortcutable: true, requiredPermissionKey: 'ESTOQUE_CREATE' }
        ]
      },
      {
        id: 'suprimentos-consumo',
        title: 'Consumo & Movimentação',
        items: [
          { id: 'suprimentos-transferencias', name: 'Transferências', page: 'SuprimentosTransferencias', shortcutable: true, requiredPermissionKey: 'ESTOQUE_EDIT' }
        ]
      },
      {
        id: 'suprimentos-relatorios',
        title: 'Relatórios',
        items: [
          { id: 'suprimentos-relatorios-view', name: 'Relatórios de Compras', page: 'SuprimentosRelatorios', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' }
        ]
      }
      // "Entregas (Romaneio)" (SuprimentosEntregas) removido do menu: era o sistema
      // de entrega ANTIGO, paralelo ao "Viagens de Entrega" novo, e dava entrada de
      // estoque fora do botão Receber (corrompia o saldo). Material sempre entra pelo
      // Receber, com vistoria. A página segue existindo só por rota, sem link.
      ]
      },

  // 3.5 NOTAS FISCAIS (Menu dedicado)
  {
    id: 'notas-fiscais',
    name: 'Notas Fiscais',
    icon: ClipboardList,
    page: 'NotasFiscais',
    shortcutable: true,
    requiredPermissionKey: 'COMPRAS_VIEW',
    groups: [
      {
        id: 'nf-listagem',
        title: 'Notas Fiscais',
        items: [
          { id: 'nf-todas', name: 'Todas as Notas Fiscais', page: 'NotasFiscais', shortcutable: true, requiredPermissionKey: 'COMPRAS_VIEW' },
          { id: 'nf-emitir-importar', name: 'Importar NF', page: 'NovaNotaFiscal', shortcutable: true, requiredPermissionKey: 'COMPRAS_CREATE' },
          { id: 'nf-revisar', name: 'Revisar NF', page: 'RevisarNotaFiscal', shortcutable: true, requiredPermissionKey: 'COMPRAS_VIEW' }
        ]
      }
    ]
  },

  // 4. ESTOQUE
  {
    id: 'estoque',
    name: 'Estoque',
    icon: Warehouse,
    // Clicar na seção abre Almoxarifados (o item que ficou em primeiro). Saldo de
    // Estoque saiu do menu, mas continua acessível pelos links de dentro dos
    // almoxarifados e do dashboard — é uma tela de detalhe, não de entrada.
    page: 'Almoxarifados',
    shortcutable: true,
    requiredPermissionKey: 'ESTOQUE_VIEW',
    groups: [
      {
        id: 'estoque-dashboard',
        title: 'Visão Geral',
        items: [
          // Almoxarifados primeiro: é o cadastro dos LOCAIS onde o estoque mora
          // (Central, Empresa, Obra). Sem ele, saldo e movimentação não têm onde cair.
          { id: 'estoque-almoxarifados', name: 'Almoxarifados', page: 'Almoxarifados', shortcutable: true, requiredPermissionKey: 'ESTOQUE_VIEW' },
          { id: 'estoque-profissional', name: 'Dashboard Estoque', page: 'EstoqueProfissional', shortcutable: true, badge: 'Novo', requiredPermissionKey: 'ESTOQUE_VIEW', allowedRoles: ['admin', 'programador', 'admin_empresa', 'diretor', 'almoxarife', 'compras'] }
        ]
      },
      {
        id: 'estoque-central',
        title: 'Estoque Central',
        items: [
          { id: 'estoque-movimentacoes', name: 'Movimentações', page: 'MovimentacoesEstoque', shortcutable: true, requiredPermissionKey: 'ESTOQUE_VIEW', allowedRoles: ['admin', 'programador', 'admin_empresa', 'diretor', 'almoxarife', 'compras'] }
        ]
      },
      {
        id: 'estoque-obras',
        title: 'Estoque por Obra',
        items: [
          { id: 'estoque-requisicoes', name: 'Requisições de Material', page: 'SuprimentosRequisicoes', shortcutable: true, requiredPermissionKey: 'ESTOQUE_VIEW' }
        ]
      }
    ]
  },


  // 7. FINANÇAS
  {
    id: 'financeiro',
    name: 'Financeiro',
    icon: DollarSign,
    page: 'Financeiro',
    shortcutable: true,
    requiredPermissionKey: 'FINANCEIRO_VIEW',
    groups: [
      {
        id: 'financeiro-geral',
        title: 'Financeiro',
        items: [
          { id: 'financeiro-painel', name: 'Painel Financeiro', page: 'Financeiro', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW' },
          { id: 'financeiro-contas-pagar', name: 'Contas a Pagar', page: 'ContasPagar', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW', allowedRoles: ['admin', 'programador', 'diretor', 'financeiro'] },
          { id: 'financeiro-contas-receber', name: 'Contas a Receber', page: 'ContasReceber', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW', allowedRoles: ['admin', 'programador', 'diretor', 'financeiro'] },
          { id: 'financeiro-lancamentos', name: 'Lançamentos', page: 'LancamentosFinanceiros', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW' },
          { id: 'financeiro-conciliacao', name: 'Conciliação', page: 'Conciliacao', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW' },
          { id: 'financeiro-tesouraria', name: 'Caixa e Bancos', page: 'Tesouraria', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW' },
          { id: 'financeiro-consolidado', name: 'Consolidado', page: 'ConsolidadoFinanceiroV2', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_VIEW' }
        ]
      },
      {
        id: 'financeiro-cadastros',
        title: 'Cadastros',
        items: [
          { id: 'financeiro-clientes', name: 'Clientes', page: 'Clientes', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' }
        ]
      },
      {
        id: 'financeiro-importacao',
        title: 'Importação',
        items: [
          { id: 'financeiro-importar-planilha', name: 'Importar Planilha', page: 'ImportarPlanilhaFinanceira', shortcutable: true, requiredPermissionKey: 'FINANCEIRO_EDIT' }
        ]
      }
    ]
  },

  // 9. RH & PESSOAS
  {
    id: 'rh',
    name: 'RH & Pessoas',
    icon: Users,
    page: 'Colaboradores',
    shortcutable: true,
    requiredPermissionKey: 'RH_VIEW',
    groups: [
      {
        id: 'rh-gestao',
        title: 'Gestão',
        items: [
          { id: 'rh-colaboradores', name: 'Colaboradores', page: 'Colaboradores', shortcutable: true, requiredPermissionKey: 'RH_VIEW' },
          { id: 'rh-gestao-mao-obra', name: 'Gestão de Mão de Obra', page: 'GestaoMaoDeObra', shortcutable: true, requiredPermissionKey: 'RH_VIEW' }
        ]
      },
      {
        id: 'rh-rotina',
        title: 'Rotina',
        items: [
          { id: 'rh-apontamento-horas', name: 'Apontamento de Horas', page: 'ApontamentoHoras', shortcutable: true, requiredPermissionKey: 'RH_VIEW' },
          { id: 'rh-custo-hora', name: 'Custo Hora', page: 'CustoHoraColaboradores', shortcutable: true, requiredPermissionKey: 'RH_VIEW' }
        ]
      },
      {
        id: 'rh-seguranca',
        title: 'Segurança',
        items: [
          { id: 'rh-controle-epis', name: 'Controle de EPIs', page: 'ControleEPIs', shortcutable: true, requiredPermissionKey: 'RH_VIEW' },
          { id: 'rh-sst', name: 'Segurança do Trabalho', page: 'SST', shortcutable: true, requiredPermissionKey: 'RH_VIEW' }
        ]
      },
      {
        id: 'rh-terceiros',
        title: 'Terceiros',
        items: [
          { id: 'rh-terceirizados', name: 'Profissionais Terceirizados', page: 'ProfissionaisTerceirizados', shortcutable: true, requiredPermissionKey: 'RH_VIEW' }
        ]
      },
      {
        id: 'rh-folha',
        title: 'Folha de Pagamento',
        items: [
          { id: 'rh-folhas', name: 'Folhas de Pagamento', page: 'FolhasPagamento', shortcutable: true, requiredPermissionKey: 'RH_VIEW' }
        ]
      }
    ]
  },



  // 11. RELATÓRIOS
  {
    id: 'relatorios',
    name: 'Relatórios',
    icon: BarChart3,
    page: 'BI',
    shortcutable: true,
    requiredPermissionKey: 'RELATORIOS_VIEW',
    groups: [
      {
        id: 'relatorios-gestao',
        title: 'Gestão',
        items: [
          { id: 'relatorios-obras', name: 'Relatórios de Obras', page: 'RelatoriosObras', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' },
          { id: 'relatorios-gerenciais', name: 'Relatórios Gerenciais', page: 'Relatorios', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' },
          { id: 'relatorios-avancados', name: 'Relatórios Avançados', page: 'RelatoriosAvancados', shortcutable: true, badge: 'Novo', requiredPermissionKey: 'RELATORIOS_VIEW' },
          { id: 'relatorios-agendados', name: 'Relatórios Agendados', page: 'RelatoriosAgendados', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' }
        ]
      },
      {
        id: 'relatorios-bi',
        title: 'BI',
        items: [
          { id: 'relatorios-bi-view', name: 'Business Intelligence', page: 'BI', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' },
          { id: 'relatorios-curva-s', name: 'Curva S & Fluxo de Caixa', page: 'CurvaSFluxoCaixa', shortcutable: true, badge: 'Novo', requiredPermissionKey: 'RELATORIOS_VIEW' }
        ]
      },
      ]
      },

  // 13. LOGÍSTICA & FROTA (modelo novo: Ativo Único + Empréstimo + Manutenção)
  {
    id: 'ativos',
    name: 'Logística & Frota',
    icon: Truck,
    page: 'Ativos',
    shortcutable: true,
    // Porta da seção = EQUIPAMENTOS_VIEW (era CADASTROS_VIEW). Motivo: o MOTORISTA
    // precisa chegar em "Viagens de Entrega", que mora aqui, e ele não tem
    // CADASTROS_VIEW. Ninguém perde acesso: quem tem CADASTROS_VIEW sem
    // EQUIPAMENTOS_VIEW (financeiro, almoxarife) não tinha esta seção de qualquer
    // forma — ela não está no ROLE_SECTIONS desses perfis.
    requiredPermissionKey: 'EQUIPAMENTOS_VIEW',
    groups: [
      {
        id: 'ativos-gestao',
        title: 'Gestão de Ativos',
        items: [
          { id: 'ativos-todos', name: 'Todos os Ativos', page: 'Ativos', shortcutable: true, requiredPermissionKey: 'CADASTROS_VIEW' },
          { id: 'ativos-dashboard', name: 'Relatórios de Ativos', page: 'RelatoriosAtivos', shortcutable: true, requiredPermissionKey: 'RELATORIOS_VIEW' }
        ]
      },
      {
        id: 'ativos-frota',
        title: 'Frota & Equipamentos',
        items: [
          { id: 'ativos-emprestimos', name: 'Empréstimo de Ativos', page: 'EmprestimosAtivos', shortcutable: true, requiredPermissionKey: 'EQUIPAMENTOS_VIEW' },
          { id: 'ativos-manutencao', name: 'Manutenção', page: 'ManutencaoAtivos', shortcutable: true, requiredPermissionKey: 'EQUIPAMENTOS_VIEW' },
          // Entregas de material com veículo da empresa — é a tela do motorista.
          { id: 'ativos-viagens', name: 'Viagens de Entrega', page: 'ViagensEntregas', shortcutable: true, requiredPermissionKey: 'LOGISTICA_VIEW' }
        ]
      },
    ]
  },


  // 15. TI (ADMIN_CONFIG ONLY)
  {
    id: 'ti',
    name: 'TI',
    icon: Settings,
    page: 'SaudeSistema',
    shortcutable: false,
    requiredPermissionKey: 'ADMIN_CONFIG',
    groups: [
      {
        id: 'ti-producao',
        title: 'Produção',
        items: [
          { id: 'producao-saude', name: 'Saúde do Sistema', page: 'SaudeSistema', shortcutable: false, requiredPermissionKey: 'ADMIN_CONFIG' },
          { id: 'producao-logs', name: 'Log do Sistema', page: 'LogsSistema', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      },
      {
        id: 'ti-implementacoes',
        title: 'Implementações',
        items: [
          { id: 'implementacoes-main', name: 'Implementações', page: 'Implementacoes', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      },
      {
        id: 'ti-consultas',
        title: 'Consultas',
        items: [
          { id: 'consultas-timeline', name: 'Timeline da Obra', page: 'TimelineObra', shortcutable: true, requiredPermissionKey: 'OBRAS_VIEW' }
        ]
      },
      {
        id: 'ti-auditoria',
        title: 'Auditoria & Dados',
        items: [
          { id: 'admin-auditoria', name: 'Auditoria e Logs', page: 'Auditoria', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      },
      {
        id: 'ti-ferramentas',
        title: 'Ferramentas',
        items: [
          { id: 'ferramentas-admin', name: 'Testes Automatizados', page: 'FerramentasAdmin', shortcutable: false, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      }
      ]
      },

  // (18. ASSISTENTES IA — seção aposentada do menu; rotas/páginas mantidas)

  // 19. ATALHOS (PUBLIC)
  {
    id: 'atalhos',
    name: 'Atalhos',
    icon: Bolt,
    page: 'GerenciadorAtalhos',
    shortcutable: true,
    requiredPermissionKey: null
  },

  // 20. NOTIFICAÇÕES (PUBLIC)
  {
    id: 'notificacoes-usuario',
    name: 'Notificações',
    icon: Bell,
    page: 'MinhasNotificacoes',
    shortcutable: true,
    requiredPermissionKey: null
  },

  // 20.1 MEU PERFIL (todos os perfis — dados pessoais, foto e senha)
  {
    id: 'meu-perfil',
    name: 'Meu Perfil',
    icon: UserCircle,
    page: 'AjustesPessoais',
    shortcutable: true,
    requiredPermissionKey: 'PROFILE_EDIT'
  },

  // 20. CONFIGURAÇÕES
  {
    id: 'configuracoes',
    name: 'Configurações',
    icon: Settings,
    page: 'Configuracoes',
    shortcutable: true,
    requiredPermissionKey: 'ADMIN_CONFIG',
    groups: [
      {
        id: 'configuracoes-seguranca',
        title: 'Segurança',
        items: [
          { id: 'configuracoes-usuarios', name: 'Usuários', page: 'Usuarios', shortcutable: false, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      },
      {
        id: 'configuracoes-gerais',
        title: 'Gerais',
        items: [
          { id: 'configuracoes-empresas', name: 'Empresas do Grupo', page: 'Empresas', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' },
          { id: 'configuracoes-empresa', name: 'Identidade / Branding', page: 'ConfiguracoesEmpresa', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' },
          { id: 'configuracoes-sistema', name: 'Sistema', page: 'ConfiguracoesSistema', shortcutable: true, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      },
      {
        id: 'configuracoes-ajustes',
        title: 'Ajustes',
        items: [
          { id: 'ajustes-globais', name: 'Ajustes Globais', page: 'AjustesGlobais', shortcutable: false, requiredPermissionKey: 'ADMIN_CONFIG' }
        ]
      }
    ]
  },

  // 21. AJUDA — última do menu, como rodapé. Sem requiredPermissionKey de
  // propósito: ajuda tem de estar disponível para qualquer perfil, inclusive o
  // motorista e o operacional.
  {
    id: 'ajuda',
    name: 'Ajuda',
    icon: MessageCircleQuestion,
    page: 'Ajuda',
    shortcutable: true,
    requiredPermissionKey: null,
  }
];

// ============ REDIRECTS (ROTAS ANTIGAS → NOVAS) ============
export const routeRedirects = {
  'RHColaboradores': 'Colaboradores',
  'ObrasSolicitacoesCompra': 'SolicitarCompra',
  'ObrasAgendamentoEquipamentos': 'SolicitacaoEquipamentos',
  'AdminConciliacao': 'Conciliacao',
  'DashboardGeral': 'Dashboard',
  'FinanceiroAvancado': 'Financeiro',
  'Estoque': 'SaldoEstoque'
};

// ALL PAGES NOW USE: RouteGuardFinalV2 + useCanAccess() from RBACContext
// All menu items have requiredPermissionKey (null = public)
// Sidebar filtering uses SidebarFilteredByPermissions + effectivePermissionsV2
// Fail-closed: no permission = no access (enforced in RBACContext)