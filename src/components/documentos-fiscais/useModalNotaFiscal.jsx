import { useState } from 'react';
import ModalAnexarNotaFiscalUniversal from './ModalAnexarNotaFiscalUniversal';

/**
 * Hook para integração fácil do modal de NF em qualquer módulo
 * 
 * Exemplo de uso:
 * const { abrir, fechar, Modal } = useModalNotaFiscal();
 * 
 * // No JSX:
 * <Button onClick={() => abrir('CONTAS_PAGAR', 'cp-123', 'CP-2026-001', 'obra-456')}>
 *   Anexar NF
 * </Button>
 * <Modal />
 */
export function useModalNotaFiscal() {
  const [open, setOpen] = useState(false);
  const [referenciaConfig, setReferenciaConfig] = useState({
    referencia_tipo: null,
    referencia_id: null,
    referencia_nome: null,
    obra_id: null,
  });

  const abrir = (referencia_tipo, referencia_id, referencia_nome = null, obra_id = null) => {
    setReferenciaConfig({
      referencia_tipo,
      referencia_id,
      referencia_nome,
      obra_id,
    });
    setOpen(true);
  };

  const fechar = () => {
    setOpen(false);
    setReferenciaConfig({
      referencia_tipo: null,
      referencia_id: null,
      referencia_nome: null,
      obra_id: null,
    });
  };

  const Modal = ({ onSuccess }) => (
    <ModalAnexarNotaFiscalUniversal
      open={open}
      onClose={fechar}
      referencia_tipo={referenciaConfig.referencia_tipo}
      referencia_id={referenciaConfig.referencia_id}
      referencia_nome={referenciaConfig.referencia_nome}
      obra_id={referenciaConfig.obra_id}
      onSuccess={onSuccess}
    />
  );

  return { abrir, fechar, Modal, open };
}