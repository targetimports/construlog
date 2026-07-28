/**
 * Hook React para chamar functions do backend de forma segura
 * Sempre trata erros "Failed to fetch", "Unexpected token", etc
 */

import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { fetchJson, ApiResponse, ApiError } from '@/components/shared/fetchJson';
import { toast } from 'sonner';

interface UseApiCallResult<T> {
  loading: boolean;
  error: string | null;
  data: T | null;
  call: (payload?: any) => Promise<T>;
}

export function useApiCall<T = any>(
  functionName: string,
  options?: {
    onSuccess?: (data: T) => void;
    onError?: (error: ApiError) => void;
    showToast?: boolean;
  }
): UseApiCallResult<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);

  const call = async (payload?: any): Promise<T> => {
    setLoading(true);
    setError(null);

    try {
      const response = await base44.functions.invoke(functionName, payload || {});

      // Response já vem com estrutura padronizada { data }
      const result = response.data?.data || response.data;

      setData(result as T);
      options?.onSuccess?.(result as T);

      return result as T;
    } catch (err) {
      const errorMsg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Erro ao executar ação';

      setError(errorMsg);
      options?.onError?.(err as ApiError);

      if (options?.showToast) {
        toast.error(errorMsg);
      }

      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, data, call };
}