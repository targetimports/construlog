// RBAC server-side — fonte ÚNICA de autorização no backend.
// Perfis do plano (§31) + técnicos. Chaves alinhadas às usadas no front
// (menu navigation.jsx + RouteGuards): *_VIEW (visibilidade) e *_CREATE/EDIT/APPROVE (ações).

const SUPER_ROLES = ['admin', 'programador'];

// Permissões concedidas por perfil (super faz bypass de tudo).
export const ROLE_PERMISSIONS = {
  // Gestor de empresa-membro do grupo: acesso amplo aos módulos operacionais da
  // SUA empresa (dados já isolados por empresa_id no backend). Não gerencia o
  // grupo/matriz (sem TI, config global nem gestão de empresas).
  gestor: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    OBRAS_VIEW: 1, OBRAS_EDIT: 1, OBRAS_CREATE: 1,
    ORCAMENTO_VIEW: 1, MEDICOES_VIEW: 1, MEDICOES_EDIT: 1, CONTRATOS_VIEW: 1, DIARIO_CREATE: 1,
    COMPRAS_VIEW: 1, COMPRAS_CREATE: 1, ESTOQUE_VIEW: 1, ESTOQUE_CREATE: 1, ESTOQUE_EDIT: 1,
    LOGISTICA_VIEW: 1, EQUIPAMENTOS_VIEW: 1,
    FINANCEIRO_VIEW: 1, FINANCEIRO_EDIT: 1,
    RH_VIEW: 1, RH_EDIT: 1, CADASTROS_VIEW: 1, RELATORIOS_VIEW: 1,
  },
  financeiro: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    OBRAS_VIEW: 1, OBRAS_EDIT: 1, ORCAMENTO_VIEW: 1, MEDICOES_VIEW: 1, CONTRATOS_VIEW: 1,
    FINANCEIRO_VIEW: 1, FINANCEIRO_EDIT: 1, FINANCEIRO_APPROVE: 1,
    RH_FOLHA: 1,
    CADASTROS_VIEW: 1, RELATORIOS_VIEW: 1,
  },
  // RH / Departamento Pessoal: escopo restrito a Pessoas (colaboradores, apontamentos,
  // benefícios/EPI/SST, terceiros) + rodar a folha de pagamento + relatórios de RH.
  // NÃO acessa obras, financeiro-geral, estoque nem configuração/TI.
  rh: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    RH_VIEW: 1, RH_EDIT: 1, RH_FOLHA: 1,
    RELATORIOS_VIEW: 1,
  },
  supervisor: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    OBRAS_VIEW: 1, OBRAS_EDIT: 1, ORCAMENTO_VIEW: 1, MEDICOES_VIEW: 1, MEDICOES_EDIT: 1,
    CONTRATOS_VIEW: 1, DIARIO_CREATE: 1,
    COMPRAS_VIEW: 1, COMPRAS_CREATE: 1, ESTOQUE_VIEW: 1, EQUIPAMENTOS_VIEW: 1,
    RH_VIEW: 1, RH_EDIT: 1, CADASTROS_VIEW: 1, RELATORIOS_VIEW: 1,
    // IA de supervisão geral — visível só a responsáveis amplos (super + supervisor).
    IA_GERAL_VIEW: 1,
  },
  encarregado: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    OBRAS_VIEW: 1, MEDICOES_VIEW: 1, DIARIO_CREATE: 1, EQUIPAMENTOS_VIEW: 1,
    // RH_VIEW fica: a aba Equipe DENTRO da obra depende dela (ponto, presença,
    // alocação). O que saiu foi a SEÇÃO de RH da sidebar, não o acesso à equipe.
    RH_VIEW: 1,
    // Ele é quem pede material para a obra: precisa VER estoque e ABRIR requisição,
    // e solicitar compra do que não há em estoque. Sem CREATE, só olharia.
    ESTOQUE_VIEW: 1, ESTOQUE_CREATE: 1,
    COMPRAS_VIEW: 1, COMPRAS_CREATE: 1,
  },
  almoxarife: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    ESTOQUE_VIEW: 1, ESTOQUE_CREATE: 1, ESTOQUE_EDIT: 1,
    COMPRAS_VIEW: 1, CADASTROS_VIEW: 1, RELATORIOS_VIEW: 1,
  },
  motorista: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    LOGISTICA_VIEW: 1, LOGISTICA_CREATE: 1, EQUIPAMENTOS_VIEW: 1,
    // Vê as obras em que ATUA (entrega material, opera máquina). A lista já vem
    // recortada pelo filtro "só as minhas obras" (obraScope) — motorista não está
    // em ROLES_VEEM_TODAS_OBRAS, então enxerga só onde tem vínculo. Sem OBRAS_VIEW
    // ele não conseguia sequer abrir o destino da própria entrega.
    OBRAS_VIEW: 1,
  },
  operacional: {
    DASHBOARD_VIEW: 1, CALENDARIO_VIEW: 1, PROFILE_EDIT: 1,
    OBRAS_VIEW: 1, DIARIO_CREATE: 1,
  },
};

