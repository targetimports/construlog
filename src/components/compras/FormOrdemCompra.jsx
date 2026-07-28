import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

export default function FormOrdemCompra({ open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [dados, setDados] = useState({
    numero: `OC-${Date.now()}`,
    obra_id: '',
    fornecedor_id: '',
    fornecedor_nome: '',
    data_emissao: new Date().toISOString().split('T')[0],
    data_prevista_entrega: '',
    condicoes_pagamento: 'à vista',
    observacoes: '',
    destino: 'estoque_central',
    almoxarifado_id: ''
  });

  const [itens, setItens] = useState([
    { insumo_id: '', descricao: '', unidade: 'un', quantidade_solicitada: '', valor_unitario: '' }
  ]);

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-oc'],
    queryFn: () => base44.entities.Insumo.list('descricao', 500),
    enabled: open
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-oc'],
    queryFn: () => base44.entities.Obra.list('nome', 500),
    enabled: open
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almox-oc'],
    queryFn: () => base44.entities.Almoxarifado.list('nome', 100),
    enabled: open
  });

  const criarOCMutation = useMutation({
    mutationFn: async () => {
      const itensValidos = itens.filter(i => i.insumo_id && i.quantidade_solicitada);
      
      if (itensValidos.length === 0) {
        throw new Error('Adicione pelo menos 1 item');
      }

      const itensProcessados = itensValidos.map(i => ({
        ...i,
        quantidade_solicitada: parseFloat(i.quantidade_solicitada),
        valor_unitario: parseFloat(i.valor_unitario || 0),
        valor_total: parseFloat(i.quantidade_solicitada) * parseFloat(i.valor_unitario || 0),
        quantidade_recebida: 0
      }));

      const valor_subtotal = itensProcessados.reduce((s, i) => s + i.valor_total, 0);

      const oc = await base44.entities.OrdemCompra.create({
        numero: dados.numero,
        obra_id: dados.obra_id,
        fornecedor_id: dados.fornecedor_id || 'fornecedor_manual',
        fornecedor_nome: dados.fornecedor_nome,
        descricao: `OC Manual - ${itensProcessados.length} itens`,
        itens: itensProcessados,
        valor_subtotal,
        valor_total: valor_subtotal,
        data_emissao: dados.data_emissao,
        data_prevista_entrega: dados.data_prevista_entrega,
        condicoes_pagamento: dados.condicoes_pagamento,
        status: 'criada',
        status_entrega: 'nao_recebido',
        destino: dados.destino,
        almoxarifado_id: dados.almoxarifado_id,
        observacoes: dados.observacoes,
        empresa_id: 'empresa_principal'
      });

      return oc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      toast.success('Ordem de Compra criada!');
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const adicionarItem = () => {
    setItens([...itens, { insumo_id: '', descricao: '', unidade: 'un', quantidade_solicitada: '', valor_unitario: '' }]);
  };

  const removerItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const atualizarItem = (index, campo, valor) => {
    const novos = [...itens];
    novos[index][campo] = valor;
    
    // Auto-preencher descrição e unidade do insumo
    if (campo === 'insumo_id' && valor) {
      const insumo = insumos.find(i => i.id === valor);
      if (insumo) {
        novos[index].descricao = insumo.descricao;
        novos[index].unidade = insumo.unidade;
      }
    }
    
    setItens(novos);
  };

  const calcularTotal = () => {
    return itens.reduce((s, i) => {
      const qtd = parseFloat(i.quantidade_solicitada || 0);
      const valor = parseFloat(i.valor_unitario || 0);
      return s + (qtd * valor);
    }, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Ordem de Compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Número OC</label>
              <Input value={dados.numero} onChange={(e) => setDados({...dados, numero: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Emissão</label>
              <Input type="date" value={dados.data_emissao} onChange={(e) => setDados({...dados, data_emissao: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Obra *</label>
              <Select value={dados.obra_id} onValueChange={(v) => setDados({...dados, obra_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fornecedor *</label>
              <Input 
                placeholder="Nome do fornecedor" 
                value={dados.fornecedor_nome} 
                onChange={(e) => setDados({...dados, fornecedor_nome: e.target.value})} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Prazo de Entrega</label>
              <Input type="date" value={dados.data_prevista_entrega} onChange={(e) => setDados({...dados, data_prevista_entrega: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condições de Pagamento</label>
              <Input value={dados.condicoes_pagamento} onChange={(e) => setDados({...dados, condicoes_pagamento: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Destino</label>
              <Select value={dados.destino} onValueChange={(v) => setDados({...dados, destino: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estoque_central">Estoque Central</SelectItem>
                  <SelectItem value="obra">Obra Específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Depósito Destino</label>
              <Select value={dados.almoxarifado_id} onValueChange={(v) => setDados({...dados, almoxarifado_id: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {almoxarifados.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Itens */}
          <div className="border-t pt-4">
            <p className="font-semibold mb-3">Itens da OC</p>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-4 gap-2">
                        <div>
                          <label className="block text-xs font-medium mb-1">Insumo *</label>
                          <Select value={item.insumo_id} onValueChange={(v) => atualizarItem(idx, 'insumo_id', v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {insumos.map(i => (
                                <SelectItem key={i.id} value={i.id}>{i.descricao}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Quantidade *</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantidade_solicitada}
                            onChange={(e) => atualizarItem(idx, 'quantidade_solicitada', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Valor Unit.</label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.valor_unitario}
                            onChange={(e) => atualizarItem(idx, 'valor_unitario', e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Total</label>
                          <Input
                            value={(parseFloat(item.quantidade_solicitada || 0) * parseFloat(item.valor_unitario || 0)).toFixed(2)}
                            disabled
                          />
                        </div>
                      </div>
                      {idx > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => removerItem(idx)}>
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={adicionarItem} className="mt-2 w-full gap-2">
              <Plus className="w-4 h-4" />
              Adicionar Item
            </Button>
          </div>

          <Card className="bg-gray-50">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <p className="font-semibold">Valor Total</p>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {calcularTotal().toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                </p>
              </div>
            </CardContent>
          </Card>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <Textarea
              placeholder="Informações adicionais..."
              value={dados.observacoes}
              onChange={(e) => setDados({...dados, observacoes: e.target.value})}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => criarOCMutation.mutate()} disabled={criarOCMutation.isPending}>
            {criarOCMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar OC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}