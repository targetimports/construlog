/**
 * Safe Fetch Wrapper
 * - Nunca lança erro que quebre React render
 * - Trata 403 (sem permissão) retornando null
 * - Trata 502 (gateway) com 1 retry
 * - Trata timeout
 */

const SAFE_FETCH_TIMEOUT = 5000;
const MAX_RETRIES = 1;

export async function safeFetch(
  fetchFn,
  { componentName = 'unknown', onError = null } = {}
) {
  let retries = 0;

  const tryFetch = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SAFE_FETCH_TIMEOUT);

      const result = await Promise.race([
        fetchFn(),
        new Promise((_, reject) => {
          // Se retorno for muito lento, timeout
          setTimeout(() => reject(new Error('Timeout')), SAFE_FETCH_TIMEOUT);
        })
      ]);

      clearTimeout(timeoutId);
      return result;
    } catch (err) {
      // 403 Forbidden → sem permissão, não retry
      if (err?.response?.status === 403 || err?.status === 403) {
        console.warn(`[SAFE MODE] 403 Forbidden em ${componentName}:`, err.message);
        return null;
      }

      // 502/503 Gateway → retry uma vez
      if ((err?.response?.status === 502 || err?.response?.status === 503 || err?.status === 502 || err?.status === 503) && retries < MAX_RETRIES) {
        retries++;
        console.warn(`[SAFE MODE] 502/503 em ${componentName}, retry ${retries}/${MAX_RETRIES}`);
        await new Promise(r => setTimeout(r, 500 * retries));
        return tryFetch();
      }

      // Outros erros → null silencioso
      console.warn(`[SAFE MODE] Erro em ${componentName}:`, err.message);
      if (onError) onError(err);
      return null;
    }
  };

  return tryFetch();
}

/**
 * Safe Query Hook
 * Wrapper para useQuery que não quebra ErrorBoundary
 */
export function useSafeQuery(queryFn, { componentName = 'unknown', ...options } = {}) {
  return {
    data: null,
    isLoading: false,
    error: null,
    refetch: async () => {
      try {
        return await safeFetch(queryFn, { componentName });
      } catch (err) {
        console.warn(`[SAFE MODE] useSafeQuery error em ${componentName}:`, err.message);
        return null;
      }
    }
  };
}