// Seções de topo do menu → permission key (null = sempre visível).
const MENU_SECTIONS = [
  { id: 'dashboard', key: 'DASHBOARD_VIEW' },
  { id: 'calendario', key: 'CALENDARIO_VIEW' },
  { id: 'obras', key: 'OBRAS_VIEW' },
  { id: 'suprimentos', key: 'COMPRAS_VIEW' },
  { id: 'notas-fiscais', key: 'COMPRAS_VIEW' },
  { id: 'estoque', key: 'ESTOQUE_VIEW' },
  { id: 'financeiro', key: 'FINANCEIRO_VIEW' },
  { id: 'rh', key: 'RH_VIEW' },
  { id: 'relatorios', key: 'RELATORIOS_VIEW' },
  { id: 'ativos', key: 'EQUIPAMENTOS_VIEW' },
  { id: 'ti', key: 'ADMIN_CONFIG' },
  { id: 'atalhos', key: null },
  { id: 'notificacoes-usuario', key: null },
  { id: 'meu-perfil', key: 'PROFILE_EDIT' },
  { id: 'configuracoes', key: 'ADMIN_CONFIG' },
  // Ajuda por último: é o rodapé do menu, não parte da rotina de trabalho.
  { id: 'ajuda', key: null },
];

// Áreas de acesso ajustáveis por usuário (override sobre a base da role).
// São as chaves de VISIBILIDADE (*_VIEW). Ações finas (_EDIT/_CREATE/_APPROVE)
// e ADMIN_CONFIG ficam de fora de propósito (perigosas / nível técnico).
export const PERMISSION_AREAS = [
  { key: 'DASHBOARD_VIEW', label: 'Dashboard', grupo: 'Geral' },
  { key: 'CALENDARIO_VIEW', label: 'Calendário', grupo: 'Geral' },
  { key: 'OBRAS_VIEW', label: 'Obras', grupo: 'Operação' },
  { key: 'ORCAMENTO_VIEW', label: 'Orçamento', grupo: 'Operação' },
  { key: 'MEDICOES_VIEW', label: 'Medições', grupo: 'Operação' },
  { key: 'CONTRATOS_VIEW', label: 'Contratos', grupo: 'Operação' },
  { key: 'COMPRAS_VIEW', label: 'Suprimentos / Compras', grupo: 'Suprimentos' },
  { key: 'ESTOQUE_VIEW', label: 'Estoque', grupo: 'Suprimentos' },
  { key: 'LOGISTICA_VIEW', label: 'Logística', grupo: 'Logística' },
  { key: 'EQUIPAMENTOS_VIEW', label: 'Equipamentos', grupo: 'Logística' },
  { key: 'FINANCEIRO_VIEW', label: 'Financeiro', grupo: 'Financeiro' },
  { key: 'RH_VIEW', label: 'RH & Pessoas', grupo: 'Pessoas' },
  { key: 'RELATORIOS_VIEW', label: 'Relatórios', grupo: 'Relatórios' },
  { key: 'CADASTROS_VIEW', label: 'Cadastros / Ativos', grupo: 'Cadastros' },
  { key: 'IA_GERAL_VIEW', label: 'IA — Supervisão Geral', grupo: 'IA' },
];

