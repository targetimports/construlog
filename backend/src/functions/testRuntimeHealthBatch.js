import { store } from '../entityStore.js';

// Gera erros de runtime de TESTE (is_test=true) para exercitar a tela de Saúde
// do Sistema sem poluir as métricas reais (isolados por test_run_id).
export default async function testRuntimeHealthBatch({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });
  const { count = 1, severidade = 'warn', test_run_id } = body || {};
  const run = test_run_id || `T-${Date.now()}`;
  const sev = severidade === 'critical' ? 'critical' : 'warn';
  let created = 0;
  for (let i = 0; i < Math.min(Number(count) || 1, 50); i++) {
    await store.create('RuntimeError', {
      severidade: sev,
      is_test: true,
      test_run_id: run,
      archived: false,
      mensagem: `Erro de teste (${sev}) #${i + 1}`,
      origem: 'testRuntimeHealthBatch',
    }, user?.email || null);
    created++;
  }
  return { ok: true, created, test_run_id: run };
}
