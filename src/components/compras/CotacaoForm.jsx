import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export default function CotacaoForm({ requisicao_id, open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [fornecedores, setFornecedores] = useState([
    { fornecedor: '', valor_unitario: '', prazo_entrega_dias: '', condicoes_pagamento: '' }
  ]);

  const { data: requisicao } = useQuery({
    queryKey: ['requisicao', requisicao_id],
    queryFn: async () => {
      const reqs = await base44.entities.RequisicaoCompra.filter({ id: requisicao_id });
      return reqs[0];
    },
    enabled: open && !!requisicao_id
  });

  const criarCotacoesMutation = useMutation({
    mutationFn: async () => {
      const cotacoesCriadas = [];
      for (const f of fornecedores) {
        if (!f.fornecedor || !f.valor_unitario) continue;
        
        const cotacao = await base44.entities.CotacaoFornecedor.create({
          requisicao_id,
          fornecedor: f.fornecedor,
          valor_unitario: parseFloat(f.valor_unitario),
          valor_total: parseFloat(f.valor_unitario) * (requisicao?.itens?.[0]?.quantidade_solicitada || 1),
          prazo_entrega_dias: parseInt(f.prazo_entrega_dias || 0),
          condicoes_pagamento: f.condicoes_pagamento,
          status: 'pendente'
        });
        cotacoesCriadas.push(cotacao);
      }
      return cotacoesCriadas;
    },
    onSuccess: (cotacoes) => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      toast.success(`${cotacoes.length} cotações criadas!`);
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const adicionarFornecedor = () => {
    setFornecedores([...fornecedores, { fornecedor: '', valor_unitario: '', prazo_entrega_dias: '', condicoes_pagamento: '' }]);
  };

  const removerFornecedor = (index) => {
    setFornecedores(fornecedores.filter((_, i) => i !== index));
  };

  const atualizarFornecedor = (index, campo, valor) => {
    const novos = [...fornecedores];
    novos[index][campo] = valor;
    setFornecedores(novos);
  };

  const handleSubmit = () => {
    const validos = fornecedores.filter(f => f.fornecedor && f.valor_unitario);
    if (validos.length < 2) {
      toast.error('Adicione pelo menos 2 fornecedores');
      return;
    }
    criarCotacoesMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Cotações - {requisicao?.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {requisicao && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="text-sm font-medium">Itens solicitados: {requisicao.qtd_itens || 0}</p>
                <p className="text-xs text-gray-600">Valor estimado: R$ {(requisicao.valor_total_estimado || 0).toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          )}

          {fornecedores.map((f, idx) => (
            <Card key={idx} className="relative">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-sm">Fornecedor {idx + 1}</p>
                  {idx > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => removerFornecedor(idx)}>
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Nome do Fornecedor *</label>
                    <Input
                      placeholder="Ex: Construtora ABC Ltda"
                      value={f.fornecedor}
                      onChange={(e) => atualizarFornecedor(idx, 'fornecedor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Valor Unitário *</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={f.valor_unitario}
                      onChange={(e) => atualizarFornecedor(idx, 'valor_unitario', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Prazo (dias)</label>
                    <Input
                      type="number"
                      placeholder="Ex: 7"
                      value={f.prazo_entrega_dias}
                      onChange={(e) => atualizarFornecedor(idx, 'prazo_entrega_dias', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Condições de Pagamento</label>
                    <Input
                      placeholder="Ex: 30 dias, à vista, parcelado"
                      value={f.condicoes_pagamento}
                      onChange={(e) => atualizarFornecedor(idx, 'condicoes_pagamento', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={adicionarFornecedor} className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Adicionar Fornecedor
          </Button>

          <p className="text-xs text-gray-500">
            Adicione pelo menos 2 fornecedores para comparação
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={criarCotacoesMutation.isPending}>
            {criarCotacoesMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Criar Cotações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}