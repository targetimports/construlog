import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  DollarSign, 
  Plus, 
  CheckCircle,
  XCircle,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CotacoesItem({ itemId, valorOrcado }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    fornecedor_id: '',
    valor_unitario: '',
    prazo_entrega_dias: '',
    condicoes_pagamento: '',
    validade_cotacao: '',
    observacoes: ''
  });
  const queryClient = useQueryClient();

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.filter({ status: 'ativo' })
  });

  const { data: cotacoes = [] } = useQuery({
    queryKey: ['cotacoes-item', itemId],
    queryFn: () => base44.entities.CotacaoFornecedor.filter({ item_orcamento_id: itemId }),
    enabled: !!itemId
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const fornecedor = fornecedores.find(f => f.id === data.fornecedor_id);
      const valorTotal = data.valor_unitario * (data.quantidade || 1);
      return base44.entities.CotacaoFornecedor.create({
        ...data,
        item_orcamento_id: itemId,
        fornecedor: fornecedor?.nome || '',
        contato_fornecedor: fornecedor?.email || '',
        valor_total: valorTotal
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes-item', itemId] });
      toast.success('Cotação adicionada!');
      setDialogOpen(false);
      setFormData({
        fornecedor_id: '',
        valor_unitario: '',
        prazo_entrega_dias: '',
        condicoes_pagamento: '',
        validade_cotacao: '',
        observacoes: ''
      });
    }
  });

  const aprovarMutation = useMutation({
    mutationFn: (id) => base44.entities.CotacaoFornecedor.update(id, { status: 'aprovada' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes-item', itemId] });
      toast.success('Cotação aprovada!');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      valor_unitario: parseFloat(formData.valor_unitario),
      prazo_entrega_dias: formData.prazo_entrega_dias ? parseInt(formData.prazo_entrega_dias) : null
    });
  };

  const melhorCotacao = cotacoes.length > 0 
    ? cotacoes.reduce((min, c) => c.valor_unitario < min.valor_unitario ? c : min)
    : null;

  return (
    <>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            Cotações de Fornecedores
            {cotacoes.length > 0 && (
              <Badge variant="outline" className="border-gray-700 text-gray-400">
                {cotacoes.length}
              </Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          {cotacoes.length === 0 ? (
            <div className="text-center py-6">
              <DollarSign className="w-10 h-10 text-gray-700 mx-auto mb-2" />
              <p className="text-gray-500 text-sm mb-3">Nenhuma cotação registrada</p>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Cotação
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {cotacoes.map((cotacao) => {
                const isMelhor = melhorCotacao?.id === cotacao.id;
                const diffOrcado = ((cotacao.valor_unitario - valorOrcado) / valorOrcado) * 100;
                const economico = cotacao.valor_unitario < valorOrcado;

                return (
                  <div
                    key={cotacao.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all",
                      isMelhor 
                        ? "bg-emerald-500/10 border-emerald-500/30" 
                        : "bg-gray-800/50 border-gray-700"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-medium">{cotacao.fornecedor}</h4>
                          {isMelhor && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                              Melhor Preço
                            </Badge>
                          )}
                          {cotacao.status === 'aprovada' && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Aprovada
                            </Badge>
                          )}
                        </div>
                        {cotacao.contato_fornecedor && (
                          <p className="text-gray-500 text-xs">{cotacao.contato_fornecedor}</p>
                        )}
                      </div>
                      {cotacao.status === 'pendente' && (
                        <Button
                          size="sm"
                          onClick={() => aprovarMutation.mutate(cotacao.id)}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white h-7"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Aprovar
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">Valor Unitário</p>
                        <p className="text-white font-semibold">
                          {cotacao.valor_unitario.toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">vs Orçado</p>
                        <div className="flex items-center gap-1">
                          {economico ? (
                            <TrendingDown className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <TrendingUp className="w-4 h-4 text-red-400" />
                          )}
                          <p className={cn(
                            "font-semibold",
                            economico ? "text-emerald-400" : "text-red-400"
                          )}>
                            {economico ? '' : '+'}{diffOrcado.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                      {cotacao.prazo_entrega_dias && (
                        <div>
                          <p className="text-gray-400 text-xs">Prazo Entrega</p>
                          <p className="text-white">{cotacao.prazo_entrega_dias} dias</p>
                        </div>
                      )}
                      {cotacao.condicoes_pagamento && (
                        <div>
                          <p className="text-gray-400 text-xs">Pagamento</p>
                          <p className="text-white">{cotacao.condicoes_pagamento}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nova Cotação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Nova Cotação</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label className="text-gray-400">Fornecedor *</Label>
                <Select 
                  value={formData.fornecedor_id} 
                  onValueChange={(v) => setFormData({ ...formData, fornecedor_id: v })}
                >
                  <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Selecione o fornecedor" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700">
                    {fornecedores.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.nome} {f.nome_fantasia && `(${f.nome_fantasia})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-400">Valor Unitário *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => setFormData({ ...formData, valor_unitario: e.target.value })}
                  required
                  placeholder="0,00"
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Prazo Entrega (dias)</Label>
                <Input
                  type="number"
                  value={formData.prazo_entrega_dias}
                  onChange={(e) => setFormData({ ...formData, prazo_entrega_dias: e.target.value })}
                  placeholder="Ex: 15"
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Condições Pagamento</Label>
                <Input
                  value={formData.condicoes_pagamento}
                  onChange={(e) => setFormData({ ...formData, condicoes_pagamento: e.target.value })}
                  placeholder="Ex: 30 dias"
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400">Validade</Label>
                <Input
                  type="date"
                  value={formData.validade_cotacao}
                  onChange={(e) => setFormData({ ...formData, validade_cotacao: e.target.value })}
                  className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                Adicionar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}