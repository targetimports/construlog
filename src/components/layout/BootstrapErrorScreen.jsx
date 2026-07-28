import React from 'react';
import { AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Tela amigável de erro ao falhar bootstrap
 */
export default function BootstrapErrorScreen({ error, onRetry, logs = [] }) {
  const stepLabels = {
    'auth': 'Autenticação',
    'rbac': 'Permissões',
    'menu': 'Menu',
    'dashboard': 'Dashboard'
  };

  const handleLogout = () => {
    if (window.location.hostname) {
      window.location.href = '/auth/logout';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-red-200">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-red-900">
            Falha ao Carregar o Sistema
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Erro */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm font-semibold text-red-800 mb-1">
              {stepLabels[error?.step] || error?.step || 'Desconhecido'}
            </p>
            <p className="text-xs text-red-700">
              {error?.message || 'Erro desconhecido ao inicializar'}
            </p>
          </div>

          {/* Logs (desenvolvimento) */}
          {logs.length > 0 && (
            <details className="bg-gray-100 rounded-lg p-3">
              <summary className="text-xs font-mono text-gray-600 cursor-pointer">
                Detalhes técnicos ({logs.length} eventos)
              </summary>
              <div className="mt-2 max-h-32 overflow-y-auto text-[10px] font-mono text-gray-700 space-y-1 bg-gray-900 text-green-400 p-2 rounded">
                {logs.slice(-10).map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </details>
          )}

          {/* Sugestões */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800 font-semibold mb-2">O que fazer:</p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li>Verifique sua conexão com a internet</li>
              <li>Tente recarregar a página (F5)</li>
              <li>Limpe o cache do navegador</li>
              <li>Faça logout e login novamente</li>
            </ul>
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={onRetry}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Se o problema persistir, contate o suporte técnico.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}