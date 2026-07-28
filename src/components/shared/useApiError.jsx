/**
 * Hook para páginas/componentes tratarem erros de API sem crash
 * Fornece: error state, toast handler, retry logic
 * 
 * Uso:
 * const { error, clearError, showErrorToast, retry } = useApiError();
 * 
 * const fetchData = async () => {
 *   const result = await safeInvoke(...);
 *   if (!result.ok) {
 *     showErrorToast(result);
 *     return;
 *   }
 *   // continua...
 * }
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export function useApiError() {
  const [error, setError] = useState(null);
  const [retryFn, setRetryFn] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Mostrar erro como toast + salvar estado
   * @param {object} apiResult - { ok, message, status, details }
   * @param {function} onRetry - função para tentar novamente
   */
  const showErrorToast = useCallback((apiResult, onRetry) => {
    const message = apiResult.message || 'Erro ao carregar dados';
    
    // Log para debug
    console.warn('[API ERROR]', {
      message,
      status: apiResult.status,
      details: apiResult.details
    });

    // Salvar erro no state
    setError({
      message,
      status: apiResult.status,
      details: apiResult.details,
      timestamp: Date.now()
    });

    // Salvar função de retry
    if (onRetry) {
      setRetryFn(() => onRetry);
    }

    // Toast notification
    const toastAction = onRetry ? (
      <button
        onClick={() => {
          clearError();
          onRetry();
          toast.dismiss();
        }}
        className="ml-2 px-3 py-1 bg-white text-gray-900 rounded hover:bg-gray-100 text-sm font-medium"
      >
        Tentar
      </button>
    ) : undefined;

    // Escolher tipo de toast por status
    if (apiResult.status === 403) {
      toast.error('Acesso negado. Você não tem permissão.', { action: toastAction });
    } else if (apiResult.status === 404) {
      toast.error('Recurso não encontrado.', { action: toastAction });
    } else if (apiResult.status >= 500) {
      toast.error('Erro no servidor. Tente novamente.', { action: toastAction });
    } else if (apiResult.status === 0 || !apiResult.status) {
      // Network error, timeout, etc
      toast.error(message, { action: toastAction });
    } else {
      toast.error(message, { action: toastAction });
    }
  }, [clearError]);

  /**
   * Executar retry manualmente
   */
  const retry = useCallback(() => {
    if (retryFn) {
      clearError();
      retryFn();
    }
  }, [retryFn, clearError]);

  return {
    error,
    clearError,
    showErrorToast,
    retry,
    hasError: !!error
  };
}

/**
 * Banner de erro para exibir dentro da página
 */
export function ErrorBanner({ error, onRetry, onDismiss }) {
  if (!error) return null;

  return (
    <div className="rounded-lg bg-red-50 border border-red-200 p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 text-sm">
            Erro ao carregar dados
          </h3>
          <p className="text-red-700 text-sm mt-1">
            {error.message}
          </p>
          {error.details && (
            <p className="text-red-600 text-xs mt-2 font-mono opacity-75">
              {typeof error.details === 'string' ? error.details : JSON.stringify(error.details)}
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {onRetry && (
            <button
              onClick={onRetry}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium transition"
            >
              Tentar
            </button>
          )}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded text-sm font-medium transition"
            >
              Descartar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}