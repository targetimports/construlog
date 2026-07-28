import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function DREPorObra({ obraId, periodo }) {
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

  const { data: dresObras = [], isLoading } = useQuery({
    queryKey: ['dres-obras', obraId, periodo],
    queryFn: async () => {
      const results = [];
      for (const obra of obras) {
        try {
          const response = await base44.functions.invoke('getDreObra', { obra_id: obra.id });
          results.push({ obra: obra.nome, obra_id: obra.id, dre: response.data });
        } catch (error) {
          console.error(`Erro ao buscar DRE da obra ${obra.nome}:`, error);
        }
      }
      return results;
    },
    enabled: obras.length > 0
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-600">Carregando DRE...</div>;
  }

  return (
    <div className="space-y-6">
      {dresObras.map(({ obra, obra_id, dre }) => (
        <Card key={obra_id}>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              <span>{obra}</span>
              <div className={`flex items-center gap-2 text-lg font-semibold ${
                (dre?.margem_percentual || 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(dre?.margem_percentual || 0) >= 0 ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                {dre?.margem_percentual?.toFixed(2)}%
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Receita */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-gray-900">Receita Realizada</h3>
                  <span className="text-lg font-bold text-green-600">
                    {dre?.receita_realizada?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>

              {/* Custos Detalhados */}
              <div className="border-b pb-3">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-gray-900">Custos Diretos</h3>
                  <span className="text-lg font-bold text-red-600">
                    {dre?.custo_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="space-y-2 ml-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Materiais</span>
                    <span className="font-medium">
                      {dre?.custo_materiais?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Mão de Obra</span>
                    <span className="font-medium">
                      {dre?.custo_mao_obra?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Equipamentos</span>
                    <span className="font-medium">
                      {dre?.custo_equipamentos?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Combustível</span>
                    <span className="font-medium">
                      {(dre?.custo_combustivel || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Serviços</span>
                    <span className="font-medium">
                      {dre?.custo_servicos?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Administrativo</span>
                    <span className="font-medium">
                      {dre?.custo_administrativo?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Impostos</span>
                    <span className="font-medium">
                      {dre?.custo_impostos?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resultado */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-900">Margem de Contribuição</h3>
                  <div className="text-right">
                    <div className={`text-xl font-bold ${
                      (dre?.margem_valor || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {dre?.margem_valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    <div className={`text-sm ${
                      (dre?.margem_percentual || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {dre?.margem_percentual?.toFixed(2)}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Receita Projetada */}
              {dre?.receita_projetada > 0 && (
                <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                  <div className="flex justify-between">
                    <span>Receita Total Projetada (Orçamento)</span>
                    <span className="font-medium text-blue-700">
                      {dre.receita_projetada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}