import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';

export default function FormEntradaAvulsaComNF({ open, onClose, onSuccess }) {
  const qc = useQueryClient();
  const [localId, setLocalId] = useState('');
  const [itens, setItens] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [movimentacaoId, setMovimentacaoId] = useState(null);

  const { data: locais = [] } = useQuery({
    queryKey: ['locais-estoque'],
    queryFn: () => base44.entities.LocalEstoque.filter({ ativo: true }, 'nome', 50),
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['insumos-entrada-avulsa'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000).catch(() => []),
    enabled: open,
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!localId || itens.length === 0) {
        throw new Error('Preencha local e adicione itens');
      }

      // Criar uma movimentação base para vincular com NF
      const mov = await base44.entities.EstoqueMovimentacao.create({
        data_mov: new Date().toISOString(),
        tipo: 'ENTRADA',
        destino_local_id: localId,
        quantidade: 0, // Será preenchido pelo primeiro item
        material_id: itens[0]?.material_id,
        material_nome: itens[0]?.material_nome,
        material_unidade: itens[0]?.material_unidade,
        referencia_tipo: 'ESTOQUE_ENTRADA',
        observacao,
      });

      // Criar movimentações para cada item
      for (const item of itens) {
        await base44.entities.EstoqueMovimentacao.create({
          data_mov: new Date().toISOString(),
          tipo: 'ENTRADA',
          destino_local_id: localId,
          material_id: item.material_id,
          material_nome: item.material_nome,
          material_unidade: item.material_unidade,
          quantidade: item.quantidade,
          custo_unitario: item.custo_unitario || 0,
          referencia_tipo: 'ESTOQUE_ENTRADA',
          referencia_id: mov.id,
          observacao,
        });
      }

      setMovimentacaoId(mov.id);
      return mov;
    },
    onSuccess: () => {
      toast.success('Entrada criada com sucesso');
      qc.invalidateQueries({ queryKey: ['estoque-movs-all'] });
    },
    onError: (err) => {
      toast.error('Erro: ' + err.message);
    },
  });

  const handleAddItem = () => {
    setItens([...itens, { material_id: '', material_nome: '', material_unidade: '', quantidade: 0, custo_unitario: 0 }]);
  };

  const handleRemoveItem = (idx) => {
    setItens(itens.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    const newItens = [...itens];
    newItens[idx][field] = value;
    
    // Carregar nome e unidade do material
    if (field === 'material_id') {
      const mat = materiais.find(m => m.id === value);
      if (mat) {
        newItens[idx].material_nome = mat.descricao;
        newItens[idx].material_unidade = mat.unidade;
      }
    }
    setItens(newItens);
  };

  const handleClose = () => {
    setLocalId('');
    setItens([]);
    setObservacao('');
    setMovimentacaoId(null);
    onClose();
  };

  const handleSuccess = () => {
    handleClose();
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entrada Avulsa de Estoque</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Local */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local de Destino</label>
            <ComboboxBusca
              options={locais.map(l => ({ value: l.id, label: `${l.nome} (${l.tipo})` }))}
              value={localId}
              onSelect={(v) => setLocalId(v || '')}
              placeholder="Selecionar local..."
              searchPlaceholder="Buscar local..."
              emptyMessage="Nenhum local encontrado."
              disabled={!!movimentacaoId}
              buscarParaListar
              dicaBusca="Digite para buscar o local..."
            />
          </div>

          {/* Itens */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">Itens</label>
              {!movimentacaoId && (
                <Button size="sm" variant="outline" onClick={handleAddItem} className="gap-1">
                  <Plus className="w-3 h-3" /> Adicionar Item
                </Button>
              )}
            </div>

            <div className="space-y-2">
              {itens.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Nenhum item adicionado</p>
              ) : (
                itens.map((item, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
                      <ComboboxBusca
                        options={materiais.map(m => ({ value: m.id, label: `${m.descricao || '—'}${m.unidade ? ` (${m.unidade})` : ''}` }))}
                        value={item.material_id}
                        onSelect={(v) => handleItemChange(idx, 'material_id', v)}
                        placeholder="Material..."
                        searchPlaceholder="Buscar material..."
                        emptyMessage="Nenhum material encontrado."
                        disabled={!!movimentacaoId}
                        buscarParaListar
                        dicaBusca="Digite para buscar o material..."
                        className="text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Qtd"
                        value={item.quantidade}
                        onChange={(e) => handleItemChange(idx, 'quantidade', e.target.value)}
                        disabled={!!movimentacaoId}
                        className="h-11 text-xs"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Custo unitário"
                        value={item.custo_unitario}
                        onChange={(e) => handleItemChange(idx, 'custo_unitario', e.target.value)}
                        disabled={!!movimentacaoId}
                        className="h-11 text-xs"
                      />
                    </div>
                    {!movimentacaoId && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-red-500 hover:text-red-700 h-6"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
            <Textarea
              placeholder="Observações adicionais..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={!!movimentacaoId}
              className="text-xs"
              rows={2}
            />
          </div>

          {/* Anexar NF */}
          {movimentacaoId && (
            <div className="border-t pt-4">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">Documentação Fiscal</h3>
              <BotaoAnexarNFGasto
                referencia_tipo="ESTOQUE_ENTRADA"
                referencia_id={movimentacaoId}
                referencia_nome={`Entrada Estoque`}
                podeEditar={true}
                onSuccess={() => {
                  qc.invalidateQueries({ queryKey: ['estoque-movs-all'] });
                  handleSuccess();
                }}
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end border-t pt-4">
            <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
              Cancelar
            </Button>
            {!movimentacaoId ? (
              <Button
                onClick={() => criarMutation.mutate()}
                disabled={criarMutation.isPending || !localId || itens.length === 0}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
              >
                {criarMutation.isPending ? 'Criando...' : 'Criar Entrada'}
              </Button>
            ) : (
              <Button onClick={handleSuccess} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">
                Concluir
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}