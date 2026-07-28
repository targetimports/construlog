import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';
import AnexarNotaFiscalModal from './AnexarNotaFiscalModal';

/**
 * Botão reutilizável para anexar Notas Fiscais
 * Pode ser usado em Pedidos, Recebimentos, Viagens, Obras, etc.
 * 
 * @param {string} referencia_tipo - PEDIDO, RECEBIMENTO, VIAGEM, OBRA, CONTAS_PAGAR
 * @param {string} referencia_id - ID da entidade relacionada
 * @param {function} onAnexado - Callback quando NF for anexada com sucesso
 * @param {string} variant - Variante do botão (default, outline, etc)
 * @param {boolean} showIcon - Mostrar ícone no botão
 */
export default function BotaoAnexarNF({
  referencia_tipo,
  referencia_id,
  onAnexado,
  variant = 'outline',
  showIcon = true,
  label = 'Anexar NF',
}) {
  const [modalAberto, setModalAberto] = useState(false);

  const handleAnexado = () => {
    setModalAberto(false);
    if (onAnexado) {
      onAnexado();
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setModalAberto(true)}
        className="gap-2"
      >
        {showIcon && <FileText className="w-4 h-4" />}
        {label}
      </Button>

      {modalAberto && (
        <AnexarNotaFiscalModal
          isOpen={modalAberto}
          onClose={() => setModalAberto(false)}
          referencia_tipo={referencia_tipo}
          referencia_id={referencia_id}
          onAnexado={handleAnexado}
        />
      )}
    </>
  );
}