// Edição de OBRA (e solicitações nela): espelha a regra do backend (rbac.podeEditarObra).
// Podem editar: ADMIN, TI (programador) ou acesso global; FINANCEIRO; e os RESPONSÁVEIS
// da própria obra (mestre/técnico/administrativo/financeiro), casando por e-mail OU nome.
// Obra sem nenhum responsável definido não trava (cai no isolamento por empresa).
const ROLES_EDITAM_QUALQUER_OBRA = new Set(['admin', 'programador', 'financeiro', 'gestor']);

export function podeEditarObra(user, obra) {
  const role = String(user?.role || user?.cargo || '').toLowerCase().trim();
  if (['admin', 'programador'].includes(role) || user?.acesso_global === true) return true;
  if (ROLES_EDITAM_QUALQUER_OBRA.has(role)) return true;
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
