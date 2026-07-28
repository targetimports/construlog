/**
 * ErrorBoundary - APENAS para erros fatais do React (render crash)
 * 
 * NÃO deve aparecer para:
 * - Erros de API (403/500)
 * - Validação
 * - Dados vazios
 * 
 * SÓ aparece para:
 * - Erro em render (null.map())
 * - Erro em constructor/lifecycle
 * - Component crash JS
 */

import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log para debug
    console.error('[ERROR BOUNDARY] Fatal error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });

    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));
  }

  handleRecover = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, errorCount } = this.state;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
          {/* Ícone de erro */}
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">
            Algo deu errado
          </h1>

          {/* Mensagem */}
          <p className="text-gray-600 text-center mb-4">
            A aplicação encontrou um erro inesperado e não pôde continuar.
          </p>

          {/* Detalhes técnicos (sempre visíveis de forma segura) */}
          <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 mb-4">
            <p className="text-xs font-mono text-gray-700 break-words">
              <strong>Erro:</strong> {error?.message || '—'}
            </p>
            {(error?.stack || errorInfo) && (
              <details className="mt-2 cursor-pointer">
                <summary className="text-xs font-semibold text-gray-600 hover:text-gray-800">
                  Ver detalhes técnicos
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40 bg-white p-2 rounded border border-gray-200">
                  {(error?.stack || errorInfo?.componentStack) || ''}
                </pre>
              </details>
            )}
            <div className="mt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const details = `Erro: ${error?.message || ''}\n\n${(error?.stack || errorInfo?.componentStack) || ''}`;
                  navigator.clipboard?.writeText(details);
                }}
              >
                Copiar detalhes
              </Button>
            </div>
          </div>

          {/* Contador de erros */}
          {errorCount > 2 && (
            <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded mb-4 text-center">
              Múltiplos erros detectados ({errorCount})
            </p>
          )}

          {/* Botões de ação */}
          <div className="space-y-3">
            <Button
              onClick={this.handleRecover}
              variant="outline"
              className="w-full"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Tentar recuperar
            </Button>

            <Button
              onClick={this.handleGoHome}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Home className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>

            <Button
              onClick={this.handleReload}
              variant="secondary"
              className="w-full"
            >
              Recarregar página
            </Button>
          </div>

          {/* Rodapé */}
          <p className="text-xs text-gray-500 text-center mt-4">
            Se o problema persistir, contate o suporte.
          </p>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;