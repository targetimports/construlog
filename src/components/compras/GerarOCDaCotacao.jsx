import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingDown, Trophy } from 'lucide-react';
import { toast } from 'sonner';

export default function GerarOCDaCotacao({ requisicao_id, open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState(null);

  const { data: cotacoes = [] } = useQuery({
    queryKey: ['cotacoes-req', requisicao_id],
    queryFn: async () => {
      return await base44.entities.CotacaoFornecedor.filter({ requisicao_id });
    },
    enabled: open && !!requisicao_id
  });

  const { data: requisicao } = useQuery({
    queryKey: ['req', requisicao_id],
    queryFn: async () => {
      const reqs = await base44.entities.RequisicaoCompra.filter({ id: requisicao_id });
      return reqs[0];
    },
    enabled: open && !!requisicao_id
  });

  const { data: obra } = useQuery({
    queryKey: ['obra-oc', requisicao?.obra_id],
    queryFn: async () => {
      const o = await base44.entities.Obra.filter({ id: requisicao.obra_id });
      return o[0];
    },
    enabled: open && !!requisicao?.obra_id
  });

  const gerarOCMutation = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('gerarOCDaCotacao', {
        requisicao_id,
        cotacao_id: cotacaoSelecionada
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Ordem de Compra gerada com sucesso!');
      onSuccess?.();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    }
  });

  const cotacoesOrdenadas = [...cotacoes].sort((a, b) => a.valor_total - b.valor_total);
  const melhorPreco = cotacoesOrdenadas[0];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar Ordem de Compra</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {requisicao && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-4">
                <p className="font-semibold">{requisicao.titulo}</p>
                <p className="text-sm text-gray-600">Obra: {obra?.nome || requisicao.obra_id || 'Não vinculada'}</p>
              </CardContent>
            </Card>
          )}

          <p className="text-sm font-medium">Selecione o fornecedor vencedor:</p>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {cotacoesOrdenadas.map((cot, idx) => (
              <Card
                key={cot.id}
                className={`cursor-pointer transition-all ${
                  cotacaoSelecionada === cot.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                }`}
                onClick={() => setCotacaoSelecionada(cot.id)}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold">{cot.fornecedor}</p>
                        {idx === 0 && (
                          <Badge className="bg-green-100 text-green-800 gap-1">
                            <Trophy className="w-3 h-3" />
                            Melhor Preço
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-gray-500">Valor Total</p>
                          <p className="font-bold text-lg">R$ {(cot.valor_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Prazo</p>
                          <p className="font-semibold">{cot.prazo_entrega_dias || 0} dias</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Pagamento</p>
                          <p className="font-semibold text-xs">{cot.condicoes_pagamento || 'À vista'}</p>
                        </div>
                      </div>
                    </div>
                    {cotacaoSelecionada === cot.id && (
                      <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white"></div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {cotacoesOrdenadas.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Nenhuma cotação disponível para esta requisição
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={() => gerarOCMutation.mutate()} 
            disabled={!cotacaoSelecionada || gerarOCMutation.isPending}
          >
            {gerarOCMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Gerar OC
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}