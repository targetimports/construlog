/**
 * MAPA DE COMPATIBILIDADE: Legacy Keys → New Keys (MODULO_ACAO)
 * 
 * Sistema de transição suave:
 * - Frontend/Backend continuam funcionando com legacy keys
 * - Novas integrações usam newKeys
 * - Ambas retornadas no payload de permissões
 */

// ============ MAPEAMENTO LEGACY → NEW ============
export const legacyToNewKeyMap: Record<string, string[]> = {
  // Dashboard
  Dashboard: ['DASHBOARD_VIEW'],
  Calendario: ['CALENDARIO_VIEW'],

  // Obras
  Obras: ['OBRAS_VIEW'],
  GestaoObras: ['OBRAS_VIEW', 'OBRAS_EDIT'],
  DiarioObra: ['OBRAS_VIEW', 'DIARIO_CREATE'],
  Medicoes: ['MEDICOES_VIEW'],
  MapaMedicoes: ['MEDICOES_VIEW'],
  Engenharia: ['ENGENHARIA_VIEW'],

  // Compras / Suprimentos
  Suprimentos: ['COMPRAS_VIEW'],
  SolicitarCompra: ['COMPRAS_CREATE'],
  Requisicoes: ['COMPRAS_VIEW'],
  AprovarSolicitacoes: ['COMPRAS_APPROVE'],
  Cotacoes: ['COMPRAS_VIEW'],
  OrdensCompra: ['COMPRAS_VIEW'],
  Contratos: ['CONTRATOS_VIEW'],

  // Estoque
  Estoques: ['ESTOQUE_VIEW'],
  EstoquesVisaoGeral: ['ESTOQUE_VIEW'],
  EstoquesSaldo: ['ESTOQUE_VIEW'],
  EstoquesDepositos: ['ESTOQUE_VIEW'],

  // Logística
  Logistica: ['LOGISTICA_VIEW'],
  LogisticaFrota: ['LOGISTICA_VIEW'],
  LogisticaMotoristas: ['LOGISTICA_VIEW'],
  LogisticaViagens: ['LOGISTICA_VIEW'],
  LogisticaMinhasRotas: ['LOGISTICA_VIEW'],
  LogisticaSolicitarTransporte: ['LOGISTICA_CREATE'],

  // Equipamentos
  Equipamentos: ['EQUIPAMENTOS_VIEW'],

  // Financeiro
  Financeiro: ['FINANCEIRO_VIEW'],

  // RH
  RH: ['RH_VIEW'],

  // Relatórios
  Relatorios: ['RELATORIOS_VIEW'],

  // Cadastros
  Cadastros: ['CADASTROS_VIEW'],

  // Administração
  Administracao: ['ADMIN_CONFIG'],
};

// ============ MAPEAMENTO REVERSO: NEW → LEGACY ============
export const newToLegacyKeyMap: Record<string, string[]> = {
  DASHBOARD_VIEW: ['Dashboard'],
  CALENDARIO_VIEW: ['Calendario'],
  OBRAS_VIEW: ['Obras', 'GestaoObras', 'DiarioObra'],
  OBRAS_EDIT: ['GestaoObras'],
  DIARIO_CREATE: ['DiarioObra'],
  MEDICOES_VIEW: ['Medicoes', 'MapaMedicoes'],
  ENGENHARIA_VIEW: ['Engenharia'],
  COMPRAS_VIEW: ['Suprimentos', 'Requisicoes', 'Cotacoes', 'OrdensCompra'],
  COMPRAS_CREATE: ['SolicitarCompra'],
  COMPRAS_APPROVE: ['AprovarSolicitacoes'],
  CONTRATOS_VIEW: ['Contratos'],
  ESTOQUE_VIEW: ['Estoques', 'EstoquesVisaoGeral', 'EstoquesSaldo', 'EstoquesDepositos'],
  LOGISTICA_VIEW: ['Logistica', 'LogisticaFrota', 'LogisticaMotoristas', 'LogisticaViagens', 'LogisticaMinhasRotas'],
  LOGISTICA_CREATE: ['LogisticaSolicitarTransporte'],
  EQUIPAMENTOS_VIEW: ['Equipamentos'],
  FINANCEIRO_VIEW: ['Financeiro'],
  RH_VIEW: ['RH'],
  RELATORIOS_VIEW: ['Relatorios'],
  CADASTROS_VIEW: ['Cadastros'],
  ADMIN_CONFIG: ['Administracao'],
};

// ============ LISTA COMPLETA DE NEW KEYS ============
export const allNewPermissionKeys = [
  'DASHBOARD_VIEW',
  'CALENDARIO_VIEW',
  'OBRAS_VIEW',
  'OBRAS_CREATE',
  'OBRAS_EDIT',
  'OBRAS_DELETE',
  'DIARIO_CREATE',
  'MEDICOES_VIEW',
  'MEDICOES_CREATE',
  'MEDICOES_APPROVE',
  'ENGENHARIA_VIEW',
  'COMPRAS_VIEW',
  'COMPRAS_CREATE',
  'COMPRAS_APPROVE',
  'CONTRATOS_VIEW',
  'ESTOQUE_VIEW',
  'ESTOQUE_CREATE',
  'ESTOQUE_EDIT',
  'LOGISTICA_VIEW',
  'LOGISTICA_CREATE',
  'EQUIPAMENTOS_VIEW',
  'FINANCEIRO_VIEW',
  'FINANCEIRO_APPROVE',
  'RH_VIEW',
  'RELATORIOS_VIEW',
  'CADASTROS_VIEW',
  'PROFILE_EDIT',
  'ADMIN_CONFIG',
];

// ============ FUNÇÕES DE MAPEAMENTO ============

/**
 * Converte uma legacy key para array de new keys
 */
export function mapLegacyToNewKeys(legacyKey: string): string[] {
  const mapped = legacyToNewKeyMap[legacyKey];
  if (!mapped) {
    console.warn(`[WARN] Legacy key "${legacyKey}" não tem mapeamento, retornando vazio`);
    return [];
  }
  return mapped;
}

/**
 * Converte uma new key para array de legacy keys (reverso)
 */
export function mapNewKeyToLegacy(newKey: string): string[] {
  const mapped = newToLegacyKeyMap[newKey];
  return mapped || [];
}

/**
 * Constrói set de novas permissões a partir das legacy permissions
 * Usado por getEffectivePermissionsV2 para retornar ambas
 */
export function buildNewPermissionsFromLegacy(legacyPermissions: Record<string, boolean>): Record<string, boolean> {
  const newPerms: Record<string, boolean> = {};

  // Para cada legacy permission
  Object.entries(legacyPermissions).forEach(([legacyKey, allowed]) => {
    if (!allowed) return; // Skip false permissions

    // Mapear para novas keys
    const newKeys = mapLegacyToNewKeys(legacyKey);
    newKeys.forEach(newKey => {
      newPerms[newKey] = true;
    });
  });

  // Adicionar permissões "default" para todos autenticados
  newPerms['PROFILE_EDIT'] = true;

  return newPerms;
}

/**
 * Validação: lista permissões não mapeadas
 */
export function validateMappingCoverage(legacyKeys: string[]): string[] {
  return legacyKeys.filter(key => !legacyToNewKeyMap[key]);
}

/**
 * Obtém todas as legacy keys únicas
 */
export function getAllLegacyKeys(): string[] {
  return Object.keys(legacyToNewKeyMap);
}