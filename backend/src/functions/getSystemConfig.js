import { store } from '../entityStore.js';

// Config do sistema (singleton). Cria com padrões se ainda não existir.
async function obterConfig() {
  let cfg = (await store.filter('SystemConfig', {}, '-created_date', 1))[0];
  if (!cfg) {
    cfg = await store.create('SystemConfig', {
      system_mode: 'staging',
      circuit_breaker_enabled: true,
      flags_modulos: {},
      window_minutes: 60,
      warn_errors: 3,
      critical_errors: 8,
    });
  }
  return cfg;
}

export { obterConfig };

export default async function getSystemConfig() {
  const cfg = await obterConfig();
  return {
    ok: true,
    config: {
      system_mode: cfg.system_mode || 'staging',
      circuit_breaker_enabled: cfg.circuit_breaker_enabled !== false,
      flags_modulos: cfg.flags_modulos || {},
      window_minutes: cfg.window_minutes || 60,
      warn_errors: cfg.warn_errors || 3,
      critical_errors: cfg.critical_errors || 8,
    },
  };
}
