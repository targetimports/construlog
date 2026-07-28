/**
 * Cache de bootstrap para evitar múltiplas chamadas simultâneas
 */

let cacheData = {
  user: null,
  rbac: null,
  menu: null,
  timestamp: 0
};

const CACHE_TTL = 300000; // 5 minutos

export function getCachedBootstrap() {
  const now = Date.now();
  if (cacheData.timestamp && now - cacheData.timestamp < CACHE_TTL) {
    console.log('[Bootstrap Cache] Hit');
    return { ...cacheData };
  }
  return null;
}

export function setCachedBootstrap(data) {
  cacheData = { ...data, timestamp: Date.now() };
  console.log('[Bootstrap Cache] Set');
}

export function clearBootstrapCache() {
  cacheData = { user: null, rbac: null, menu: null, timestamp: 0 };
}