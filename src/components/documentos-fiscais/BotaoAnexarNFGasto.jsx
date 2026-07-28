import React from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Plus } from 'lucide-react';
import BadgeStatusNF from './BadgeStatusNF';
import { useModalNotaFiscal } from './useModalNotaFiscal';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Componente padrão para anexar NF em qualquer registro de gasto/custo/pagamento
 * 
 * Props:
 * - referencia_tipo: string (CONTAS_PAGAR, COMPRA, RECEBIMENTO, etc)
 * - referencia_id: string
 * - referencia_nome: string (opcional - para exibição)
 * - obra_id: string (opcional)
 * - podeEditar: boolean (se false, mostra apenas visualização)
 * - onSuccess: function (callback quando NF for vinculada)
 */
export default function BotaoAnexarNFGasto({
  referencia_tipo,
  referencia_id,
  referencia_nome,
  obra_id,
  podeEditar = true,
  onSuccess,
}) {
  const { abrir, fechar, Modal } = useModalNotaFiscal();

  // Buscar NFs vinculadas a este registro
  const { data: nfsVinculadas = [] } = useQuery({
    queryKey: ['nfsVinculadas', referencia_tipo, referencia_id],
    queryFn: async () => {
      try {
        const result = await base44.functions.invoke('notaFiscalListar', {
          referencia_tipo,
          referencia_id,
        });
        return result.data.nfs || [];
      } catch (error) {
        console.error('Erro ao buscar NFs:', error);
        return [];
      }
    },
  });

  // Se tem NF vinculada, mostrar resumo + botão de edição
  if (nfsVinculadas.length > 0) {
    const nfPrincipal = nfsVinculadas[0]; // Exibir a primeira

    return (
      <div className="flex items-center gap-3">
        {/* Badge com status e valor */}
        <BadgeStatusNF
          status={nfPrincipal.status}
          valor_final_ajustado={nfPrincipal.valor_final_ajustado}
          showValor={nfPrincipal.status === 'CONFIRMADO'}
        />

        {/* Botão para visualizar/editar (se permitido) */}
        {podeEditar && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              abrir(referencia_tipo, referencia_id, referencia_nome, obra_id)
            }
            className="gap-1"
          >
            <FileText className="w-3 h-3" />
            Ver / Editar
          </Button>
        )}

        {/* Se tem mais de 1 NF */}
        {nfsVinculadas.length > 1 && (
          <span className="text-xs text-gray-500">+{nfsVinculadas.length - 1}</span>
        )}

        <Modal onSuccess={onSuccess} />
      </div>
    );
  }

  // Se não tem NF, mostrar botão para anexar
  return (
    <>
      <Button
        size="sm"
        variant={podeEditar ? 'outline' : 'ghost'}
        onClick={() =>
          abrir(referencia_tipo, referencia_id, referencia_nome, obra_id)
        }
        disabled={!podeEditar}
        className="gap-1"
      >
        <Plus className="w-3 h-3" />
        Anexar NF
      </Button>

      <Modal onSuccess={onSuccess} />
    </>
  );
}