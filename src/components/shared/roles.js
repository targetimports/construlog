/**
 * Catálogo central de PERFIS DE ACESSO (roles), alinhado ao plano (§31).
 * Perfis: Admin, Financeiro, Supervisor, Encarregado, Almoxarife, Motorista
 * + Operacional (mão de obra de campo: pedreiro, servente, etc.).
 *
 * ROLES        → catálogo para a UI (select de perfil, badges).
 * ROLE_PERMISSIONS → matriz CANÔNICA de permissões por perfil (chaves OBRAS_VIEW, etc.).
 *   Hoje serve de referência/documentação; será ligada ao runtime quando o RBAC
 *   for portado ao backend (getEffectivePermissionsV2). Não há outra cópia.
 */

export const ROLES = [
  { value: 'admin', label: 'Administrador', descricao: 'Acesso total ao sistema', color: 'bg-purple-100 text-purple-700' },
  { value: 'gestor', label: 'Gestor de Empresa', descricao: 'Gestão operacional completa da sua empresa (obras, compras, estoque, financeiro)', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'financeiro', label: 'Financeiro', descricao: 'Caixa, recebimentos, pagamentos, ativação de obra e reservas', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'supervisor', label: 'Supervisor', descricao: 'Obras, diário, medições, equipe e solicitações', color: 'bg-blue-100 text-blue-700' },
  { value: 'rh', label: 'RH / Dep. Pessoal', descricao: 'Colaboradores, folha, apontamentos, benefícios e relatórios de RH', color: 'bg-pink-100 text-pink-700' },
  { value: 'encarregado', label: 'Encarregado', descricao: 'Diário, presença, fotos, produção e vistoria simples', color: 'bg-amber-100 text-amber-700' },
  { value: 'almoxarife', label: 'Almoxarife', descricao: 'Estoque: entrada, saída e transferência', color: 'bg-orange-100 text-orange-700' },
  { value: 'motorista', label: 'Motorista', descricao: 'Vistoria, movimentação de veículo, km e fotos', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'operacional', label: 'Operacional (Campo)', descricao: 'Mão de obra: registrar diário/produção da própria obra', color: 'bg-gray-100 text-gray-600' },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));
export const ROLE_BY_VALUE = Object.fromEntries(ROLES.map((r) => [r.value, r]));

// Matriz de permissões por perfil (chaves consistentes com defaultPermissions).
export const ROLE_PERMISSIONS = {
  admin: {
    OBRAS_VIEW: true, OBRAS_CREATE: true, OBRAS_EDIT: true, OBRAS_DELETE: true,
    ORCAMENTO_VIEW: true, ORCAMENTO_CREATE: true, ORCAMENTO_IMPORT: true,
    MEDICAO_VIEW: true, MEDICAO_CREATE: true, MEDICAO_APPROVE: true,
    SUPRIMENTOS_VIEW: true, SUPRIMENTOS_CREATE: true, SUPRIMENTOS_EDIT: true, SUPRIMENTOS_APPROVE: true,
    ESTOQUE_VIEW: true, ESTOQUE_EDIT: true, ESTOQUE_TRANSFER: true,
    LOGISTICA_VIEW: true, LOGISTICA_CREATE: true, LOGISTICA_APPROVE: true,
    EQUIPAMENTOS_VIEW: true, EQUIPAMENTOS_MANAGE: true,
    FINANCEIRO_VIEW: true, FINANCEIRO_EDIT: true, FINANCEIRO_APPROVE: true, FINANCEIRO_CONCILIAR: true,
    RH_VIEW: true, RH_EDIT: true, COLABORADORES_VIEW: true, COLABORADORES_MANAGE: true,
    CAMPO_VIEW: true, CAMPO_APONTAMENTO: true,
    RELATORIOS_VIEW: true, RELATORIOS_CUSTOM: true,
    ATIVOS_VIEW: true, ATIVOS_MANAGE: true,
    GESTAO_USUARIOS: true, GESTAO_PERMISSOES: true, GESTAO_EMPRESAS: true, CONFIGURACAO_SISTEMA: true,
  },
  financeiro: {
    OBRAS_VIEW: true, OBRAS_EDIT: true, // ativa obra
    ORCAMENTO_VIEW: true,
    MEDICAO_VIEW: true,
    SUPRIMENTOS_VIEW: true,
    FINANCEIRO_VIEW: true, FINANCEIRO_EDIT: true, FINANCEIRO_APPROVE: true, FINANCEIRO_CONCILIAR: true,
    COLABORADORES_VIEW: true,
    RELATORIOS_VIEW: true, RELATORIOS_CUSTOM: true,
  },
  supervisor: {
    OBRAS_VIEW: true, OBRAS_EDIT: true,
    ORCAMENTO_VIEW: true,
    MEDICAO_VIEW: true, MEDICAO_CREATE: true, MEDICAO_APPROVE: true,
    SUPRIMENTOS_VIEW: true, SUPRIMENTOS_CREATE: true,
    ESTOQUE_VIEW: true,
    EQUIPAMENTOS_VIEW: true,
    COLABORADORES_VIEW: true, COLABORADORES_MANAGE: true,
    CAMPO_VIEW: true, CAMPO_APONTAMENTO: true,
    RELATORIOS_VIEW: true,
  },
  rh: {
    RH_VIEW: true, RH_EDIT: true,
    COLABORADORES_VIEW: true, COLABORADORES_MANAGE: true,
    RELATORIOS_VIEW: true,
  },
  encarregado: {
    OBRAS_VIEW: true,
    MEDICAO_VIEW: true,
    CAMPO_VIEW: true, CAMPO_APONTAMENTO: true,
    COLABORADORES_VIEW: true,
    EQUIPAMENTOS_VIEW: true,
  },
  almoxarife: {
    OBRAS_VIEW: true,
    SUPRIMENTOS_VIEW: true, SUPRIMENTOS_CREATE: true,
    ESTOQUE_VIEW: true, ESTOQUE_EDIT: true, ESTOQUE_TRANSFER: true,
    RELATORIOS_VIEW: true,
  },
  motorista: {
    OBRAS_VIEW: true,
    LOGISTICA_VIEW: true, LOGISTICA_CREATE: true,
    EQUIPAMENTOS_VIEW: true,
    CAMPO_VIEW: true,
  },
  operacional: {
    OBRAS_VIEW: true,
    CAMPO_VIEW: true, CAMPO_APONTAMENTO: true,
  },
};
