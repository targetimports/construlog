import React from 'react';
import { Toaster as Sonner } from 'sonner';
import { Check, X, Info, AlertTriangle } from 'lucide-react';

// TOASTER do sistema — feedback flutuante para toda ação (cadastro, edição, erro…).
//
// IMPORTANTE: até este componente existir, nenhum Toaster do sonner estava
// montado, então as ~444 chamadas `toast.*` do app não apareciam.
//
// Usamos `unstyled: true` DE PROPÓSITO: o CSS default do sonner (largura, padding,
// grid do ícone, posição do X) brigava com as nossas classes e o card saía
// espremido ("tudo junto"). Com unstyled, o sonner não aplica estilo nenhum e nós
// controlamos 100% do visual pelas classes abaixo — card branco arredondado, ícone
// em círculo colorido, título + descrição e o X à direita.

const Circulo = ({ cor, children }) => (
  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${cor}`}>
    {children}
  </span>
);

export function AppToaster() {
  return (
    <Sonner
      position="top-right"
      theme="light"
      closeButton
      offset={16}
      toastOptions={{
        unstyled: true,
        duration: 4000,
        classNames: {
          // pr-10: reserva espaço para o X não encostar no texto.
          toast:
            'relative flex items-center gap-3 w-[356px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 bg-white p-4 pr-10 shadow-[0_10px_20px_-8px_rgba(16,24,40,0.12),0_2px_6px_-2px_rgba(16,24,40,0.06)]',
          icon: 'flex shrink-0 items-center m-0',
          content: 'flex flex-col min-w-0 flex-1 gap-0.5',
          // break-normal + word-break:normal: quebra só entre palavras, nunca no
          // meio delas (o sonner sem estilo herdava um break agressivo).
          title: 'text-sm font-semibold text-gray-900 leading-tight break-words [word-break:normal] [overflow-wrap:break-word]',
          description: 'text-[13px] text-gray-500 leading-snug break-words [word-break:normal] [overflow-wrap:break-word]',
          closeButton:
            'absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-50',
          actionButton: 'rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white',
          cancelButton: 'rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600',
        },
      }}
      icons={{
        success: <Circulo cor="bg-emerald-500"><Check className="h-4 w-4 text-white" strokeWidth={3} /></Circulo>,
        error: <Circulo cor="bg-red-500"><X className="h-4 w-4 text-white" strokeWidth={3} /></Circulo>,
        warning: <Circulo cor="bg-amber-500"><AlertTriangle className="h-4 w-4 text-white" /></Circulo>,
        info: <Circulo cor="bg-blue-500"><Info className="h-4 w-4 text-white" /></Circulo>,
      }}
    />
  );
}

export default AppToaster;
