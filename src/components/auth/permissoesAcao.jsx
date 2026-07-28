/**
 * Matriz de Permissões de Ações por Perfil
 * Define o que cada perfil pode fazer em cada módulo
 */

// Perfis do sistema
export const PERFIS = {
  ADMIN: 'admin',
  GESTAO: 'diretoria',
  FINANCEIRO: 'financeiro',
  ENGENHARIA: 'engenharia',
  COMPRAS: 'compras',
  ALMOXARIFADO: 'almoxarifado',
  LOGISTICA: 'logistica',
  CAMPO: 'campo',
  MESTRE_OBRA: 'mestre_obra'
};

// Módulos do sistema
export const MODULOS = {
  OBRAS: 'obras',
  COMPRAS: 'compras',
  ESTOQUE: 'estoque',
  FINANCEIRO: 'financeiro',
  MEDICOES: 'medicoes',
  DIARIO: 'diario',
  VEICULOS: 'veiculos',
  EQUIPAMENTOS: 'equipamentos',
  RH: 'rh',
  DASHBOARD_EXECUTIVO: 'dashboard_executivo',
  DASHBOARD_OPERACIONAL: 'dashboard_operacional'
};

/**
 * Matriz de permissões: { perfil: { modulo: permissoes } }
 */
const MATRIZ_PERMISSOES = {
  // ADMIN - Acesso total
  [PERFIS.ADMIN]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.RH]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: true, pode_aprovar: true },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // GESTÃO/DIRETORIA - Pode aprovar tudo
  [PERFIS.GESTAO]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.RH]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // GESTOR - Gestor de empresa-membro (nível diretoria, escopado à SUA empresa pelo backend)
  gestor: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.RH]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // FINANCEIRO - Aprovação financeira limitada
  [PERFIS.FINANCEIRO]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: true },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: true },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: true },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // ENGENHARIA - Técnico
  [PERFIS.ENGENHARIA]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // COMPRAS - Cotações e solicitações
  [PERFIS.COMPRAS]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // ALMOXARIFADO - Movimentações de estoque
  [PERFIS.ALMOXARIFADO]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // LOGÍSTICA - Veículos e rotas
  [PERFIS.LOGISTICA]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // CAMPO - Apenas visualização e solicitações
  [PERFIS.CAMPO]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  },

  // MESTRE DE OBRA - Gestão de compras da obra
  [PERFIS.MESTRE_OBRA]: {
    [MODULOS.OBRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.COMPRAS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.ESTOQUE]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.FINANCEIRO]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.MEDICOES]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DIARIO]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.VEICULOS]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.EQUIPAMENTOS]: { pode_ver: true, pode_criar: true, pode_editar: true, pode_excluir: false, pode_aprovar: false },
    [MODULOS.RH]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_EXECUTIVO]: { pode_ver: false, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false },
    [MODULOS.DASHBOARD_OPERACIONAL]: { pode_ver: true, pode_criar: false, pode_editar: false, pode_excluir: false, pode_aprovar: false }
  }
};

/**
 * Permissões padrão (mais restritivas)
 */
const PERMISSOES_PADRAO = {
  pode_ver: true,
  pode_criar: false,
  pode_editar: false,
  pode_excluir: false,
  pode_aprovar: false
};

/**
 * Obtém as permissões de ação para um perfil e módulo
 * @param {string} perfil - Perfil do usuário
 * @param {string} modulo - Módulo do sistema
 * @returns {object} Permissões de ação
 */
export function getPermissoesAcao(perfil, modulo) {
  if (!perfil || !modulo) {
    return PERMISSOES_PADRAO;
  }

  // Normalizar perfil
  const perfilNormalizado = perfil.toLowerCase();
  
  // Buscar permissões
  const permissoesPerfil = MATRIZ_PERMISSOES[perfilNormalizado];
  if (!permissoesPerfil) {
    return PERMISSOES_PADRAO;
  }

  const permissoesModulo = permissoesPerfil[modulo];
  return permissoesModulo || PERMISSOES_PADRAO;
}

/**
 * Verifica se usuário pode solicitar (perfis operacionais)
 * @param {string} perfil - Perfil do usuário
 * @param {string} modulo - Módulo do sistema
 * @returns {boolean}
 */
export function podeSolicitar(perfil, modulo) {
  const permissoes = getPermissoesAcao(perfil, modulo);
  // Se não pode criar diretamente mas pode ver, pode solicitar
  return permissoes.pode_ver && !permissoes.pode_criar;
}

/**
 * Retorna o texto do botão adequado (Criar ou Solicitar)
 * @param {string} perfil - Perfil do usuário
 * @param {string} modulo - Módulo do sistema
 * @param {string} textoBase - Texto base (ex: "Requisição")
 * @returns {string}
 */
export function getTextoBotaoAcao(perfil, modulo, textoBase = 'Item') {
  const permissoes = getPermissoesAcao(perfil, modulo);
  
  if (permissoes.pode_criar) {
    return `Criar ${textoBase}`;
  }
  
  if (podeSolicitar(perfil, modulo)) {
    return `Solicitar ${textoBase}`;
  }
  
  return null; // Não pode fazer nenhuma ação
}

/**
 * Verifica se o perfil tem acesso ao Dashboard Executivo
 */
export function podeVerDashboardExecutivo(perfil) {
  const permissoes = getPermissoesAcao(perfil, MODULOS.DASHBOARD_EXECUTIVO);
  return permissoes.pode_ver;
}

/**
 * Verifica se o perfil tem acesso ao Dashboard Operacional
 */
export function podeVerDashboardOperacional(perfil) {
  const permissoes = getPermissoesAcao(perfil, MODULOS.DASHBOARD_OPERACIONAL);
  return permissoes.pode_ver;
}