import { store } from '../entityStore.js';

// Suite de teste (Ferramentas Admin): integridade básica da camada de dados.
// Exercita banco + round-trip CRUD em HealthCheck (descartável, com cleanup) + filtro $in.
// Retorna o formato esperado pela tela: { resumo, all_passed, elapsed_ms, results:[{test,status,message}] }.
export default async function testarIntegridadeSistema({ user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });
  if (user.role !== 'admin' && user.role !== 'programador') {
    throw Object.assign(new Error('Apenas admin/programador'), { status: 403 });
  }

  const t0 = Date.now();
  const results = [];
  const push = (test, ok, message) => results.push({ test, status: ok ? 'PASS' : 'FAIL', message });

  // 1. Banco conectável (leitura de entidade core)
  try {
    const amostra = await store.filter('Obra', {}, '-created_date', 1);
    push('db_conectavel', Array.isArray(amostra), `Banco respondeu; leitura de Obra OK (amostra: ${amostra.length}).`);
  } catch (e) {
    push('db_conectavel', false, `Falha ao ler Obra: ${e.message}`);
  }

  // 2. Round-trip CRUD em HealthCheck (create → read → update → delete) com cleanup
  let id = null;
  try {
    const criado = await store.create(
      'HealthCheck',
      { _test: true, origem: 'testarIntegridadeSistema', marcador: `T-${t0}` },
      user.email,
    );
    id = criado?.id || null;
    push('crud_create', !!id, id ? `Registro criado (id ${String(id).slice(0, 8)}…).` : 'Create não retornou id.');

    const lido = await store.filter('HealthCheck', { id });
    push('crud_read', Array.isArray(lido) && lido.length === 1, `Leitura por id retornou ${lido?.length ?? 0} registro(s).`);

    const atualizado = await store.update('HealthCheck', id, { marcador: 'ATUALIZADO' });
    push('crud_update', atualizado?.marcador === 'ATUALIZADO', `Update aplicado (marcador=${atualizado?.marcador}).`);

    await store.delete('HealthCheck', id);
    const depois = await store.filter('HealthCheck', { id });
    const removido = !depois || depois.length === 0;
    push('crud_delete', removido, removido ? 'Registro removido (cleanup OK).' : 'Registro ainda presente após delete.');
    if (removido) id = null;
  } catch (e) {
    push('crud_roundtrip', false, `Erro no round-trip CRUD: ${e.message}`);
  } finally {
    if (id) { try { await store.delete('HealthCheck', id); } catch { /* cleanup best-effort */ } }
  }

  // 3. Filtro com operador $in
  try {
    const obras = await store.filter('Obra', {}, '-created_date', 3);
    const ids = (obras || []).map((o) => o.id).filter(Boolean);
    if (ids.length) {
      const back = await store.filter('Obra', { id: { $in: ids } });
      push('filtro_in', (back?.length || 0) === ids.length, `Filtro $in retornou ${back?.length ?? 0}/${ids.length}.`);
    } else {
      push('filtro_in', true, 'Sem obras para exercitar $in (ok).');
    }
  } catch (e) {
    push('filtro_in', false, `Erro no filtro $in: ${e.message}`);
  }

  const passCount = results.filter((r) => r.status === 'PASS').length;
  return {
    resumo: `${passCount}/${results.length} verificações OK`,
    all_passed: passCount === results.length,
    elapsed_ms: Date.now() - t0,
    executado_por: user.email,
    executado_em: new Date().toISOString(),
    results,
  };
}
