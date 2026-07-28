import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowDown, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RecebimentoAlmoxarifado() {
  const [oc_selecionada, setOcSelecionada] = useState(null);
  const [itemsRecebidos, setItemsRecebidos] = useState({});
  const queryClient = useQueryClient();

  const { data: ocsPendentes = [] } = useQuery({
    queryKey: ['ocs-para-receber'],
    queryFn: async () => {
      const ocs = await base44.entities.OrdemCompra.filter({
        status: 'paga'
      });
      return ocs;
    }
  });

  const { data: almoxarifados = [] } = useQuery({
    queryKey: ['almoxarifados'],
    queryFn: () => base44.entities.Almoxarifado.filter({ tipo: 'central' })
  });

  const { mutate: confirmarRecebimento, isPending } = useMutation({
    mutationFn: (data) => base44.functions.invoke('confirmarRecebimentoMaterial', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ocs-para-receber'] });
      toast.success('Recebimento confirmado! Material entrando no estoque central');
      setOcSelecionada(null);
      setItemsRecebidos({});
    }
  });

  const handleConfirmarRecebimento = () => {
    if (!oc_selecionada || !almoxarifados[0]) return;

    const itens = oc_selecionada.itens.map(item => ({
      ...item,
      quantidade_recebida: parseFloat(itemsRecebidos[item.insumo_id] || item.quantidade_solicitada)
    }));

    confirmarRecebimento({
      oc_id: oc_selecionada.id,
      itens_recebidos: itens,
      almoxarifado_id: almoxarifados[0].id,
      observacoes: 'Recebimento confirmado pelo almoxarife'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Confirmação de Recebimento</h1>
        <p className="text-gray-600 mb-6">Somente o perfil ALMOXARIFE pode confirmar entrega de materiais</p>

        {ocsPendentes.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Nenhuma OC aguardando recebimento
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Lista de OCs */}
            <div className="md:col-span-1">
              <h2 className="font-semibold text-gray-900 mb-3">OCs Pendentes</h2>
              <div className="space-y-2">
                {ocsPendentes.map(oc => (
                  <Card
                    key={oc.id}
                    className={`cursor-pointer transition ${
                      oc_selecionada?.id === oc.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-gray-300'
                    }`}
                    onClick={() => setOcSelecionada(oc)}
                  >
                    <CardContent className="p-3">
                      <p className="font-semibold text-sm text-gray-900">OC #{oc.numero}</p>
                      <p className="text-xs text-gray-600">{oc.fornecedor_nome}</p>
                      <Badge className="mt-2 bg-amber-100 text-amber-800" >Aguardando</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Detalhes e Confirmação */}
            <div className="md:col-span-2">
              {oc_selecionada ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDown className="w-5 h-5 text-amber-600" />
                      Recebimento OC #{oc_selecionada.numero}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                      ℹConfirme a quantidade recebida de cada item. O material entrará automaticamente no estoque central.
                    </div>

                    {/* Itens */}
                    <div className="space-y-3">
                      {oc_selecionada.itens?.map(item => (
                        <div key={item.insumo_id} className="border rounded-lg p-3">
                          <p className="font-semibold text-sm text-gray-900">{item.descricao}</p>
                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-xs text-gray-600">Solicitado</label>
                              <p className="font-semibold">{item.quantidade_solicitada} {item.unidade}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-600">Recebido</label>
                              <Input
                                type="number"
                                defaultValue={item.quantidade_solicitada}
                                onChange={(e) =>
                                  setItemsRecebidos({
                                    ...itemsRecebidos,
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
                        onClick={() => setOcSelecionada(null)}
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={handleConfirmarRecebimento}
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
                    Selecione uma OC para confirmar recebimento
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}