import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, Clock, Package, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import { cn } from '@/lib/utils';
import DialogPosAprovacaoCompra from '../components/compras/DialogPosAprovacaoCompra';

export default function AprovarCompras() {
  const queryClient = useQueryClient();
  const [solicitacaoSelecionada, setSolicitacaoSelecionada] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [acao, setAcao] = useState(''); // 'aprovar' ou 'recusar'
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [requisicaoAprovada, setRequisicaoAprovada] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: solicitacoesPendentes = [] } = useQuery({
    queryKey: ['solicitacoes-pendentes'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ status_aprovacao: 'pendente' }, '-created_date')
  });

  const { data: solicitacoesAprovadas = [] } = useQuery({
    queryKey: ['solicitacoes-aprovadas'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ status_aprovacao: 'aprovada' }, '-created_date', 20)
  });

  const { data: solicitacoesRecusadas = [] } = useQuery({
    queryKey: ['solicitacoes-recusadas'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ status_aprovacao: 'recusada' }, '-created_date', 20)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const aprovarRecusarMutation = useMutation({
    mutationFn: async ({ id, aprovado, motivo }) => {
      const updates = {
        status_aprovacao: aprovado ? 'aprovada' : 'recusada',
        aprovado_por: user.email,
        data_aprovacao: new Date().toISOString()
      };
      
      if (!aprovado && motivo) {
        updates.motivo_recusa = motivo;
      }
      
      if (aprovado) {
        updates.status = 'em_cotacao';
      } else {
        updates.status = 'recusada';
      }

      return await base44.entities.RequisicaoCompra.update(id, updates);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['solicitacoes-pendentes']);
      queryClient.invalidateQueries(['solicitacoes-aprovadas']);
      queryClient.invalidateQueries(['solicitacoes-recusadas']);
      toast.success(variables.aprovado ? 'Solicitação aprovada!' : 'Solicitação recusada');
      setModalAberto(false);
      if (variables.aprovado) {
        setRequisicaoAprovada(solicitacaoSelecionada);
      }
      setSolicitacaoSelecionada(null);
      setMotivoRecusa('');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleAprovar = (solicitacao) => {
    setSolicitacaoSelecionada(solicitacao);
    setAcao('aprovar');
    setModalAberto(true);
  };

  const handleRecusar = (solicitacao) => {
    setSolicitacaoSelecionada(solicitacao);
    setAcao('recusar');
    setModalAberto(true);
  };

  const handleConfirmar = () => {
    if (acao === 'recusar' && !motivoRecusa.trim()) {
      toast.error('Informe o motivo da recusa');
      return;
    }

    aprovarRecusarMutation.mutate({
      id: solicitacaoSelecionada.id,
      aprovado: acao === 'aprovar',
      motivo: motivoRecusa
    });
  };

  const SolicitacaoCard = ({ solicitacao, showActions = false }) => {
    const obra = obras.find(o => o.id === solicitacao.obra_id);
    const prioridadeColors = {
      baixa: 'bg-gray-100 text-gray-700',
      normal: 'bg-blue-100 text-blue-700',
      alta: 'bg-orange-100 text-orange-700',
      urgente: 'bg-red-100 text-red-700'
    };

    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 mb-1">{solicitacao.titulo}</h3>
              <p className="text-sm text-gray-600 mb-2">{solicitacao.descricao_resumo}</p>
              <div className="flex flex-wrap gap-2">
                <Badge className={prioridadeColors[solicitacao.prioridade]}>
                  {solicitacao.prioridade?.toUpperCase() || 'NORMAL'}
                </Badge>
                {obra && (
                  <Badge variant="outline" className="text-xs">
                    {obra.nome}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-500">Solicitante:</span>
              <p className="font-medium text-gray-900">{solicitacao.solicitante}</p>
            </div>
            <div>
              <span className="text-gray-500">Data:</span>
              <p className="font-medium text-gray-900">
                {new Date(solicitacao.data_solicitacao).toLocaleDateString('pt-BR')}
              </p>
            </div>
            {solicitacao.data_necessidade && (
              <div>
                <span className="text-gray-500">Necessidade:</span>
                <p className="font-medium text-gray-900">
                  {new Date(solicitacao.data_necessidade).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Itens:</span>
              <p className="font-medium text-gray-900">{solicitacao.itens?.length || 0}</p>
            </div>
          </div>

          {solicitacao.justificativa && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-semibold text-blue-900 mb-1">Justificativa:</p>
              <p className="text-sm text-blue-800">{solicitacao.justificativa}</p>
            </div>
          )}

          {solicitacao.motivo_recusa && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs font-semibold text-red-900 mb-1">Motivo da Recusa:</p>
              <p className="text-sm text-red-800">{solicitacao.motivo_recusa}</p>
            </div>
          )}

          {solicitacao.itens && solicitacao.itens.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">Itens solicitados:</p>
              <div className="space-y-1">
                {solicitacao.itens.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <span className="text-gray-900">{item.descricao}</span>
                    <span className="text-gray-600 font-medium">
                      {item.quantidade_solicitada} {item.unidade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showActions && (
            <div className="flex gap-3 pt-4 border-t">
              <Button
                onClick={() => handleRecusar(solicitacao)}
                variant="outline"
                className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Recusar
              </Button>
              <Button
                onClick={() => handleAprovar(solicitacao)}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aprovar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Verificar se usuário é admin
  if (!['admin', 'programador'].includes(user?.role) && user?.acesso_global !== true) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovar Solicitações de Compra"
        subtitle="Gerencie as solicitações de equipamentos dos usuários"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium mb-1">Pendentes</p>
                <p className="text-4xl font-bold">{solicitacoesPendentes.length}</p>
              </div>
              <Clock className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Aprovadas</p>
                <p className="text-4xl font-bold">{solicitacoesAprovadas.length}</p>
              </div>
              <CheckCircle2 className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-red-500 to-rose-500 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium mb-1">Recusadas</p>
                <p className="text-4xl font-bold">{solicitacoesRecusadas.length}</p>
              </div>
              <XCircle className="w-12 h-12 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Solicitações Pendentes */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6 text-amber-500" />
          Aguardando Aprovação ({solicitacoesPendentes.length})
        </h2>
        {solicitacoesPendentes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhuma solicitação pendente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {solicitacoesPendentes.map(sol => (
              <SolicitacaoCard key={sol.id} solicitacao={sol} showActions={true} />
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação */}
      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {acao === 'aprovar' ? 'Aprovar Solicitação' : 'Recusar Solicitação'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {acao === 'aprovar' ? (
              <p className="text-gray-600">
                Confirma a aprovação desta solicitação? Ela será enviada para cotação.
              </p>
            ) : (
              <div>
                <p className="text-gray-600 mb-4">
                  Informe o motivo da recusa para o solicitante:
                </p>
                <Textarea
                  value={motivoRecusa}
                  onChange={(e) => setMotivoRecusa(e.target.value)}
                  placeholder="Digite o motivo..."
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={aprovarRecusarMutation.isPending}
              className={acao === 'aprovar' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {aprovarRecusarMutation.isPending ? 'Processando...' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pós-aprovação: opções de destino */}
      <DialogPosAprovacaoCompra
        open={!!requisicaoAprovada}
        onClose={() => setRequisicaoAprovada(null)}
        requisicao={requisicaoAprovada}
        obraNome={requisicaoAprovada ? obras.find(o => o.id === requisicaoAprovada.obra_id)?.nome : ''}
      />
    </div>
  );
}