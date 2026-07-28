import { store } from '../entityStore.js';
import { obterConfig } from './getSystemConfig.js';

// Saúde real do sistema (self-host): testa o banco, conta erros de runtime no
// período e devolve um status consolidado para a tela "Saúde do Sistema".
export default async function getHealthStatus({ body }) {
  const t0 = Date.now();
  const { include_test = false } = body || {};

  const cfg = await obterConfig();
  const window_minutes = cfg.window_minutes || 60;
  const warn_errors = cfg.warn_errors || 3;
  const critical_errors = cfg.critical_errors || 8;

  // Health check REAL: se o banco responde, o backend+DB estão de pé.
  let db_ok = true;
  try { await store.filter('Obra', {}, '-created_date', 1); } catch { db_ok = false; }

  // Erros de runtime no período (não arquivados).
  const desde = new Date(Date.now() - window_minutes * 60000).toISOString();
  let errs = (await store.filter('RuntimeError', {}, '-created_date', 2000).catch(() => [])) || [];
  errs = errs.filter((e) => !e.archived && String(e.created_date) >= desde);
  if (!include_test) errs = errs.filter((e) => !e.is_test);
  const erros_recentes = errs.length;
  const runtime_critical_recent = errs.filter((e) => e.severidade === 'critical').length;

  let runtime_health = 'ok';
  if (runtime_critical_recent >= 1 || erros_recentes >= critical_errors) runtime_health = 'critical';
  else if (erros_recentes >= warn_errors) runtime_health = 'warn';

  const status = (!db_ok || runtime_health === 'critical')
    ? 'critical'
    : (runtime_health === 'warn' ? 'warning' : 'ok');

  return {
    db_ok,
    qa_gate: (db_ok && runtime_health !== 'critical') ? 'PASS' : 'FAIL',
    last_qa_build: cfg.last_build || new Date().toISOString().split('T')[0],
    runtime_health,
    erros_recentes,
    runtime_critical_recent,
    thresholds: { window_minutes, warn_errors, critical_errors },
    status,
    duracao_ms: Date.now() - t0,
  };
}
