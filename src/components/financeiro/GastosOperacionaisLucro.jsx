import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GastosOperacionaisLucro({ periodoInicio, periodoFim }) {
  const navigate = useNavigate();
  const [expandDetalhes, setExpandDetalhes] = useState(false);

  // KPIs com gastos operacionais e lucro
  const { data: financeKPIs, isLoading, refetch } = useQuery({
    queryKey: ['finance-kpis-gastos-lucro', periodoInicio, periodoFim],
    queryFn: async () => {
      const res = await base44.functions.invoke('getFinanceKPIs', {
        periodStart: periodoInicio,
        periodEnd: periodoFim
      });
      return res.data;
    },
    staleTime: 30000
  });

  const gastosOperacionais = financeKPIs?.kpis?.totalCustos || 0;
  const receitasRecebidas = financeKPIs?.kpis?.receitaFaturada || 0;
  const lucro = financeKPIs?.kpis?.lucroNoPeriodo || 0;
  const margemLucro = financeKPIs?.kpis?.margemLucro || 0;

  const detalhes = financeKPIs?.detalhes || {};

  const handleNavigateGastos = () => {
    navigate(`/Financeiro?tab=gastos-operacionais&periodStart=${periodoInicio}&periodEnd=${periodoFim}`);
  };

  const handleNavigateLucro = () => {
    navigate(`/Financeiro?tab=resultado&periodStart=${periodoInicio}&periodEnd=${periodoFim}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-5 h-5 animate-spin text-blue-600 mr-2" />
        <p className="text-gray-600">Carregando dados...</p>
      </div>
    );
  }

  const formatValue = (val) => 
    val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gastos Operacionais */}
        <Card 
          className="cursor-pointer hover:shadow-lg hover:border-red-300 transition-all" 
          onClick={handleNavigateGastos}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Gastos Operacionais
              </CardTitle>
              <TrendingDown className="w-4 h-4 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {formatValue(gastosOperacionais)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Clique para detalhes
            </p>
          </CardContent>
        </Card>

        {/* Receitas */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Receitas Faturadas
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {formatValue(receitasRecebidas)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              No período selecionado
            </p>
          </CardContent>
        </Card>

        {/* Lucro */}
        <Card 
          className={cn(
            "cursor-pointer hover:shadow-lg transition-all",
            lucro >= 0 
              ? "hover:border-emerald-300" 
              : "hover:border-red-300"
          )}
          onClick={handleNavigateLucro}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                Lucro (Resultado)
              </CardTitle>
              {lucro >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-500" />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-3xl font-bold",
              lucro >= 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {formatValue(lucro)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {margemLucro >= 0 
                ? `Margem: ${margemLucro.toFixed(1)}%` 
                : "Prejuízo"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento de Custos */}
      <Card>
        <CardHeader 
          className="pb-3 cursor-pointer hover:bg-gray-50"
          onClick={() => setExpandDetalhes(!expandDetalhes)}
        >
          <div className="flex items-center justify-between">
            <CardTitle>Breakdown de Custos</CardTitle>
            <ChevronDown 
              className={cn(
                "w-5 h-5 text-gray-600 transition-transform",
                expandDetalhes && "transform rotate-180"
              )}
            />
          </div>
        </CardHeader>
        {expandDetalhes && (
          <CardContent>
            <div className="space-y-2">
              {Object.entries(detalhes).map(([key, value]) => {
                const labels = {
                  custoMateriais: 'Material',
                  custoMaoObra: 'Mão de Obra',
                  custoFretes: 'Fretes',
                  custoImpostos: 'Impostos',
                  custoAlimentacao: 'Alimentação',
                  custoAlugueis: 'Aluguel/Combustível',
                  custoEstadias: 'Estadias',
                  custoRetiradas: 'Retiradas',
                  custoLancamentos: 'Lançamentos Diversos'
                };

                const label = labels[key];
                if (!label || value === 0) return null;

                return (
                  <div key={key} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-700">{label}</span>
                    <span className="font-semibold text-red-600">{formatValue(value)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Aviso se sem receitas */}
      {receitasRecebidas === 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">Sem receitas faturadas</p>
                <p className="text-sm text-amber-700 mt-1">
                  Nenhuma receita foi faturada no período. O lucro será calculado quando receitas forem registradas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}