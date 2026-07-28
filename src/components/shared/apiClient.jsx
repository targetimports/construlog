/**
 * Cliente de API seguro - NUNCA lança exception durante fetch
 * Sempre retorna { ok: true/false, data?, message?, status?, details? }
 * 
 * REGRAS:
 * - Erros de API (403/500/timeout) retornam { ok: false, ... } sem throw
 * - Só lanza exception em casos CRÍTICOS (JSON parse irrecuperável)
 * - Logging de erros no console, jamais na UI diretamente
 */

const DEFAULT_TIMEOUT = 30000; // 30s

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Wrapper seguro para fetch
 * @param {string} url
 * @param {object} options - { method, headers, body, timeout, ... }
 * @returns {Promise<{ok: boolean, data?, message?, status?, details?}>}
 */
export async function safeFetch(url, options = {}) {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    clearTimeout(timeoutId);

    // Parse JSON
    let data = null;
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    } catch (parseErr) {
      console.error('[API] JSON parse error:', parseErr);
      return {
        ok: false,
        status: response.status,
        message: 'Erro ao processar resposta do servidor',
        details: parseErr.message
      };
    }

    // Sucesso HTTP
    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        data
      };
    }

    // Erro HTTP - mas retorna como falha controlada
    return {
      ok: false,
      status: response.status,
      message: data?.message || data?.error || `Erro ${response.status}`,
      details: data?.details || data,
      data // inclui resposta original se precisar debugar
    };
  } catch (err) {
    clearTimeout(timeoutId);

    // Timeout
    if (err.name === 'AbortError') {
      console.warn('[API] Request timeout:', url);
      return {
        ok: false,
        status: 0,
        message: 'Conexão expirou. Tente novamente.',
        details: 'timeout'
      };
    }

    // Network error
    if (err instanceof TypeError) {
      console.error('[API] Network error:', err.message);
      return {
        ok: false,
        status: 0,
        message: 'Erro de conexão. Verifique sua internet.',
        details: err.message
      };
    }

    // Erro desconhecido
    console.error('[API] Unknown error:', err);
    return {
      ok: false,
      status: 0,
      message: 'Erro desconhecido. Tente novamente.',
      details: err.message
    };
  }
}

/**
 * Wrapper para base44.functions.invoke
 * @param {string} functionName
 * @param {object} payload
 * @returns {Promise<{ok: boolean, data?, message?, ...}>}
 */
export async function safeInvoke(base44, functionName, payload = {}) {
  try {
    const response = await base44.functions.invoke(functionName, payload);
    // base44.functions retorna axios response { data, status, ...}
    return {
      ok: true,
      status: response.status || 200,
      data: response.data
    };
  } catch (err) {
    console.error(`[INVOKE] ${functionName} failed:`, err);

    // Tentar extrair status/message de erro axios
    const status = err.response?.status || err.status || 0;
    const message = err.response?.data?.message || err.message || 'Erro ao executar ação';

    return {
      ok: false,
      status,
      message,
      details: err.response?.data || err.message
    };
  }
}

/**
 * Wrapper para base44.entities (list, filter, create, update, delete)
 * @param {object} entityApi - base44.entities.SomeEntity
 * @param {string} method - 'list', 'filter', 'create', 'update', 'delete'
 * @param  {...any} args - argumentos para o método
 * @returns {Promise<{ok: boolean, data?, message?, ...}>}
 */
export async function safeEntity(entityApi, method, ...args) {
  try {
    if (!entityApi[method]) {
      throw new Error(`Method ${method} not found on entity`);
    }
    const result = await entityApi[method](...args);
    return {
      ok: true,
      data: result
    };
  } catch (err) {
    console.error(`[ENTITY] ${method} failed:`, err);
    return {
      ok: false,
      message: err.message || `Erro ao ${method}`,
      details: err
    };
  }
}

// Session token helper
let sessionToken = null;
export function setSessionToken(token) {
  sessionToken = token;
}

export function getSessionToken() {
  return sessionToken;
}