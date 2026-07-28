import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AprovacaoRequisicoes() {
  const [modalRejeicao, setModalRejeicao] = useState(false);
  const [requisicaoSelecionada, setRequisicaoSelecionada] = useState(null);
  const [motivo, setMotivo] = useState('');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-pendentes-aprovacao'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({
      status: 'aguardando_aprovacao'
    })
  });

  const processarMutation = useMutation({
    mutationFn: async ({ requisicao_id, acao, motivo_rejeicao }) => {
      return base44.functions.invoke('processarAprovacaoRequisicao', {
        requisicao_id,
        acao,
        motivo_rejeicao
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-pendentes-aprovacao'] });
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Requisição processada com sucesso!');
      setModalRejeicao(false);
      setRequisicaoSelecionada(null);
      setMotivo('');
    },
    onError: (error) => {
      toast.error('Erro: ' + error.message);
    }
  });

  const handleAprovar = (requisicao_id) => {
    processarMutation.mutate({ requisicao_id, acao: 'aprovar' });
  };

  const handleRejeitar = (requisicao_id) => {
    if (!motivo.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }
    processarMutation.mutate({ requisicao_id, acao: 'rejeitar', motivo_rejeicao: motivo });
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Carregando...</div>;
  }

  if (requisicoes.length === 0) {
    return (
      <Card>
        <CardContent className="pt-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Nenhuma requisição aguardando aprovação</p>
          <p className="text-sm text-gray-500 mt-1">Todas as requisições foram processadas</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <span className="font-semibold">{requisicoes.length}</span> requisição(ões) aguardando sua aprovação
        </p>
      </div>

      {requisicoes.map(req => (
        <Card key={req.id} className="border-l-4 border-l-yellow-400">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <h3 className="font-semibold text-gray-900">{req.titulo}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{req.descricao_resumo}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Solicitante</p>
                      <p className="font-semibold">{req.solicitante_nome || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Itens</p>
                      <p className="font-semibold">{req.qtd_itens || 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Prioridade</p>
                      <Badge className={
                        req.prioridade === 'urgente' ? 'bg-red-100 text-red-800' :
                        req.prioridade === 'alta' ? 'bg-orange-100 text-orange-800' :
                        req.prioridade === 'normal' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }>
                        {req.prioridade}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-gray-500">Valor Total</p>
                      <p className="font-semibold">
                        R$ {(req.valor_total_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  {/* Itens da requisição */}
                  <div className="bg-gray-50 rounded p-3 text-sm mb-4">
                    <p className="font-semibold text-gray-700 mb-2">Itens:</p>
                    {req.itens?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-gray-600 py-1">
                        <span>{item.descricao}</span>
                        <span>{item.quantidade_solicitada} x R$ {(item.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-3 border-t pt-4">
                <Button
                  onClick={() => handleAprovar(req.id)}
                  disabled={processarMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {processarMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setRequisicaoSelecionada(req.id);
                    setModalRejeicao(true);
                  }}
                  disabled={processarMutation.isPending}
                  variant="outline"
                  className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Modal de Rejeição */}
      <Dialog open={modalRejeicao} onOpenChange={setModalRejeicao}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Requisição</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Informe o motivo da rejeição para o solicitante:
            </p>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Valor fora do orçamento, item descontinuado, etc."
              className="min-h-24"
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setModalRejeicao(false);
                  setMotivo('');
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleRejeitar(requisicaoSelecionada)}
                disabled={!motivo.trim() || processarMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {processarMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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