import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function ComparativoOrcadoRealizado({ obra_id }) {
  const { data: itens, isLoading } = useQuery({
    queryKey: ['comparativo-orcado-realizado', obra_id],
    queryFn: () => base44.entities.OrcamentoItem.filter({ obra_id }),
    enabled: !!obra_id
  });

  if (isLoading) return <div className="text-center py-8">Carregando...</div>;

  const calcularDesvio = (previsto, realizado) => {
    if (previsto === 0) return 0;
    return ((realizado - previsto) / previsto * 100).toFixed(2);
  };

  const totais = {
    quantidade_prevista: 0,
    quantidade_executada: 0,
    custo_previsto: 0,
    custo_realizado: 0
  };

  itens?.forEach(item => {
    totais.quantidade_prevista += item.quantidade || 0;
    totais.quantidade_executada += item.quantidade_executada || 0;
    totais.custo_previsto += (item.quantidade || 0) * (item.valor_unitario || 0);
    totais.custo_realizado += item.custo_realizado || 0;
  });

  const desvio_custo = calcularDesvio(totais.custo_previsto, totais.custo_realizado);

  return (
    <div className="space-y-6">
      {/* Resumo Total */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral - Previsto vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Quantidade Prevista</p>
              <p className="text-3xl font-bold text-gray-900">{totais.quantidade_prevista.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Quantidade Executada</p>
              <p className="text-3xl font-bold text-blue-600">{totais.quantidade_executada.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo Previsto</p>
              <p className="text-3xl font-bold text-gray-900">R$ {totais.custo_previsto.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Custo Realizado</p>
              <p className={`text-3xl font-bold ${desvio_custo > 0 ? 'text-red-600' : 'text-green-600'}`}>
                R$ {totais.custo_realizado.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t">
            <div className="flex justify-between items-center">
              <span className="font-medium">Desvio Orçamentário</span>
              <Badge className={desvio_custo > 0 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}>
                {desvio_custo > 0 ? '+' : ''}{desvio_custo}%
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detalhes por Item */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhes por Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {itens?.map((item) => {
              const custo_previsto = (item.quantidade || 0) * (item.valor_unitario || 0);
              const custo_realizado = item.custo_realizado || 0;
              const desvio = calcularDesvio(custo_previsto, custo_realizado);
              const saldo = item.quantidade - (item.quantidade_executada || 0);

              return (
                <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{item.descricao}</h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Execução: {item.quantidade_executada || 0} / {item.quantidade} {item.unidade}
                      </p>
                    </div>
                    <Badge className={saldo === 0 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      Saldo: {saldo}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-sm mb-3 pb-3 border-b">
                    <div>
                      <p className="text-gray-600">Previsto</p>
                      <p className="font-medium">R$ {custo_previsto.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Realizado</p>
                      <p className={`font-medium ${custo_realizado > custo_previsto ? 'text-red-600' : 'text-green-600'}`}>
                        R$ {custo_realizado.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Desvio</p>
                      <p className={`font-medium ${desvio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {desvio > 0 ? '+' : ''}{desvio}%
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Valor Unit.</p>
                      <p className="font-medium">R$ {(item.valor_unitario || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${saldo === 0 ? 'bg-green-600' : 'bg-blue-600'}`}
                      style={{ width: `${(item.quantidade_executada / item.quantidade * 100) || 0}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}