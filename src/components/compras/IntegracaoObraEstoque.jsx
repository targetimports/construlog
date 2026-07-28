import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import ExportadorImportador from './ExportadorImportador';

export default function IntegracaoObraEstoque({ obra_id }) {
  const [selectedDemandas, setSelectedDemandas] = useState([]);
  const queryClient = useQueryClient();

  // Buscar demandas de estoque
  const { data: demandas, isLoading: loadingDemandas } = useQuery({
    queryKey: ['demandas', obra_id],
    queryFn: () => base44.entities.DemandaEstoqueObra.filter({ obra_id, status: 'pendente' }),
    enabled: !!obra_id
  });

  // Buscar saldo de estoque
  const { data: saldos } = useQuery({
    queryKey: ['saldos-estoque', obra_id],
    queryFn: () => base44.entities.SaldoEstoque.filter({ almoxarifado_id: 'principal' }),
    enabled: !!obra_id
  });

  // Gerar demandas
  const gerarDemandas = useMutation({
    mutationFn: async (dados) => {
      const response = await base44.functions.invoke('gerarDemandaEstoqueComposicoes', dados);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['demandas']);
    }
  });

  // Criar requisição
  const criarRequisicao = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('criarRequisicaoCompraObra', {
        obra_id,
        demanda_ids: selectedDemandas,
        observacoes: 'Gerada automaticamente a partir das composições'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['demandas']);
      setSelectedDemandas([]);
    }
  });

  const handleGerarDemandas = () => {
    gerarDemandas.mutate({ obra_id });
  };

  const handleCriarRequisicao = () => {
    if (selectedDemandas.length === 0) return;
    criarRequisicao.mutate();
  };

  const verificarDisponibilidade = (insumo_id) => {
    const saldo = saldos?.find(s => s.insumo_id === insumo_id);
    return saldo ? saldo.quantidade_disponivel : 0;
  };

  return (
    <div className="space-y-6">
      <ExportadorImportador obra_id={obra_id} almoxarifado_id="principal" />
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Demanda de Estoque
          </CardTitle>
          <Button 
            onClick={handleGerarDemandas} 
            disabled={gerarDemandas.isPending}
          >
            Gerar Demandas
          </Button>
        </CardHeader>
        <CardContent>
          {!demandas || demandas.length === 0 ? (
            <Alert>
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Nenhuma demanda gerada. Clique em "Gerar Demandas" para analisar as composições.</AlertDescription>
            </Alert>
          ) : (
            <Tabs defaultValue="demandas" className="w-full">
              <TabsList>
                <TabsTrigger value="demandas">Demandas Pendentes ({demandas.length})</TabsTrigger>
                <TabsTrigger value="disponibilidade">Disponibilidade em Estoque</TabsTrigger>
              </TabsList>

              <TabsContent value="demandas" className="space-y-4">
                <div className="space-y-3">
                  {demandas?.map((demanda) => {
                    const disponivel = verificarDisponibilidade(demanda.insumo_id);
                    const falta = Math.max(0, demanda.quantidade_necessaria - disponivel);

                    return (
                      <div key={demanda.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{demanda.descricao_insumo}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Necessário: {demanda.quantidade_necessaria} {demanda.unidade}
                            </p>
                            <p className="text-sm text-gray-600">
                              Disponível em estoque: {disponivel} {demanda.unidade}
                            </p>
                            {falta > 0 && (
                              <p className="text-sm text-red-600 font-medium">Falta: {falta} {demanda.unidade}</p>
                            )}
                            <p className="text-sm text-gray-900 mt-2 font-medium">
                              Valor Total: R$ {(demanda.valor_total || 0).toFixed(2)}
                            </p>
                          </div>
                          <input 
                            type="checkbox"
                            checked={selectedDemandas.includes(demanda.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDemandas([...selectedDemandas, demanda.id]);
                              } else {
                                setSelectedDemandas(selectedDemandas.filter(id => id !== demanda.id));
                              }
                            }}
                            className="w-5 h-5 mt-1"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedDemandas.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-medium">{selectedDemandas.length} itens selecionados</span>
                      <span className="text-lg font-bold">
                        R$ {
                          demandas
                            ?.filter(d => selectedDemandas.includes(d.id))
                            .reduce((sum, d) => sum + (d.valor_total || 0), 0)
                            .toFixed(2)
                        }
                      </span>
                    </div>
                    <Button 
                      onClick={handleCriarRequisicao} 
                      disabled={criarRequisicao.isPending}
                      className="w-full"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Criar Requisição de Compra
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="disponibilidade">
                <div className="space-y-3">
                  {demandas?.map((demanda) => {
                    const saldo = saldos?.find(s => s.insumo_id === demanda.insumo_id);

                    return (
                      <div key={demanda.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium">{demanda.descricao_insumo}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Almoxarifado: {saldo?.quantidade_disponivel || 0} {demanda.unidade}
                            </p>
                            <p className="text-sm text-gray-600">
                              Preço Médio: R$ {(saldo?.custo_unitario_medio || 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">
                              {saldo?.quantidade_disponivel || 0}
                            </p>
                            <p className="text-xs text-gray-500">disponível</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}