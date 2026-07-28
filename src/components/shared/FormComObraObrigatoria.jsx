import React from 'react';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Input } from '@/components/ui/input';

/**
 * Componente wrapper para injetar obraId em formulários
 * Usa: <FormComObraObrigatoria onSubmit={handleSubmit}>{children}</FormComObraObrigatoria>
 */
export default function FormComObraObrigatoria({ children, onSubmit }) {
  const { obraAtual } = useGlobalContext();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!obraAtual?.id) {
      alert('Selecione uma obra antes de continuar');
      return;
    }

    // Injetar obraId no payload
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData);
    payload.obra_id = obraAtual.id;
    payload.obraId = obraAtual.id;

    onSubmit(payload, e);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Campo oculto com obraId */}
      <input type="hidden" name="obra_id" value={obraAtual?.id || ''} />
      
      {children}
    </form>
  );
}

/**
 * Hook para componentes que precisam de obraId
 */
export function useObraRequirida() {
  const { obraAtual } = useGlobalContext();

  if (!obraAtual?.id) {
    return {
      obraId: null,
      temObra: false,
      erro: 'Nenhuma obra selecionada'
    };
  }

  return {
    obraId: obraAtual.id,
    temObra: true,
    erro: null
  };
}