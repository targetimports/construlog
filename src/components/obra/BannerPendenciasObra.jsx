import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, X, ClipboardEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { calcularCompletude } from './obraCompletude';
import CompletarInformacoesModal from './CompletarInformacoesModal';

export default function BannerPendenciasObra({ obra, onSaved, dark = false, autoOpenIfPending = false, readOnly = false }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const autoOpenedRef = React.useRef(false);

  const completude = calcularCompletude(obra);

  // Auto-abrir modal na primeira entrada se houver pendências essenciais
  useEffect(() => {
    if (autoOpenIfPending && !autoOpenedRef.current && completude.missingEssential.length > 0 && obra?.id) {
      autoOpenedRef.current = true;
      // Pequeno delay para o render estabilizar
      const t = setTimeout(() => setModalOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [obra?.id]);

  // Se não há pendências essenciais: sem banner
  if (completude.missingEssential.length === 0) return null;

  // Se usuário fechou o banner na sessão atual
  if (dismissed) return null;

  const count = completude.missingEssential.length;
  const bgClass = dark ? 'bg-amber-900/30 border-amber-700/50' : 'bg-amber-50 border-amber-200';
  const textClass = dark ? 'text-amber-300' : 'text-amber-800';
  const subTextClass = dark ? 'text-amber-400/70' : 'text-amber-600/70';

  return (
    <>
      <div className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${bgClass}`}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <AlertTriangle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${textClass}`} />
          <div className="min-w-0">
            <p className={`font-semibold text-sm ${textClass}`}>
              Informações essenciais pendentes ({count} {count === 1 ? 'item' : 'itens'})
            </p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {completude.missingEssential.map(p => (
                <Badge key={p.key} className="bg-red-100 text-red-700 text-xs border-0">
                  {p.label}
                </Badge>
              ))}
              {completude.missingRecommended.map(p => (
                <Badge key={p.key} className="bg-amber-100 text-amber-700 text-xs border-0">
                  {p.label}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
            onClick={() => setModalOpen(true)}
          >
            <ClipboardEdit className="w-4 h-4" />
            {readOnly ? 'Ver detalhes' : 'Completar agora'}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className={`p-1 rounded hover:bg-black/10 ${subTextClass}`}
            title="Fechar banner (reaparece ao recarregar se ainda houver pendências)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CompletarInformacoesModal
        obra={obra}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => { onSaved?.(); setDismissed(false); }}
        readOnly={readOnly}
      />
    </>
  );
}