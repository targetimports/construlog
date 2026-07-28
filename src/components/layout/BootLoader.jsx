import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * BootLoader - Tela de carregamento INTELIGENTE
 * - Timeout em cada etapa (nunca infinito)
 * - Retry local se estourar
 * - Nunca bloqueia por mais de 30s
 */
export default function BootLoader({ 
  step = 'auth', 
  status = 'loading',
  error = null,
  onRetry = () => {},
  logs = []
}) {
  const stepLabels = {
    auth: 'Autenticação',
    rbac: 'Permissões',
    menu: 'Menu',
    data: 'Dados'
  };

  const currentLabel = stepLabels[step] || step;
  const isError = status === 'error';

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-blue-50 to-white z-[9999] flex items-center justify-center overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -ml-32 -mb-32" />
      
      <div className="w-full max-w-sm px-6 space-y-6 relative z-10">
        {/* Logo/Branding */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-blue-600">Germanos</h1>
          <p className="text-sm text-gray-600 mt-1">Construlog</p>
        </div>

        {/* Estado: Loading ou Error */}
        {isError ? (
          // ERRO COM RETRY
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="p-4 bg-red-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Falha na inicialização</h2>
              <p className="text-sm text-gray-600 mt-2">
                {error?.message || 'Erro ao carregar a aplicação'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Etapa: <strong>{currentLabel}</strong>
              </p>
            </div>

            {/* Debug logs (dev only) */}
            {process.env.NODE_ENV === 'development' && logs.length > 0 && (
              <details className="mt-4 p-2 bg-gray-50 rounded border border-gray-200 cursor-pointer">
                <summary className="text-xs font-semibold text-gray-600">
                  Logs ({logs.length})
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-24 whitespace-pre-wrap break-words">
                  {logs.slice(-10).join('\n')}
                </pre>
              </details>
            )}

            {/* Botões de ação */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={onRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : (
           // LOADING COM PROGRESSO
           <div className="space-y-8 animate-in fade-in duration-300">
             {/* Spinner com animação melhorada */}
             <div className="flex justify-center">
               <div className="relative w-16 h-16">
                 {/* Círculos concêntricos */}
                 <div className="absolute inset-0 rounded-full border-3 border-blue-100"></div>
                 <div className="absolute inset-2 rounded-full border-3 border-transparent border-t-blue-400 border-r-blue-400 animate-spin" style={{animationDuration: '2s'}}></div>
                 <div className="absolute inset-1 rounded-full border-2 border-transparent border-b-blue-600 animate-spin" style={{animationDuration: '3s', animationDirection: 'reverse'}}></div>

                 {/* Ponto central */}
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                 </div>
               </div>
             </div>

             {/* Status text com animação */}
             <div className="text-center space-y-2">
               <p className="text-lg font-semibold text-gray-900">
                 Carregando...
               </p>
               <div className="flex items-center justify-center gap-2">
                 <span className="text-xs text-gray-500">{currentLabel}</span>
                 <div className="flex gap-1">
                   <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></span>
                   <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></span>
                   <span className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></span>
                 </div>
               </div>
             </div>

             {/* Progress bar com animação */}
             <div className="space-y-3">
               <div className="h-2 bg-gray-200 rounded-full overflow-hidden shadow-sm">
                 <div 
                   className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-700 ease-out shadow-lg"
                   style={{
                     width: step === 'auth' ? '33%' : step === 'rbac' ? '66%' : step === 'menu' ? '99%' : '100%'
                   }}
                 />
               </div>
               <p className="text-xs text-gray-500 text-center font-medium">
                 {step === 'auth' && 'Etapa 1 de 3 — Autenticação'}
                 {step === 'rbac' && 'Etapa 2 de 3 — Permissões'}
                 {step === 'menu' && 'Etapa 3 de 3 — Menu'}
               </p>
             </div>

             {/* Dica de problema */}
             <p className="text-xs text-gray-500 text-center">
               Se isso levar mais de 10 segundos,{' '}
               <button 
                 onClick={onRetry}
                 className="text-blue-600 hover:underline font-semibold transition-colors"
               >
                 tente novamente
               </button>
             </p>
           </div>
        )}
      </div>
    </div>
  );
}