import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para gerenciar erros de página SEM quebrar app
 * - Captura erros de fetch/render
 * - Oferece retry local
 * - Nunca lança exception
 */
export function usePageError() {
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleError = useCallback((err, context = '') => {
    console.error(`[PAGE ERROR] ${context}:`, err.message);
    setError({
      message: err.message || 'Erro desconhecido',
      context,
      timestamp: new Date().toISOString()
    });
  }, []);

  const retry = useCallback(async (retryFn) => {
    if (!retryFn) {
      console.warn('[usePageError] Retry sem função');
      return;
    }

    setError(null);
    try {
      await retryFn();
      // Revalidar queries relacionadas
      queryClient.refetchQueries();
    } catch (err) {
      handleError(err, 'retry');
    }
  }, [handleError, queryClient]);

  const clear = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    hasError: !!error,
    handleError,
    retry,
    clear
  };
}