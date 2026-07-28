import { useState } from 'react';
import ModalAnexarNFGenerico from './ModalAnexarNFGenerico';

/**
 * Hook para simplificar anexação de NF em qualquer módulo
 * 
 * Uso:
 * const { Modal, abrir, fechar } = useAnexarNF({
 *   referencia_tipo: 'PEDIDO',
 *   referencia_id: pedidoId,
 *   referencia_nome: 'PC-2026-001',
 *   onSuccess: () => { refetch() }
 * });
 * 
 * // Depois, no JSX:
 * <Button onClick={abrir}>Anexar NF</Button>
 * {Modal}
 */
export function useAnexarNF({ referencia_tipo, referencia_id, referencia_nome, onSuccess }) {
  const [open, setOpen] = useState(false);

  const Modal = (
    <ModalAnexarNFGenerico
      open={open}
      referencia_tipo={referencia_tipo}
      referencia_id={referencia_id}
      referencia_nome={referencia_nome}
      onClose={() => setOpen(false)}
      onSuccess={onSuccess}
    />
  );

  return {
    Modal,
    abrir: () => setOpen(true),
    fechar: () => setOpen(false),
    open,
  };
}