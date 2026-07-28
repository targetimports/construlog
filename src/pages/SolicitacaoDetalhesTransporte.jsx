import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function SolicitacaoDetalhesTransporte() {
  const urlParams = new URLSearchParams(window.location.search);
  const solicitacaoId = urlParams.get('id');
  const queryClient = useQueryClient();
  const [dialogNegar, setDialogNegar] = useState(false);
  const [motivoNegacao, setMotivoNegacao] = useState('');

  const { data: solicitacao, isLoading } = useQuery({
    queryKey: ['solicitacao-transporte', solicitacaoId],
    queryFn: () => base44.entities.SolicitacaoTransporte.filter({ id: solicitacaoId }).then(r => r[0]),
    enabled: !!solicitacaoId
  });

  const { data: obra } = useQuery({
    queryKey: ['obra', solicitacao?.obra_id],
    queryFn: () => base44.entities.Obra.filter({ id: solicitacao?.obra_id }).then(r => r[0]),
    enabled: !!solicitacao?.obra_id
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.SolicitacaoTransporte.update(solicitacaoId, {
        status: 'aprovada',
        aprovado_por_user_id: user?.email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao-transporte', solicitacaoId] });
      toast.success('Solicitação aprovada!');
    }
  });

  const negarMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.SolicitacaoTransporte.update(solicitacaoId, {
        status: 'cancelada',
        motivo_cancelamento: motivoNegacao,
        cancelada_por_user_id: user?.email,
        data_cancelamento: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacao-transporte', solicitacaoId] });
      setDialogNegar(false);
      setMotivoNegacao('');
      toast.success('Solicitação negada!');
    }
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <PageSkeleton kpis={4} rows={6} cols={4} />
      </div>
    );
  }

  if (!solicitacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Solicitação não encontrada</p>
      </div>
    );
  }

  const statusConfig = {
    solicitada: { label: 'Aguardando Aprovação', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    aprovada: { label: 'Aprovada', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    cancelada: { label: 'Negada', color: 'bg-red-100 text-red-800', icon: XCircle }
  };

  const config = statusConfig[solicitacao.status] || statusConfig.solicitada;
  const StatusIcon = config.icon;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.history.back()}
          className="text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900">Solicitação de Transporte</h1>
          <p className="text-gray-600">{solicitacao.numero}</p>
        </div>
        <Badge className={config.color}>
          <StatusIcon className="w-4 h-4 mr-1" />
          {config.label}
        </Badge>
      </div>

      {/* Informações Principais */}
      <Card>
        <CardHeader>
          <CardTitle>Informações da Solicitação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tipo</p>
              <p className="font-medium">{solicitacao.tipo.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Obra</p>
              <p className="font-medium">{obra?.nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Prioridade</p>
              <Badge variant="outline">{solicitacao.prioridade}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Solicitação</p>
              <p className="font-medium">{new Date(solicitacao.data_solicitacao).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Origem</p>
                <p className="font-medium">{solicitacao.origem}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Destino</p>
                <p className="font-medium">{solicitacao.destino}</p>
              </div>
            </div>
            {solicitacao.observacoes && (
              <div>
                <p className="text-sm text-gray-600">Observações</p>
                <p className="font-medium">{solicitacao.observacoes}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status da Aprovação */}
      {solicitacao.status === 'aprovada' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="font-semibold text-green-900">Solicitação Aprovada</p>
                <p className="text-sm text-green-800">
                  Aprovada por {solicitacao.aprovado_por_user_id} em{' '}
                  {new Date(solicitacao.data_aprovacao).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Motivo da Negação */}
      {solicitacao.status === 'cancelada' && solicitacao.motivo_cancelamento && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">Solicitação Negada</p>
                <p className="text-sm text-red-800 mt-2">{solicitacao.motivo_cancelamento}</p>
                <p className="text-xs text-red-700 mt-2">
                  Negada por {solicitacao.cancelada_por_user_id} em{' '}
                  {new Date(solicitacao.data_cancelamento).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ações */}
      {solicitacao.status === 'solicitada' && (
        <div className="flex gap-3 justify-end">
          <Button
            onClick={() => setDialogNegar(true)}
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Negar
          </Button>
          <Button
            onClick={() => aprovarMutation.mutate()}
            disabled={aprovarMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Aprovar
          </Button>
        </div>
      )}

      {/* Dialog Negar */}
      <Dialog open={dialogNegar} onOpenChange={setDialogNegar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Negar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Motivo da Negação *</label>
              <Textarea
                value={motivoNegacao}
                onChange={(e) => setMotivoNegacao(e.target.value)}
                placeholder="Descreva o motivo da negação..."
                rows={4}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogNegar(false);
                  setMotivoNegacao('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => negarMutation.mutate()}
                disabled={negarMutation.isPending || !motivoNegacao.trim()}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirmar Negação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}