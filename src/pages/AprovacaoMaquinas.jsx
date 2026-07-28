import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

export default function AprovacaoMaquinas() {
  const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
  const [acaoDialog, setAcaoDialog] = useState(null); // 'aprovar' ou 'rejeitar'
  const [motivo, setMotivo] = useState('');

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Buscar solicitações enviadas para este admin
  const { data: solicitacoesPendentes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-pendentes', user?.email],
    queryFn: async () => {
      const todas = await base44.entities.SolicitacaoMaquina.list('-created_date', 100);
      return todas.filter(s => 
        s.responsavel_superior_email === user?.email && 
        (s.status === 'enviado' || s.status === 'rascunho')
      );
    },
    enabled: !!user?.email
  });

  const aproveMutation = useMutation({
    mutationFn: (id) => 
      base44.entities.SolicitacaoMaquina.update(id, {
        status: 'aprovado',
        data_aprovacao: new Date().toISOString()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-pendentes'] });
      toast.success('Solicitação aprovada!');
      setSelectedSolicitacao(null);
      setAcaoDialog(null);
      setMotivo('');
    },
    onError: (error) => {
      toast.error('Erro ao aprovar: ' + error.message);
    }
  });

  const rejeiteMutation = useMutation({
    mutationFn: (id) => 
      base44.entities.SolicitacaoMaquina.update(id, {
        status: 'recusado',
        motivo_recusa: motivo,
        data_aprovacao: new Date().toISOString()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-pendentes'] });
      toast.success('Solicitação recusada!');
      setSelectedSolicitacao(null);
      setAcaoDialog(null);
      setMotivo('');
    },
    onError: (error) => {
      toast.error('Erro ao rejeitar: ' + error.message);
    }
  });

  const handleAprovar = () => {
    aproveMutation.mutate(selectedSolicitacao.id);
  };

  const handleRejeitar = () => {
    if (!motivo.trim()) {
      toast.error('Informe um motivo para a recusa');
      return;
    }
    rejeiteMutation.mutate(selectedSolicitacao.id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Aprovação de Solicitações</h1>
        <p className="text-gray-600 mt-1">Revise e aprove/rejeite solicitações de máquinas</p>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} cols="md:grid-cols-2" />
      ) : solicitacoesPendentes.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600">Nenhuma solicitação pendente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {solicitacoesPendentes.map(solicitacao => (
            <Card key={solicitacao.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-gray-900">{solicitacao.titulo}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                      <div>
                        <span className="text-gray-500">Obra:</span>
                        <p className="font-medium text-gray-900">{solicitacao.obra_nome}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Máquina:</span>
                        <p className="font-medium text-gray-900 capitalize">{solicitacao.tipo_maquina.replace('_', ' ')}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Quantidade:</span>
                        <p className="font-medium text-gray-900">{solicitacao.quantidade}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Prioridade:</span>
                        <p className="font-medium text-gray-900 capitalize">{solicitacao.prioridade}</p>
                      </div>
                    </div>

                    {solicitacao.descricao && (
                      <p className="text-sm text-gray-600 mb-2">{solicitacao.descricao}</p>
                    )}

                    {solicitacao.justificativa && (
                      <div className="p-2 bg-blue-50 rounded text-sm text-blue-900 mb-3">
                        <strong>Justificativa:</strong> {solicitacao.justificativa}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setSelectedSolicitacao(solicitacao);
                        setAcaoDialog('aprovar');
                      }}
                      className="gap-2 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprovar
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedSolicitacao(solicitacao);
                        setAcaoDialog('rejeitar');
                      }}
                      variant="outline"
                      className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Aprovar */}
      <AlertDialog open={acaoDialog === 'aprovar'} onOpenChange={(open) => !open && setAcaoDialog(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Aprovar Solicitação?</AlertDialogTitle>
          <AlertDialogDescription>
            Deseja aprovar a solicitação de <strong>{selectedSolicitacao?.titulo}</strong>?
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAprovar}
              disabled={aproveMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {aproveMutation.isPending ? 'Processando...' : 'Aprovar'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Rejeitar */}
      <Dialog open={acaoDialog === 'rejeitar'} onOpenChange={(open) => !open && setAcaoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Por favor, informe o motivo da rejeição para <strong>{selectedSolicitacao?.titulo}</strong>:
            </p>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo da rejeição..."
              rows="4"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setAcaoDialog(null)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRejeitar}
                disabled={rejeiteMutation.isPending || !motivo.trim()}
                className="gap-2 bg-red-600 hover:bg-red-700"
              >
                {rejeiteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Rejeitando...
                  </>
                ) : (
                  'Rejeitar'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}