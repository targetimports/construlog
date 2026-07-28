import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  Calendar,
  Package,
  DollarSign,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ComparativoCotacoes from './ComparativoCotacoes';

const statusConfig = {
  aguardando: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  em_cotacao: { label: 'Em Cotação', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  em_compra: { label: 'Em Compra', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  recebida: { label: 'Recebida', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  recusada: { label: 'Recusada', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' }
};

export default function RequisicaoCard({ requisicao, obras, cotacoes }) {
  const [dialogComparativo, setDialogComparativo] = useState(false);
  const queryClient = useQueryClient();
  const obra = obras.find(o => o.id === requisicao.obra_id);
  const status = statusConfig[requisicao.status] || statusConfig[requisicao.status_aprovacao] || statusConfig.pendente;
  
  const cotacoesReq = cotacoes.filter(c => c.requisicao_id === requisicao.id);
  const melhorCotacao = cotacoesReq.length > 0 
    ? cotacoesReq.reduce((min, c) => c.valor_unitario < min.valor_unitario ? c : min)
    : null;

  const updateStatusMutation = useMutation({
    mutationFn: ({ status }) => base44.entities.RequisicaoCompra.update(requisicao.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Status atualizado!');
    }
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      const user = await base44.auth.me();
      await base44.functions.invoke('aprovarRequisicao', { 
        requisicao_id: requisicao.id,
        aprovado: true,
        aprovador_email: user?.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['ordens-compra'] });
      toast.success('Requisição aprovada e ordem de compra gerada!');
    }
  });

  return (
    <>
      <div className="bg-gray-800/50 rounded-2xl p-6 hover:bg-gray-800 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-white font-semibold text-lg">{requisicao.descricao_resumo || requisicao.titulo || `Requisição #${requisicao.id?.slice(0, 8)}`}</h3>
              <Badge className={cn("border", status.color)}>{status.label}</Badge>
              {requisicao.prioridade === 'urgente' && (
                <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Urgente</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
              {obra && (
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>{obra.nome}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>Necessário: {new Date(requisicao.data_necessidade).toLocaleDateString('pt-BR')}</span>
              </div>
              {requisicao.qtd_itens > 0 && (
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  <span>{requisicao.qtd_itens} {requisicao.qtd_itens === 1 ? 'item' : 'itens'}</span>
                </div>
              )}
              {requisicao.valor_total_estimado > 0 && (
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>R$ {requisicao.valor_total_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            {requisicao.observacoes && (
              <p className="text-gray-500 text-sm">{requisicao.observacoes}</p>
            )}
            {cotacoesReq.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <span className="text-blue-400 text-sm font-medium">
                  {cotacoesReq.length} cotação(ões) • Melhor preço: {melhorCotacao.valor_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{requisicao.unidade}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {cotacoesReq.length > 0 && requisicao.status !== 'comprada' && (
              <Button
                size="sm"
                onClick={() => setDialogComparativo(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Comparar
              </Button>
            )}
            {(requisicao.status === 'em_cotacao' || requisicao.status === 'cotacao') && cotacoesReq.length > 0 && (
              <Button
                size="sm"
                onClick={() => aprovarMutation.mutate()}
                disabled={aprovarMutation.isPending}
                className="bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Aprovar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-800 border-gray-700">
                {requisicao.status === 'aguardando' && (
                  <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ status: 'em_cotacao' })}>
                    Iniciar Cotação
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ status: 'cancelada' })}>
                  Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <Dialog open={dialogComparativo} onOpenChange={setDialogComparativo}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Comparativo de Cotações</DialogTitle>
          </DialogHeader>
          <ComparativoCotacoes 
            requisicao={requisicao} 
            cotacoes={cotacoesReq}
            onAprovar={() => {
              aprovarMutation.mutate();
              setDialogComparativo(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}