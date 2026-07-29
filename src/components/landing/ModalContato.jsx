import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import BlocoContato from './BlocoContato';

// MODAL DE CONTATO — a mesma seção "Contato" da página, dentro de um diálogo.
//
// Todos os CTAs (hero, navbar e os botões dos planos) abrem este modal, para
// não existirem duas experiências diferentes de "falar com a gente". Quando vem
// de um plano, o nome dele é repassado e a mensagem já nasce preenchida.
export default function ModalContato({ open, onClose, contato = {}, plano = null }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* ~70% da largura da tela no desktop, com teto para não esticar demais em
          monitores largos. No celular ocupa tudo, que é o único jeito de caber. */}
      <div className="relative w-full sm:w-[70vw] max-w-[1500px] max-h-[92vh] overflow-y-auto rounded-2xl bg-white border border-gray-100 shadow-2xl p-6 sm:p-10 lg:p-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 grid place-items-center w-9 h-9 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* `key` no plano: reabrir por outro plano recomeça o formulário. */}
        <BlocoContato key={plano || 'geral'} contato={contato} plano={plano} />
      </div>
    </div>
  );
}
