import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import DialogPosAprovacaoCompra from '../components/compras/DialogPosAprovacaoCompra';

const prioridadeConfig = {
  baixa: { label: 'Baixa', color: 'bg-blue-500/10 text-blue-400' },
  normal: { label: 'Normal', color: 'bg-gray-500/10 text-gray-400' },
  alta: { label: 'Alta', color: 'bg-orange-500/10 text-orange-400' },
  urgente: { label: 'Urgente', color: 'bg-red-500/10 text-red-400' }
};

export default function AprovacaoCompras() {
  const [searchTerm, setSearchTerm] = useState('');
  const [prioridadeFilter, setPrioridadeFilter] = useState('todos');
  const [expandedId, setExpandedId] = useState(null);
  const [requisicaoAprovada, setRequisicaoAprovada] = useState(null);
  const queryClient = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-compra-pendentes'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ 
      status: 'aguardando'
    }, '-created_date', 100)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const approveRequisition = useMutation({
    mutationFn: async (requisicaoId) => {
      return base44.entities.RequisicaoCompra.update(requisicaoId, {
        status_aprovacao: 'aprovada',
        status: 'em_cotacao',
        aprovado_por: user?.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: (_, requisicaoId) => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Requisição aprovada com sucesso!');
      const solAprovada = solicitacoes.find(s => s.id === requisicaoId);
      if (solAprovada) setRequisicaoAprovada(solAprovada);
    },
    onError: (error) => {
      toast.error('Erro ao aprovar requisição: ' + error.message);
    }
  });

  const rejectRequisition = useMutation({
    mutationFn: async (requisicaoId) => {
      return base44.entities.RequisicaoCompra.update(requisicaoId, {
        status_aprovacao: 'recusada',
        status: 'cancelada',
        aprovado_por: user?.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra-pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Requisição recusada com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao recusar requisição: ' + error.message);
    }
  });

  const getObra = (id) => obras.find(o => o.id === id);

  const filteredSolicitacoes = solicitacoes.filter(s => {
    const obra = getObra(s.obra_id);
    const matchSearch = obra?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       s.solicitante?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchPrioridade = prioridadeFilter === 'todos' || s.prioridade === prioridadeFilter;
    return matchSearch && matchPrioridade;
  });

  const urgentes = solicitacoes.filter(s => s.prioridade === 'urgente').length;
  const altas = solicitacoes.filter(s => s.prioridade === 'alta').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovação de Compras"
        subtitle="Gerenciar requisições pendentes de aprovação"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Pendentes"
          value={solicitacoes.length}
          icon={Clock}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Urgentes"
          value={urgentes}
          icon={AlertTriangle}
          iconBg="bg-red-500/10"
          iconColor="text-red-500"
        />
        <StatCard
          title="Altas"
          value={altas}
          icon={AlertTriangle}
          iconBg="bg-orange-500/10"
          iconColor="text-orange-500"
        />
        <StatCard
          title="Valor Total"
          value={`R$ ${solicitacoes.reduce((sum, s) => sum + (s.valor_total_estimado || 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`}
          icon={Filter}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Buscar por obra, título ou solicitante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-900 border-gray-800 text-white"
          />
        </div>
        <Select value={prioridadeFilter} onValueChange={setPrioridadeFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-gray-900 border-gray-800 text-white">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            <SelectItem value="todos">Todas</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Requisições Pendentes */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 bg-gray-800 rounded-2xl" />
          ))}
        </div>
      ) : filteredSolicitacoes.length === 0 ? (
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Nenhuma solicitação pendente</h3>
            <p className="text-gray-500">Todas as requisições foram processadas!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredSolicitacoes.map(solicitacao => {
            const obra = getObra(solicitacao.obra_id);
            const prioridade = prioridadeConfig[solicitacao.prioridade] || prioridadeConfig.normal;
            const totalItens = solicitacao.itens?.length || 0;
            const isExpanded = expandedId === solicitacao.id;

            return (
              <Card 
                key={solicitacao.id}
                className={cn(
                  "bg-gray-900 border-gray-800 transition-all duration-300",
                  solicitacao.prioridade === 'urgente' && 'border-red-500/50',
                  solicitacao.prioridade === 'alta' && 'border-orange-500/50'
                )}
              >
                <CardContent className="p-6">
                  <div 
                    className="cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : solicitacao.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-white font-semibold text-lg mb-2">
                          {solicitacao.titulo || `Requisição #${solicitacao.id.substring(0, 8)}`}
                        </h3>
                        <p className="text-gray-400 text-sm mb-2">{obra?.nome || 'Obra não encontrada'}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={cn("border", prioridade.color)}>
                            {prioridade.label}
                          </Badge>
                          <span className="text-gray-500 text-sm">
                            Solicitado por: <span className="text-white">{solicitacao.solicitante}</span>
                          </span>
                          <span className="text-gray-500 text-sm">
                            {new Date(solicitacao.data_solicitacao).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-500 text-sm">Itens</p>
                        <p className="text-white text-2xl font-bold">{totalItens}</p>
                        {solicitacao.valor_total_estimado > 0 && (
                          <p className="text-emerald-400 text-sm font-semibold mt-1">
                            {solicitacao.valor_total_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-800 space-y-4">
                        {solicitacao.descricao_resumo && (
                          <div>
                            <p className="text-gray-500 text-sm">Descrição</p>
                            <p className="text-gray-300">{solicitacao.descricao_resumo}</p>
                          </div>
                        )}

                        {solicitacao.itens && solicitacao.itens.length > 0 && (
                          <div>
                            <p className="text-gray-500 text-sm mb-2">Itens da Requisição</p>
                            <div className="space-y-2">
                              {solicitacao.itens.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm bg-gray-800/50 p-2 rounded">
                                  <div>
                                    <p className="text-white">{item.descricao}</p>
                                    <p className="text-gray-500">{item.quantidade_solicitada} {item.unidade}</p>
                                  </div>
                                  {item.valor_estimado && (
                                    <p className="text-emerald-400 font-semibold">
                                      {item.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {solicitacao.data_necessidade && (
                          <div>
                            <p className="text-gray-500 text-sm">Data de Necessidade</p>
                            <p className="text-white">
                              {new Date(solicitacao.data_necessidade).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-gray-800">
                          <Button
                            onClick={() => approveRequisition.mutate(solicitacao.id)}
                            disabled={approveRequisition.isPending || rejectRequisition.isPending}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Aprovar
                          </Button>
                          <Button
                            onClick={() => rejectRequisition.mutate(solicitacao.id)}
                            disabled={approveRequisition.isPending || rejectRequisition.isPending}
                            variant="outline"
                            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Recusar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog pós-aprovação */}
      <DialogPosAprovacaoCompra
        open={!!requisicaoAprovada}
        onClose={() => setRequisicaoAprovada(null)}
        requisicao={requisicaoAprovada}
        obraNome={requisicaoAprovada ? (obras.find(o => o.id === requisicaoAprovada.obra_id)?.nome || '') : ''}
      />
    </div>
  );
}