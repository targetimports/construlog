import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * DashboardErrorFallback - Renderiza quando Dashboard falha
 * Não quebra app inteiro, oferece retry local
 */
export default function DashboardErrorFallback({ error = null, onRetry = () => {} }) {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="p-3 bg-orange-100 rounded-full">
              <AlertCircle className="w-6 h-6 text-orange-600" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Erro ao carregar Dashboard
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              Ocorreu um problema ao carregar os dados. Tente novamente.
            </p>
          </div>

          {error && process.env.NODE_ENV === 'development' && (
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <p className="text-xs text-gray-700 font-mono break-all">
                {error.message || String(error)}
              </p>
            </div>
          )}

          <Button
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}