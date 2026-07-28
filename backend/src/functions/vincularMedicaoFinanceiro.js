import { store } from '../entityStore.js';

// Vincula uma medição ao financeiro. As contas (ContaFinanceira) já são criadas
// na aprovação (no front, com medicao_id). Aqui apenas confirmamos o vínculo e
// marcamos a medição como vinculada — NÃO recriamos contas (evita duplicar).
export default async function vincularMedicaoFinanceiro({ body, user }) {
  const { medicao_id } = body || {};
  if (!medicao_id) throw Object.assign(new Error('medicao_id obrigatório'), { status: 400 });

  const contas = await store.filter('ContaFinanceira', { medicao_id }).catch(() => []);

  try {
    await store.update('Medicao', medicao_id, {
      financeiro_vinculado: true,
      financeiro_vinculado_em: new Date().toISOString(),
      financeiro_vinculado_por: user?.email || null,
    });
  } catch { /* best-effort */ }

  return { ok: true, medicao_id, contas_vinculadas: (contas || []).length };
}
