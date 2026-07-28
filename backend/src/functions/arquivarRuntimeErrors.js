import { store } from '../entityStore.js';

// Arquiva erros de runtime (marca archived=true). Se test_run_id vier, arquiva só
// os daquele run; senão arquiva todos os de teste (uso de limpeza pós-teste).
export default async function arquivarRuntimeErrors({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });
  const { test_run_id, include_test = true } = body || {};
  let errs = (await store.filter('RuntimeError', {}, '-created_date', 5000).catch(() => [])) || [];
  if (test_run_id) errs = errs.filter((e) => e.test_run_id === test_run_id);
  else if (include_test) errs = errs.filter((e) => e.is_test);
  let archived_count = 0;
  for (const e of errs) {
    if (!e.archived) { await store.update('RuntimeError', e.id, { archived: true }); archived_count++; }
  }
  return { ok: true, archived_count };
}
