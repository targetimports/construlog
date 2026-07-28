import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';

// CONFIRMAÇÃO reutilizável, no padrão do sistema (AlertDialog do shadcn), com uma
// API imperativa que substitui o window.confirm() do navegador linha a linha:
//
//   if (await confirmar({ titulo: 'Excluir?', destrutivo: true })) { ... }
//
// Por que assim: window.confirm é proibido no projeto (caixa cinza do navegador,
// fora do tema, ruim no mobile). Mas trocar por AlertDialog "na mão" em cada tela
// obriga a criar estado + JSX toda vez. Aqui a caixa vive UMA vez (ConfirmarHost,
// montado no App) e qualquer código chama confirmar() e espera a promessa.

let abrir = null; // preenchido pelo host quando monta

// Chame de qualquer lugar. Resolve true (confirmou) ou false (cancelou/fechou).
export function confirmar(opts = {}) {
  const cfg = typeof opts === 'string' ? { descricao: opts } : opts;
  if (!abrir) {
    // Host ainda não montou (não deveria acontecer em runtime) — falha segura: não age.
    return Promise.resolve(false);
  }
  return new Promise((resolve) => abrir(cfg, resolve));
}

export function ConfirmarHost() {
  const [estado, setEstado] = useState(null); // { cfg, resolve } | null

  useEffect(() => {
    abrir = (cfg, resolve) => setEstado({ cfg, resolve });
    return () => { abrir = null; };
  }, []);

  const responder = useCallback((valor) => {
    setEstado((atual) => {
      atual?.resolve(valor);
      return null;
    });
  }, []);

  const cfg = estado?.cfg || {};
  const destrutivo = cfg.destrutivo;

  return (
    <AlertDialog open={!!estado} onOpenChange={(o) => { if (!o) responder(false); }}>
      <AlertDialogContent className="w-[95vw] max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{cfg.titulo || 'Confirmar ação'}</AlertDialogTitle>
          {cfg.descricao && <AlertDialogDescription>{cfg.descricao}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <AlertDialogCancel className="w-full sm:w-auto h-11 mt-0">
            {cfg.cancelar || 'Cancelar'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => responder(true)}
            className={`w-full sm:w-auto h-11 ${destrutivo ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {cfg.confirmar || (destrutivo ? 'Excluir' : 'Confirmar')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
