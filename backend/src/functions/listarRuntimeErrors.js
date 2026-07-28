import { store } from '../entityStore.js';

// Lista os erros de runtime no período, com filtros de teste/arquivados.
export default async function listarRuntimeErrors({ body }) {
  const { minutes = 60, include_test = false, include_archived = false, limit = 20 } = body || {};
  const desde = new Date(Date.now() - minutes * 60000).toISOString();
  let errs = (await store.filter('RuntimeError', {}, '-created_date', 5000).catch(() => [])) || [];
  errs = errs.filter((e) => String(e.created_date) >= desde);
  if (!include_test) errs = errs.filter((e) => !e.is_test);
  if (!include_archived) errs = errs.filter((e) => !e.archived);
  return { ok: true, items: errs.slice(0, Math.min(Number(limit) || 20, 500)) };
}
