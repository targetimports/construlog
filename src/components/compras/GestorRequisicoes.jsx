import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Eye } from 'lucide-react';
import ExportadorImportador from './ExportadorImportador';

export default function GestorRequisicoes() {
  const [selectedRequisicao, setSelectedRequisicao] = useState(null);
  const queryClient = useQueryClient();

  const { data: requisicoes, isLoading } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list('-created_date', 100)
  });

  const { data: itensRequisicao } = useQuery({
    queryKey: ['itens-requisicao', selectedRequisicao?.id],
    queryFn: () => base44.entities.RequisicaoCompraItem.filter({
      requisicao_compra_id: selectedRequisicao.id
    }),
    enabled: !!selectedRequisicao
  });

  const aprovarRequisicao = useMutation({
    mutationFn: async (requisicao_id) => {
      await base44.entities.RequisicaoCompra.update(requisicao_id, {
        status: 'aprovada',
        data_aprovacao: new Date().toISOString().split('T')[0],
        aprovado_por: (await base44.auth.me()).email
      });
      return requisicao_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['requisicoes-compra']);
    }
  });

  const rejeitarRequisicao = useMutation({
    mutationFn: async (requisicao_id) => {
      await base44.entities.RequisicaoCompra.update(requisicao_id, {
        status: 'rejeitada'
      });
      return requisicao_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['requisicoes-compra']);
    }
  });

  const getStatusBadge = (status) => {
    const configs = {
      pendente_aprovacao: { label: 'Aguardando Aprovação', variant: 'outline', color: 'bg-yellow-100' },
      aprovada: { label: 'Aprovada', variant: 'default', color: 'bg-green-100' },
      rejeitada: { label: 'Rejeitada', variant: 'destructive', color: 'bg-red-100' },
      em_compra: { label: 'Em Compra', variant: 'default', color: 'bg-blue-100' },
      recebida: { label: 'Recebida', variant: 'default', color: 'bg-green-100' }
    };
    return configs[status] || { label: status, variant: 'outline' };
  };

  const requisicoesPorStatus = {
    pendente: requisicoes?.filter(r => r.status === 'pendente_aprovacao') || [],
    aprovada: requisicoes?.filter(r => r.status === 'aprovada') || [],
    finalizada: requisicoes?.filter(r => r.status === 'recebida') || []
  };

  return (
    <div className="space-y-6">
      <ExportadorImportador obra_id={null} almoxarifado_id="principal" />
      
      {selectedRequisicao ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Requisição #{selectedRequisicao.id.substring(0, 8)}</CardTitle>
              <p className="text-sm text-gray-600">Obra: {selectedRequisicao.obra_id}</p>
            </div>
            <Button variant="outline" onClick={() => setSelectedRequisicao(null)}>
              Voltar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <Badge className="mt-1">{getStatusBadge(selectedRequisicao.status).label}</Badge>
              </div>
              <div>
                <p className="text-sm text-gray-600">Solicitante</p>
                <p className="font-medium">{selectedRequisicao.solicitante_email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Data</p>
                <p className="font-medium">{selectedRequisicao.data_solicitacao}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor Total</p>
                <p className="text-lg font-bold text-green-600">R$ {(selectedRequisicao.valor_total || 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Itens da Requisição</h4>
              <div className="space-y-2">
                {itensRequisicao?.map((item) => (
                  <div key={item.id} className="flex justify-between items-start border rounded p-3">
                    <div>
                      <p className="font-medium text-gray-900">{item.descricao}</p>
                      <p className="text-sm text-gray-600">{item.quantidade} {item.unidade || 'un'}</p>
                    </div>
                    <p className="font-medium">R$ {(item.valor_total || 0).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedRequisicao.status === 'pendente_aprovacao' && (
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={() => aprovarRequisicao.mutate(selectedRequisicao.id)}
                  disabled={aprovarRequisicao.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Aprovar
                </Button>
                <Button 
                  onClick={() => rejeitarRequisicao.mutate(selectedRequisicao.id)}
                  disabled={rejeitarRequisicao.isPending}
                  variant="destructive"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Rejeitar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="pendente" className="w-full">
          <TabsList>
            <TabsTrigger value="pendente">Pendentes ({requisicoesPorStatus.pendente.length})</TabsTrigger>
            <TabsTrigger value="aprovada">Aprovadas ({requisicoesPorStatus.aprovada.length})</TabsTrigger>
            <TabsTrigger value="finalizada">Finalizadas ({requisicoesPorStatus.finalizada.length})</TabsTrigger>
          </TabsList>

          {['pendente', 'aprovada', 'finalizada'].map((tab) => (
            <TabsContent key={tab} value={tab} className="space-y-3">
              {requisicoesPorStatus[tab]?.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nenhuma requisição</p>
              ) : (
                requisicoesPorStatus[tab]?.map((req) => (
                  <Card key={req.id} className="cursor-pointer hover:border-blue-500">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">Obra: {req.obra_id}</p>
                          <p className="text-sm text-gray-600">Solicitante: {req.solicitante_email}</p>
                          <p className="text-sm text-gray-600">Data: {req.data_solicitacao}</p>
                          <p className="text-lg font-bold text-green-600 mt-2">R$ {(req.valor_total || 0).toFixed(2)}</p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setSelectedRequisicao(req)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}