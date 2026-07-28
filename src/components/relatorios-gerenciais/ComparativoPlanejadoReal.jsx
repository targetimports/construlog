import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle } from 'lucide-react';

export default function ComparativoPlanejadoReal({ obraId, periodo }) {
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtradas', obraId],
    queryFn: async () => {
      if (obraId === 'todas') {
        return base44.entities.Obra.filter({ status: 'em_andamento' });
      }
      const obra = await base44.entities.Obra.filter({ id: obraId });
      return obra;
    }
  });

  const { data: comparativos = [], isLoading } = useQuery({
    queryKey: ['comparativos', obraId, periodo],
    queryFn: async () => {
      const results = [];
      for (const obra of obras) {
        try {
          const response = await base44.functions.invoke('getKpisObraPlanejadoReal', { obra_id: obra.id });
          const kpis = response.data;
          
          results.push({
            obra: obra.nome,
            obra_id: obra.id,
            planejado: kpis.custo_planejado || 0,
            real: kpis.custo_real_total || 0,
            desvio: kpis.desvio_valor || 0,
            desvioPercentual: kpis.desvio_percentual || 0,
            detalhes: {
              materiais_planejado: obra.total_orcamento ? obra.total_orcamento * 0.5 : 0,
              materiais_real: kpis.custo_real_materiais || 0,
              mao_obra_planejado: obra.total_orcamento ? obra.total_orcamento * 0.3 : 0,
              mao_obra_real: kpis.custo_real_mao_obra || 0,
              outros_planejado: obra.total_orcamento ? obra.total_orcamento * 0.2 : 0,
              outros_real: kpis.custo_real_outros || 0
            }
          });
        } catch (error) {
          console.error(`Erro ao buscar comparativo da obra ${obra.nome}:`, error);
        }
      }
      return results;
    },
    enabled: obras.length > 0
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Carregando comparativo...</div>;
  }

  return (
    <div className="space-y-6">
      {comparativos.map((comp) => {
        const statusDesvio = comp.desvioPercentual > 10 ? 'alta' : comp.desvioPercentual > 5 ? 'media' : 'ok';
        
        return (
          <Card key={comp.obra_id}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>{comp.obra}</span>
                {statusDesvio !== 'ok' && (
                  <div className={`flex items-center gap-2 text-sm ${
                    statusDesvio === 'alta' ? 'text-red-600' : 'text-orange-600'
                  }`}>
                    <AlertCircle className="h-4 w-4" />
                    Desvio de {comp.desvioPercentual.toFixed(1)}%
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Planejado</div>
                    <div className="text-xl font-bold text-blue-700">
                      {comp.planejado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Realizado</div>
                    <div className="text-xl font-bold text-gray-700">
                      {comp.real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                  </div>
                  <div className={`text-center p-4 rounded-lg ${
                    comp.desvio < 0 ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    <div className="text-sm text-gray-600 mb-1">Desvio</div>
                    <div className={`text-xl font-bold ${
                      comp.desvio < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {comp.desvio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div className={`text-xs ${
                      comp.desvio < 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {comp.desvioPercentual.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Gráfico de Comparação */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        {
                          categoria: 'Materiais',
                          Planejado: comp.detalhes.materiais_planejado,
                          Real: comp.detalhes.materiais_real
                        },
                        {
                          categoria: 'Mão de Obra',
                          Planejado: comp.detalhes.mao_obra_planejado,
                          Real: comp.detalhes.mao_obra_real
                        },
                        {
                          categoria: 'Outros',
                          Planejado: comp.detalhes.outros_planejado,
                          Real: comp.detalhes.outros_real
                        }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="categoria" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      />
                      <Legend />
                      <Bar dataKey="Planejado" fill="#3B82F6" />
                      <Bar dataKey="Real" fill="#6B7280" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detalhamento */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-gray-900">Análise por Categoria</h4>
                  {[
                    { nome: 'Materiais', planejado: comp.detalhes.materiais_planejado, real: comp.detalhes.materiais_real },
                    { nome: 'Mão de Obra', planejado: comp.detalhes.mao_obra_planejado, real: comp.detalhes.mao_obra_real },
                    { nome: 'Outros', planejado: comp.detalhes.outros_planejado, real: comp.detalhes.outros_real }
                  ].map((cat) => {
                    const desvio = ((cat.real / cat.planejado - 1) * 100).toFixed(1);
                    return (
                      <div key={cat.nome} className="flex justify-between items-center text-sm p-2 hover:bg-gray-50 rounded">
                        <span className="font-medium">{cat.nome}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-600">
                            {cat.planejado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span>→</span>
                          <span className="font-medium">
                            {cat.real.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            parseFloat(desvio) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {desvio}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}