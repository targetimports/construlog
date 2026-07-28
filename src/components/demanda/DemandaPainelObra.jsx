import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Package, TrendingUp, Loader } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function DemandaPainelObra({ obra_id }) {
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);

  // Buscar demandas (fonte única de Prevista, Comprada, Recebida, Consumida)
  const { data: demandas = [], isLoading } = useQuery({
    queryKey: ['demandas', obra_id],
    queryFn: async () => {
      const dados = await base44.entities.DemandaEstoqueObra.filter({ obra_id });
      // Dados já enriquecidos pela função backend gerarDemandaEstoqueDaObra
      return dados || [];
    }
  });

  // Mutation para gerar demanda (profundidade=3, com cache e proteção de loop)
  const gerarDemanda = useMutation({
    mutationFn: async () => {
      setGerando(true);
      try {
        return await base44.functions.invoke('gerarDemandaEstoqueDaObra', {
          obra_id,
          profundidade_maxima: 3
        });
      } finally {
        setGerando(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demandas', obra_id] });
    }
  });

  const totalPrevisto = demandas.reduce((sum, d) => sum + (d.quantidade_prevista || 0), 0);
  const totalRecebido = demandas.reduce((sum, d) => sum + (d.quantidade_recebida || 0), 0);
  const totalConsumido = demandas.reduce((sum, d) => sum + (d.quantidade_consumida || 0), 0);
  const totalSaldo = totalRecebido - totalConsumido;

  const criticos = demandas.filter(d => d.saldo < 0 || d.quantidade_consumida > d.quantidade_recebida);

  return (
    <div className="space-y-6">
      {/* Header com ação */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Demanda de Estoque</h2>
        <Button
          onClick={() => gerarDemanda.mutate()}
          disabled={gerando || gerarDemanda.isPending}
          className="gap-2"
        >
          {gerando || gerarDemanda.isPending ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Gerando...
            </>
          ) : (
            <>
              <TrendingUp className="w-4 h-4" />
              Gerar Demanda
            </>
          )}
        </Button>
      </div>

      {/* KPIs - Fontes: DemandaEstoqueObra (Prevista), MovimentacaoEstoque (Recebida), ConsumoInsumo (Consumida) */}
      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando demandas...</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Previsto</p>
                <p className="text-2xl font-bold text-blue-600">{totalPrevisto.toFixed(0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Comprado</p>
                <p className="text-2xl font-bold text-amber-600">{demandas.reduce((sum, d) => sum + (d.quantidade_comprada || 0), 0).toFixed(0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Recebido</p>
                <p className="text-2xl font-bold text-green-600">{totalRecebido.toFixed(0)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1">Consumido / Saldo</p>
                <p className="text-sm font-bold text-purple-600">{totalConsumido.toFixed(0)}</p>
                <p className={`text-sm font-bold ${totalSaldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  Saldo: {totalSaldo.toFixed(0)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alertas críticos */}
      {criticos.length > 0 && (
        <Card className="border-l-4 border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              {criticos.length} Insumo(s) Crítico(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {criticos.map(d => (
              <div key={d.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-gray-900">{d.insumo_descricao}</p>
                  <span className="text-xs bg-red-200 text-red-800 px-2 py-1 rounded">Crítico</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">Saldo: {d.saldo?.toFixed(2) || 0} {d.unidade}</p>
                <Progress 
                  value={Math.min(100, (d.quantidade_consumida / d.quantidade_recebida) * 100 || 0)}
                  className="h-2"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tabela de insumos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Insumos ({demandas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-2">Insumo</th>
                <th className="text-right py-2 px-2">Previsto</th>
                <th className="text-right py-2 px-2">Comprado</th>
                <th className="text-right py-2 px-2">Recebido</th>
                <th className="text-right py-2 px-2">Consumido</th>
                <th className="text-right py-2 px-2">Saldo</th>
                <th className="text-center py-2 px-2">%</th>
              </tr>
            </thead>
            <tbody>
              {demandas.map(d => (
                <tr key={d.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-900">{d.insumo_descricao}</td>
                  <td className="text-right py-3 px-2">{d.quantidade_prevista?.toFixed(0) || 0}</td>
                  <td className="text-right py-3 px-2">{d.quantidade_comprada?.toFixed(0) || 0}</td>
                  <td className="text-right py-3 px-2">{d.quantidade_recebida?.toFixed(0) || 0}</td>
                  <td className="text-right py-3 px-2 text-purple-600 font-semibold">{d.quantidade_consumida?.toFixed(0) || 0}</td>
                  <td className={`text-right py-3 px-2 font-semibold ${(d.saldo || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {d.saldo?.toFixed(0) || 0}
                  </td>
                  <td className="text-center py-3 px-2">{d.percentual_consumo?.toFixed(0) || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}