const AREA_KEYS = new Set(PERMISSION_AREAS.map((a) => a.key));

// Aplica os overrides (UserPermissionOverride: { permission_key, allowed }) sobre
// um mapa de permissões. allowed === true adiciona; allowed === false remove.
function aplicarOverrides(map, overrides) {
  for (const ov of overrides || []) {
    const k = String(ov?.permission_key || '').trim();
    if (!k) continue;
    if (ov.allowed === true) map[k] = true;
    else if (ov.allowed === false) delete map[k];
  }
  return map;
}

export const getRole = (user) => String(user?.role || '').toLowerCase().trim();
export const isSuperAdmin = (user) => SUPER_ROLES.includes(getRole(user)) || user?.isOwner === true;

// Edição de OBRA (e solicitações nela): além de ADMIN/TI (super) e FINANCEIRO, só os
// RESPONSÁVEIS da obra (mestre/técnico/administrativo/financeiro) podem editar a própria
// obra. Casamento por e-mail OU nome (os campos de responsável hoje guardam o nome).
// Obra SEM nenhum responsável definido não trava (cai no isolamento por empresa) —
// evita travar obras antigas antes de terem responsáveis atribuídos.
const ROLES_EDITAM_QUALQUER_OBRA = new Set(['admin', 'programador', 'financeiro', 'gestor']);
export function podeEditarObra(user, obra) {
  if (isSuperAdmin(user)) return true;
  if (ROLES_EDITAM_QUALQUER_OBRA.has(getRole(user))) return true;
  if (!obra) return true;
  const responsaveis = ['responsavel_obra', 'responsavel_tecnico', 'responsavel_administrativo', 'responsavel_financeiro']
    .flatMap((k) => String(obra[k] || '').split(',').map((s) => s.trim().toLowerCase()))
    .filter(Boolean);
  if (responsaveis.length === 0) return true;
  const ident = [user?.email, user?.full_name, user?.nome, user?.name]
    .map((s) => String(s || '').trim().toLowerCase())
    .filter(Boolean);
  return responsaveis.some((r) => ident.includes(r));
}

// Chaves de área concedidas pela role (base, sem override) — para a tela de ajuste.
export function roleBaseAreas(user) {
  if (isSuperAdmin(user)) return PERMISSION_AREAS.map((a) => a.key);
  const perms = ROLE_PERMISSIONS[getRole(user)] || {};
  return Object.keys(perms).filter((k) => AREA_KEYS.has(k));
}

// Verifica se o usuário tem uma permission key.
export function can(user, key) {
  if (!key) return true;
  if (isSuperAdmin(user)) return true;
  if (key === 'PROFILE_EDIT') return true;
  const perms = ROLE_PERMISSIONS[getRole(user)] || {};
  return perms[key] === true || perms[key] === 1;
}

// Lança 403 se não tiver permissão (uso nas functions sensíveis).
export function requirePermission(user, key) {
  if (!can(user, key)) {
    throw Object.assign(new Error(`Sem permissão para esta ação (${key})`), { status: 403 });
  }
}

// Para getEffectivePermissionsV2. `overrides` = registros UserPermissionOverride do usuário.
export function effectivePermissions(user, overrides = []) {
  const superAdmin = isSuperAdmin(user);
  if (superAdmin) {
    return { effectivePermissionsV2: { ADMIN_CONFIG: true, PROFILE_EDIT: true }, isSuperAdmin: true, isCompanyAdmin: false, source: 'backend' };
  }
  const perms = { ...(ROLE_PERMISSIONS[getRole(user)] || {}), PROFILE_EDIT: 1 };
  // normaliza para boolean
  const map = {};
  for (const k of Object.keys(perms)) map[k] = true;
  // ajuste fino por usuário (sobre a base da role)
  aplicarOverrides(map, overrides);
  map.PROFILE_EDIT = true; // nunca remove edição do próprio perfil
  return { effectivePermissionsV2: map, isSuperAdmin: false, isCompanyAdmin: false, source: (overrides?.length ? 'backend+override' : 'backend') };
}

