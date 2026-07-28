import { store } from '../entityStore.js';
import { obterConfig } from './getSystemConfig.js';

// Atualiza a config do sistema (modo safe/staging, circuit breaker, feature flags,
// thresholds). Recebe { updates: {...} } e faz merge no singleton.
export default async function setSystemConfig({ body, user }) {
  if (!user) throw Object.assign(new Error('Login necessário'), { status: 401 });
  const { updates = {} } = body || {};
  const cfg = await obterConfig();
  await store.update('SystemConfig', cfg.id, updates);
  const atual = (await store.filter('SystemConfig', { id: cfg.id }))[0];
  return { ok: true, config: atual };
}
