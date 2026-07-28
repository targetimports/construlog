import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

const formatMoney = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
};

export default function FinanceiroObraTab({ obraId }) {
  const [oracamento, setOracamento] = useState(null);
  const [cronogramaItems, setCronogramaItems] = useState([]);

  // Buscar OrcamentoPlanejado
  const { data: orcData, isLoading: orcLoading } = useQuery({
    queryKey: ['orcamento-planejado', obraId],
    queryFn: async () => {
      try {
        const items = await base44.entities.OrcamentoPlanejado.filter(
          { obra_id: obraId },
          '-created_date',
          1
        );
        return items && items.length > 0 ? items[0] : null;
      } catch (err) {
        console.error('[FinanceiroObraTab] Erro orçamento:', err);
        return null;
      }
    },
    enabled: !!obraId
  });

  // Buscar CronogramaItem para resumo
  const { data: cronData, isLoading: cronLoading } = useQuery({
    queryKey: ['cronograma-financeiro', obraId],
    queryFn: async () => {
      try {
        const items = await base44.entities.CronogramaItem.filter(
          { obraId: obraId },
          '-dataInicioPlanejada',
          100
        );
        return items || [];
      } catch (err) {
        console.error('[FinanceiroObraTab] Erro cronograma:', err);
        return [];
      }
    },
    enabled: !!obraId
  });

  useEffect(() => {
    if (orcData) {
      setOracamento(orcData);
    }
  }, [orcData]);

  useEffect(() => {
    if (cronData) {
      setCronogramaItems(cronData);
    }
  }, [cronData]);

  const isLoading = orcLoading || cronLoading;

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Carregando dados financeiros...</div>;
  }

  if (!oracamento) {
    return (
      <Card className="bg-blue-50 border border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <DollarSign className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 font-medium">Nenhum orçamento planejado</p>
              <p className="text-blue-700 text-sm">Importe pelo OrçaFascio para visualizar o resumo financeiro.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPlanejado = oracamento.total_geral || oracamento.total_sem_bdi || 0;
  const bdi = oracamento.bdi_percentual || 0;
  const totalComBDI = oracamento.total_bdi || (totalPlanejado * (1 + bdi / 100));
  const progressoMedio = cronogramaItems.length > 0
    ? Math.round(cronogramaItems.reduce((sum, i) => sum + (i.percentual_concluido || 0), 0) / cronogramaItems.length)
    : 0;
  // Faturamento estimado = valor de contrato (com BDI) × % de progresso do cronograma.
  const faturadoEstimado = totalComBDI * (progressoMedio / 100);
  const desvio = 0; // Campo opcional, padrão 0

  return (
    <div className="space-y-4">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Planejado */}
        <Card className="bg-white border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Planejado</p>
                <p className="text-2xl font-bold text-gray-900">{formatMoney(totalPlanejado)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* BDI */}
        <Card className="bg-white border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 mb-1">BDI Aplicado</p>
                <p className="text-2xl font-bold text-gray-900">{bdi.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">
                  +{formatMoney(totalComBDI - totalPlanejado)}
                </p>
              </div>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total com BDI */}
        <Card className="bg-white border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total com BDI</p>
                <p className="text-2xl font-bold text-gray-900">{formatMoney(totalComBDI)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* A Pagar (Progresso) */}
        <Card className={`bg-white border ${desvio > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-500 mb-1">Estimado Faturado</p>
                <p className="text-2xl font-bold text-gray-900">{formatMoney(faturadoEstimado)}</p>
                <p className="text-xs text-gray-600 mt-1">{progressoMedio}% progresso</p>
              </div>
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Detalhado */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Resumo Financeiro Detalhado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Item: Total Planejado sem BDI */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Custo Planejado (Sem BDI)</p>
                <p className="text-xs text-gray-600">Valores base da composição</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatMoney(totalPlanejado)}</p>
            </div>

            {/* Item: Adição de BDI */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Adição BDI ({bdi.toFixed(1)}%)</p>
                <p className="text-xs text-gray-600">Benefícios e Despesas Indiretas</p>
              </div>
              <p className="text-lg font-bold text-green-600">+{formatMoney(totalComBDI - totalPlanejado)}</p>
            </div>

            {/* Item: Valor de Contrato */}
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div>
                <p className="text-sm font-medium text-gray-900">Valor de Contrato (com BDI)</p>
                <p className="text-xs text-gray-600">Total previsto para faturamento</p>
              </div>
              <p className="text-lg font-bold text-blue-600">{formatMoney(totalComBDI)}</p>
            </div>

            {/* Item: Medição Estimada */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Estimado Faturado ({progressoMedio}% cronograma)
                </p>
                <p className="text-xs text-gray-600">Baseado no andamento das atividades</p>
              </div>
              <p className="text-lg font-bold text-orange-600">{formatMoney(faturadoEstimado)}</p>
            </div>

            {/* Item: A Receber */}
            <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Ainda a Faturar
                </p>
                <p className="text-xs text-gray-600">Saldo conforme cronograma restante</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatMoney(totalComBDI - apPagar)}</p>
            </div>

            {/* Item: Desvio */}
            {desvio !== 0 && (
              <div className={`flex justify-between items-center p-3 rounded-lg border ${desvio > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">Desvio Acumulado</p>
                  <p className="text-xs text-gray-600">Diferença custo real vs planejado</p>
                </div>
                <p className={`text-lg font-bold ${desvio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {desvio > 0 ? '+' : ''}{formatMoney(desvio)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status Cronograma */}
      {cronogramaItems.length > 0 && (
        <Card className="bg-white border border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Andamento do Cronograma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Progresso Geral</span>
                <span className="font-semibold text-gray-900">{progressoMedio}%</span>
              </div>
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all"
                  style={{ width: `${Math.min(progressoMedio, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {cronogramaItems.filter(i => i.percentual_concluido === 100).length} de {cronogramaItems.length} atividades concluídas
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}