// Override explícito de seções por perfil (definido conforme o cliente decide
// perfil a perfil). Quando um perfil tem entrada aqui, ela manda — assim
// controlamos exatamente quais seções de topo aparecem (independente das chaves).
// 'notificacoes-usuario' é sempre adicionado.
export const ROLE_SECTIONS = {
  gestor: ['dashboard', 'calendario', 'obras', 'suprimentos', 'notas-fiscais', 'estoque', 'financeiro', 'rh', 'relatorios', 'ativos'],
  // Supervisiona OBRAS: sem RH e sem Relatórios (decisão do cliente). A equipe ele
  // acompanha DENTRO da obra — RH_VIEW continua na role por causa dessa aba.
  supervisor: ['dashboard', 'calendario', 'obras', 'suprimentos', 'estoque'],
  // Sem 'relatorios' (decisão do cliente) e sem 'assistentes-ia', que não existe na
  // navegação — id órfão, ignorado silenciosamente.
  almoxarife: ['dashboard', 'calendario', 'suprimentos', 'estoque'],
  financeiro: ['dashboard', 'calendario', 'obras', 'financeiro', 'relatorios'],
  rh: ['dashboard', 'calendario', 'rh', 'relatorios'],
  // Sem 'rh' (decisão do cliente): a equipe ele gerencia DENTRO da obra.
  // Com estoque e compras: é ele quem pede material para o canteiro.
  encarregado: ['dashboard', 'calendario', 'obras', 'suprimentos', 'estoque'],
  operacional: ['dashboard', 'calendario', 'obras'],
  // Motorista vê a seção 'ativos' (Logística & Frota), onde mora "Viagens de Entrega".
  // Antes apontava para 'logistica' — id que NÃO EXISTE na navegação, então ele logava
  // e via apenas dashboard e calendário.
  motorista: ['dashboard', 'calendario', 'ativos', 'obras'],
};
const SECOES_SEMPRE = ['ajuda', 'notificacoes-usuario', 'meu-perfil'];

// GUARDA CONTRA ID ÓRFÃO: seção listada aqui que não existe em MENU_SECTIONS é
// ignorada em silêncio — foi assim que o motorista ficou só com "Meu Perfil"
// quando a seção 'logistica' deixou de existir. O aviso no boot torna o erro
// visível em vez de virar menu sumido em produção.
{
  const conhecidas = new Set([...MENU_SECTIONS.map((s) => s.id), ...SECOES_SEMPRE]);
  for (const [role, ids] of Object.entries(ROLE_SECTIONS)) {
    const orfas = ids.filter((i) => !conhecidas.has(i));
    if (orfas.length) console.warn(`[rbac] role "${role}" aponta para seção inexistente: ${orfas.join(', ')}`);
  }
}

// Para getMenuForBootstrap → ids de seções visíveis.
// Super admin retorna [] de propósito: o Layout trata lista vazia como "mostrar
// todas as seções" — assim nunca escondemos algo por uma seção não listada aqui.
export function menuFor(user, overrides = []) {
  if (isSuperAdmin(user)) return [];
  const role = getRole(user);
  // Base: override explícito de seções por perfil OU derivado das permissões.
  const ids = ROLE_SECTIONS[role]
    ? new Set([...ROLE_SECTIONS[role], ...SECOES_SEMPRE])
    : new Set([...MENU_SECTIONS.filter((s) => can(user, s.key)).map((s) => s.id), ...SECOES_SEMPRE]);
  // Ajuste por usuário: cada override (permission_key) afeta as seções com aquela key.
  for (const ov of overrides || []) {
    const k = String(ov?.permission_key || '').trim();
    if (!k) continue;
    for (const s of MENU_SECTIONS.filter((sec) => sec.key === k)) {
      if (ov.allowed === true) ids.add(s.id);
      else if (ov.allowed === false) ids.delete(s.id);
    }
  }
  return [...ids];
}
