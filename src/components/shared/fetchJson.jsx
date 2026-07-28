/**
 * fetchJson - Wrapper para requisições JSON com tratamento de erro padronizado
 * Sempre retorna: { ok: boolean, data?: any, code?: string, message?: string }
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  code?: string;
  message?: string;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Faz requisição JSON e trata resposta padronizada
 */
export async function fetchJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Se status não é OK, tentar ler JSON de erro
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      
      // Se não é JSON, é HTML/erro de servidor
      if (!contentType?.includes('application/json')) {
        throw new ApiError(
          'INVALID_RESPONSE',
          `Servidor retornou ${response.status} (esperado JSON)`,
          response.status
        );
      }

      // Tentar ler erro em formato JSON
      try {
        const errorData = await response.json();
        throw new ApiError(
          errorData.code || 'API_ERROR',
          errorData.message || `Erro ${response.status}`,
          response.status
        );
      } catch (parseErr) {
        throw new ApiError(
          'API_ERROR',
          `Erro ${response.status}`,
          response.status
        );
      }
    }

    // Sucesso - ler JSON
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      throw new ApiError(
        'INVALID_RESPONSE',
        'Servidor retornou resposta vazia ou inválida',
        response.status
      );
    }

    const responseData = await response.json();

    // Resposta já padronizada (ok: boolean, code, message, data)
    if (typeof responseData === 'object' && 'ok' in responseData) {
      if (!responseData.ok) {
        throw new ApiError(
          responseData.code || 'UNKNOWN_ERROR',
          responseData.message || 'Erro desconhecido',
          response.status
        );
      }
      return responseData as ApiResponse<T>;
    }

    // Se não tem ok flag, retornar como data
    return {
      ok: true,
      data: responseData as T
    };

  } catch (error) {
    if (error instanceof ApiError) {
      return {
        ok: false,
        code: error.code,
        message: error.message
      };
    }

    if (error instanceof SyntaxError) {
      return {
        ok: false,
        code: 'PARSE_ERROR',
        message: 'Resposta do servidor inválida'
      };
    }

    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return {
          ok: false,
          code: 'NETWORK_ERROR',
          message: 'Erro de conexão. Verifique sua internet.'
        };
      }
    }

    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Wrapper com auto-throw para uso em componentes React (com react-query, etc)
 */
export async function fetchJsonOrThrow<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchJson<T>(url, options);

  if (!response.ok) {
    throw new ApiError(
      response.code || 'UNKNOWN_ERROR',
      response.message || 'Erro desconhecido',
      400
    );
  }

  return response.data as T;
}