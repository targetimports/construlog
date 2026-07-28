import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BotaoAnexarNF from '../documentos-fiscais/BotaoAnexarNF';
import BotaoAnexarNFGasto from '../documentos-fiscais/BotaoAnexarNFGasto';

export default function ViagemDetalhes({ viagem, onClose, onUpdate }) {
  const qc = useQueryClient();
  const user = useQuery({ queryKey: ['user-me'], queryFn: () => base44.auth.me(), staleTime: 300000 }).data;
  const [expandedParada, setExpandedParada] = useState(null);
  const [paradas, setParadas] = useState([]);
  const [confirmando, setConfirmando] = useState(false);

  const statusColors = {
    PLANEJADA: 'bg-yellow-100 text-yellow-800',
    EM_ROTA: 'bg-blue-100 text-blue-800',
    FINALIZADA: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-red-100 text-red-800',
  };

  const paradaStatusColors = {
    PENDENTE: 'bg-yellow-100 text-yellow-800',
    PARCIAL: 'bg-orange-100 text-orange-800',
    ENTREGUE: 'bg-green-100 text-green-800',
    CANCELADA: 'bg-red-100 text-red-800',
  };

  // Buscar paradas da viagem
  const { data: paradasData = [], isLoading: loadingParadas } = useQuery({
    queryKey: ['paradas-viagem', viagem?.id],
    queryFn: () => base44.entities.ParadaViagem.filter({ viagem_id: viagem.id }, 'ordem', 100),
  });

  const { data: itensMap = {} } = useQuery({
    queryKey: ['itens-paradas', viagem?.id],
    queryFn: async () => {
      const itens = await base44.entities.ParadaViagemItem.list();
      const map = {};
      for (const item of itens) {
        if (!map[item.parada_viagem_id]) map[item.parada_viagem_id] = [];
        map[item.parada_viagem_id].push(item);
      }
      return map;
    },
  });

  // Inicializar paradas
  React.useEffect(() => {
    if (paradasData.length > 0) {
      setParadas(paradasData.map(p => ({ ...p, itens: itensMap[p.id] || [] })));
    }
  }, [paradasData, itensMap]);

  const handleDragEnd = (result) => {
    const { source, destination } = result;
    if (!destination) return;

    const newParadas = Array.from(paradas);
    const [moved] = newParadas.splice(source.index, 1);
    newParadas.splice(destination.index, 0, moved);

    // Atualizar ordem
    const updatedParadas = newParadas.map((p, i) => ({ ...p, ordem: i + 1 }));
    setParadas(updatedParadas);
  };

  const handleQuantidadeEntregue = (paradaIdx, itemIdx, novaQtd) => {
    const newParadas = [...paradas];
    newParadas[paradaIdx].itens[itemIdx].quantidade_entregue = Number(novaQtd);
    setParadas(newParadas);
  };

  const confirmarEntregaParada = async (paradaIdx) => {
    const parada = paradas[paradaIdx];
    const itens = parada.itens || [];

    if (itens.length === 0) {
      toast.error('Parada não possui itens');
      return;
    }

    // Validar que quantidade_entregue foi preenchida
    const temSemQtd = itens.some(i => !i.quantidade_entregue || Number(i.quantidade_entregue) === 0);
    if (temSemQtd) {
      toast.error('Preencha a quantidade entregue para todos os itens');
      return;
    }

    // Calcular novo status
    const temIncompleto = itens.some(i => Number(i.quantidade_entregue) < Number(i.quantidade_planejada));
    const novoStatus = temIncompleto ? 'PARCIAL' : 'ENTREGUE';

    setConfirmando(true);
    try {
      // 1. Criar movimentações de estoque para CADA item entregue
      for (const item of itens) {
        const qtdEntregue = Number(item.quantidade_entregue);
        if (qtdEntregue > 0) {
          await base44.entities.EstoqueMovimentacao.create({
            data_mov: new Date().toISOString(),
            tipo: 'ENTRADA',
            origem_local_id: null, // Não tem origem (vem de fornecedor)
            destino_local_id: parada.local_estoque_id,
            obra_id: parada.obra_id,
            material_id: item.material_id,
            material_nome: item.material_nome,
            material_unidade: item.material_unidade,
            quantidade: qtdEntregue,
            custo_unitario: item.custo_unitario_estimado || 0,
            referencia_tipo: 'VIAGEM_PARADA',
            referencia_id: parada.id,
            user_id: 'sistema', // Preenchido automaticamente
            observacao: `Entrega da viagem ${viagem.numero}`,
          });
        }
      }

      // 2. Atualizar parada
      await base44.entities.ParadaViagem.update(parada.id, {
        status: novoStatus,
        data_entrega: new Date().toISOString(),
      });

      // 3. Atualizar itens
      for (const item of itens) {
        await base44.entities.ParadaViagemItem.update(item.id, {
          quantidade_entregue: item.quantidade_entregue,
        });
      }

      // 4. Atualizar local state
      const newParadas = [...paradas];
      newParadas[paradaIdx].status = novoStatus;
      newParadas[paradaIdx].data_entrega = new Date().toISOString();
      setParadas(newParadas);

      // 5. Verificar se todas as paradas foram entregues
      const todasEntregues = newParadas.every(p => p.status === 'ENTREGUE' || p.status === 'CANCELADA' || p.status === 'PARCIAL');
      if (todasEntregues && newParadas.some(p => p.status !== 'CANCELADA')) {
        // Atualizar viagem como FINALIZADA
        await base44.entities.Viagem.update(viagem.id, {
          status: 'FINALIZADA',
          data_chegada: new Date().toISOString(),
        });
        toast.success('Viagem finalizada!');
      } else {
        toast.success(`Parada entregue (${novoStatus}) - Estoque atualizado`);
      }

      qc.invalidateQueries({ queryKey: ['paradas-viagem'] });
      onUpdate?.();
    } catch (err) {
      console.error('Erro ao confirmar entrega:', err);
      toast.error('Erro: ' + err.message);
    } finally {
      setConfirmando(false);
    }
  };

  if (loadingParadas) {
    return <div className="p-4">Carregando paradas...</div>;
  }

  return (
    <Dialog open={!!viagem} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{viagem?.numero}</span>
            <Badge className={statusColors[viagem?.status] || 'bg-gray-100'}>
              {viagem?.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Caminhão/Motorista */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <p className="font-semibold text-gray-600">Veículo</p>
                <p className="text-gray-900 break-words">{viagem?.veiculo_descricao || 'Não informado'}</p>
              </div>
              <div>
                <p className="font-semibold text-gray-600">Motorista</p>
                <p className="text-gray-900 break-words">{viagem?.motorista_nome || 'Não informado'}</p>
              </div>
              {viagem?.origem_tipo === 'FORNECEDOR' && (
                <div className="sm:col-span-2">
                  <p className="font-semibold text-gray-600">Fornecedor</p>
                  <p className="text-gray-900">{viagem?.fornecedor_nome}</p>
                </div>
              )}
            </div>
          </div>

          {/* Paradas */}
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Paradas ({paradas.length})</h3>
            
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="paradas">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {paradas.map((parada, paradaIdx) => (
                      <Draggable key={parada.id} draggableId={parada.id} index={paradaIdx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`border rounded-lg transition-all ${
                              snapshot.isDragging ? 'shadow-lg bg-blue-50' : 'bg-white'
                            }`}
                          >
                            {/* Header da Parada */}
                            <div
                              {...provided.dragHandleProps}
                              className="flex items-center justify-between p-3 cursor-move hover:bg-gray-50"
                              onClick={() =>
                                setExpandedParada(expandedParada === paradaIdx ? null : paradaIdx)
                              }
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-xs font-bold text-gray-500 bg-gray-100 rounded px-2 py-1 shrink-0">
                                  #{parada.ordem}
                                </span>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">{parada.obra_nome}</p>
                                  <p className="text-xs text-gray-500 truncate">{parada.local_estoque_nome}</p>
                                </div>
                              </div>
                              <Badge className={`shrink-0 ${paradaStatusColors[parada.status] || 'bg-gray-100'}`}>
                                {parada.status}
                              </Badge>
                              {expandedParada === paradaIdx ? (
                                <ChevronUp className="w-5 h-5 text-gray-500 shrink-0" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-500 shrink-0" />
                              )}
                            </div>

                            {/* Conteúdo Expandido */}
                            {expandedParada === paradaIdx && (
                              <div className="border-t p-3 space-y-3 bg-gray-50">
                                {/* Itens */}
                                <div>
                                  <h4 className="font-semibold text-sm text-gray-900 mb-2">Itens</h4>
                                  <div className="space-y-2">
                                    {parada.itens && parada.itens.length > 0 ? (
                                      parada.itens.map((item, itemIdx) => (
                                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white p-2 rounded border">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 break-words">
                                              {item.material_nome}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                              Planejado: {Number(item.quantidade_planejada).toLocaleString('pt-BR')} {item.material_unidade}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-1 sm:shrink-0">
                                            <span className="text-xs text-gray-500">Entregue:</span>
                                            <Input
                                              type="number"
                                              min="0"
                                              step="0.001"
                                              className="h-7 w-20 text-xs text-right"
                                              value={item.quantidade_entregue || 0}
                                              onChange={(e) =>
                                                handleQuantidadeEntregue(
                                                  paradaIdx,
                                                  itemIdx,
                                                  e.target.value
                                                )
                                              }
                                              disabled={parada.status === 'ENTREGUE' || parada.status === 'CANCELADA'}
                                            />
                                            <span className="text-xs text-gray-500">{item.material_unidade}</span>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-gray-500 italic">Nenhum item nesta parada</p>
                                    )}
                                  </div>
                                </div>

                                {/* Observação */}
                                {parada.observacao && (
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-1">Observação</p>
                                    <p className="text-sm text-gray-700">{parada.observacao}</p>
                                  </div>
                                )}

                                {/* Anexar NF na Parada */}
                                <BotaoAnexarNFGasto
                                  referencia_tipo="PARADA_ENTREGA"
                                  referencia_id={parada.id}
                                  referencia_nome={parada.obra_nome}
                                  obra_id={parada.obra_id}
                                  podeEditar={parada.status !== 'ENTREGUE' && parada.status !== 'CANCELADA'}
                                  onSuccess={() => qc.invalidateQueries({ queryKey: ['paradas-viagem'] })}
                                />

                                {/* Botão Confirmar */}
                                {parada.status === 'PENDENTE' && (
                                  <Button
                                    className="w-full bg-green-600 hover:bg-green-700 gap-2"
                                    onClick={() => confirmarEntregaParada(paradaIdx)}
                                    disabled={confirmando}
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                    {confirmando ? 'Confirmando...' : 'Confirmar Entrega desta Obra'}
                                  </Button>
                                )}
                                {parada.status === 'PARCIAL' && (
                                  <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded p-2">
                                    <AlertCircle className="w-4 h-4" />
                                    Entrega parcial confirmada
                                  </div>
                                )}
                                {parada.status === 'ENTREGUE' && (
                                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Entrega completa confirmada
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>

          {viagem?.observacao && (
            <div>
              <p className="text-sm font-semibold text-gray-600 mb-1">Observação Geral</p>
              <p className="text-sm text-gray-700">{viagem.observacao}</p>
            </div>
          )}

          {/* Anexar NF */}
          <div className="border-t pt-3 mt-3">
            <BotaoAnexarNF
              referencia_tipo="VIAGEM"
              referencia_id={viagem?.id}
              onAnexado={() => qc.invalidateQueries({ queryKey: ['nf-vinculos'] })}
              variant="outline"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}