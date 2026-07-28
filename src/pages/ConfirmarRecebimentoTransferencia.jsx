import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Truck } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfirmarRecebimentoTransferencia() {
  const [transferencia_selecionada, setTransferenciaSelecionada] = useState(null);
  const [quantidades, setQuantidades] = useState({});
  const queryClient = useQueryClient();

  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias-pendentes'],
    queryFn: async () => {
      return base44.entities.TransferenciaEstoque.filter({
        status: 'separada'
      });
    }
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados'],
    queryFn: () => base44.entities.Almoxarifado.list('', 100)
  });

  const { mutate: confirmar, isPending } = useMutation({
    mutationFn: async () => {
      if (!transferencia_selecionada) return;

      const itens_confirmados = transferencia_selecionada.itens.map(item => ({
        ...item,
        quantidade_transferida: parseFloat(quantidades[item.insumo_id] || item.quantidade_solicitada)
      }));

      return base44.functions.invoke('confirmarTransferenciaRecebimentoObra', {
        transferencia_id: transferencia_selecionada.id,
        itens_confirmados
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias-pendentes'] });
      toast.success('Recebimento da transferência confirmado!');
      setTransferenciaSelecionada(null);
      setQuantidades({});
    }
  });

  const getAlmoxNome = (almox_id) => {
    return almoxarifados.find(a => a.id === almox_id)?.nome || 'Desconhecido';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Truck className="w-8 h-8 text-blue-600" />
          Recebimento de Transferência
        </h1>
        <p className="text-gray-600 mb-6">Confirme a chegada de materiais do Estoque Central</p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Transferências */}
          <div>
            <h2 className="font-semibold text-gray-900 mb-3">Transferências Pendentes</h2>
            {transferencias.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-gray-500 text-sm">
                  Nenhuma transferência aguardando
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {transferencias.map(trans => (
                  <Card
                    key={trans.id}
                    className={`cursor-pointer transition ${
                      transferencia_selecionada?.id === trans.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setTransferenciaSelecionada(trans);
                      setQuantidades({});
                    }}
                  >
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm text-gray-900">{trans.numero}</p>
                      <div className="space-y-1 mt-2 text-xs text-gray-600">
                        <p>De: {getAlmoxNome(trans.almoxarifado_origem_id)}</p>
                        <p>Para: {getAlmoxNome(trans.almoxarifado_destino_id)}</p>
                      </div>
                      <Badge className="mt-2 bg-blue-100 text-blue-800">{trans.itens?.length || 0} itens</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Detalhes e Confirmação */}
          <div className="lg:col-span-2">
            {transferencia_selecionada ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Confirmação - {transferencia_selecionada.numero}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                    ℹConfirme cada item recebido. Você pode ajustar quantidades se houver divergência.
                  </div>

                  {/* Itens */}
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {transferencia_selecionada.itens?.map(item => (
                      <div key={item.insumo_id} className="border rounded-lg p-3">
                        <p className="font-semibold text-sm text-gray-900">{item.descricao}</p>
                        <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                          <div>
                            <label className="text-xs text-gray-600">Transferido</label>
                            <p className="font-semibold">{item.quantidade_solicitada} {item.unidade}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Recebido</label>
                            <Input
                              type="number"
                              defaultValue={item.quantidade_solicitada}
                              onChange={(e) =>
                                setQuantidades({
                                  ...quantidades,
                                  [item.insumo_id]: e.target.value
                                })
                              }
                              className="text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ações */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => setTransferenciaSelecionada(null)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => confirmar()}
                      disabled={isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {isPending ? 'Confirmando...' : 'Confirmar Recebimento'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  Selecione uma transferência para confirmar o recebimento
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}