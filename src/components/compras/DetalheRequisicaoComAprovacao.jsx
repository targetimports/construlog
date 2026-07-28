import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DetalheRequisicaoComAprovacao({ 
  requisicao, 
  open, 
  onClose, 
  userRole 
}) {
  const [motivo, setMotivo] = useState('');
  const queryClient = useQueryClient();

  // Apenas Admin da Empresa pode aprovar requisições
  const podeAprovar = userRole === 'admin' || userRole === 'programador';

  const aprovarMutation = useMutation({
    mutationFn: async () => {
      return base44.entities.RequisicaoCompra.update(requisicao.id, {
        status_aprovacao: 'aprovada',
        status: 'aberta',
        aprovado_por: (await base44.auth.me()).email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Requisição aprovada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    }
  });

  const rejeitarMutation = useMutation({
    mutationFn: async () => {
      if (!motivo.trim()) {
        throw new Error('Informe o motivo da rejeição');
      }
      return base44.entities.RequisicaoCompra.update(requisicao.id, {
        status_aprovacao: 'rejeitada',
        status: 'cancelada',
        motivo_rejeicao: motivo,
        aprovado_por: (await base44.auth.me()).email,
        data_aprovacao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      toast.success('Requisição rejeitada!');
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      onClose();
    },
    onError: (error) => {
      toast.error(`Erro ao rejeitar: ${error.message}`);
    }
  });

  if (!requisicao) return null;

  const statusAprovacao = requisicao.status_aprovacao || 'pendente';
  const podeAindaMudar = statusAprovacao === 'pendente' && podeAprovar;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Solicitação de Compra: {requisicao.titulo}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status de Aprovação */}
          <Alert className="border-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Status de Aprovação</p>
                <Badge className={
                  statusAprovacao === 'aprovada' ? 'bg-green-100 text-green-800' :
                  statusAprovacao === 'rejeitada' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }>
                  {statusAprovacao === 'pendente' ? 'Aguardando Aprovação' : statusAprovacao}
                </Badge>
              </div>
            </div>
          </Alert>

          {/* Informações Gerais */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Descrição</p>
                  <p className="font-semibold">{requisicao.descricao_resumo}</p>
                </div>
                <div>
                  <p className="text-gray-600">Prioridade</p>
                  <p className="font-semibold capitalize">{requisicao.prioridade}</p>
                </div>
                <div>
                  <p className="text-gray-600">Solicitante</p>
                  <p className="font-semibold">{requisicao.solicitante_nome}</p>
                </div>
                <div>
                  <p className="text-gray-600">Obra</p>
                  <p className="font-semibold">{requisicao.obra_id}</p>
                </div>
                <div>
                  <p className="text-gray-600">Data Solicitação</p>
                  <p className="font-semibold">
                    {new Date(requisicao.data_solicitacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Valor Total Estimado</p>
                  <p className="font-semibold text-blue-600">
                    R$ {(requisicao.valor_total_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Itens da Requisição */}
          {requisicao.itens && requisicao.itens.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Itens ({requisicao.itens.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {requisicao.itens.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b last:border-b-0">
                      <div>
                        <p className="font-semibold">{item.descricao}</p>
                        <p className="text-gray-500">{item.quantidade} {item.unidade}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">R$ {(item.valor_estimado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ações de Aprovação */}
          {podeAindaMudar && (
            <Card className="border-2 border-blue-200 bg-blue-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-900">Ação de Aprovação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">
                    Motivo da Rejeição (se aplicável)
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Descreva o motivo da rejeição..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    rows="3"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => aprovarMutation.mutate()}
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                  >
                    {aprovarMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Aprovando...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Aprovar</>
                    )}
                  </Button>
                  <Button
                    onClick={() => rejeitarMutation.mutate()}
                    disabled={aprovarMutation.isPending || rejeitarMutation.isPending}
                    variant="destructive"
                    className="flex-1 gap-2"
                  >
                    {rejeitarMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Rejeitando...</>
                    ) : (
                      <><XCircle className="w-4 h-4" /> Rejeitar</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!podeAprovar && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <p className="text-sm text-yellow-800">
                ℹVocê não tem permissão para aprovar requisições. 
                Apenas o Admin da Empresa pode executar esta ação.
              </p>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}