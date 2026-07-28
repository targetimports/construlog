import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function DashboardPerformanceGantt({ medicoes, orcamento }) {
  const performance = useMemo(() => {
    if (!medicoes || !orcamento) return null;

    // Calcular desvios
    const itensComMedicao = orcamento.itens?.map(item => {
      const medicoesPorItem = medicoes.filter(m => {
        // Assumindo que medicoes tem referência aos itens do orçamento
        return m.item_orcamento_id === item.id;
      });

      const percentualExecutado = medicoesPorItem.length > 0 
        ? medicoesPorItem.reduce((acc, m) => acc + (m.percentual_fisico_acumulado || 0), 0) / medicoesPorItem.length
        : 0;

      const percentualPlanejado = item.mes_previsto 
        ? (item.mes_previsto / 12) * 100 
        : 0;

      const desvio = percentualExecutado - percentualPlanejado;
      const dataInicio = new Date(item.data_inicio);
      const dataFim = new Date(item.data_fim);
      const diasTotais = (dataFim - dataInicio) / (1000 * 60 * 60 * 24);
      const diasDecorridos = (new Date() - dataInicio) / (1000 * 60 * 60 * 24);
      const percentualTempo = (diasDecorridos / diasTotais) * 100;

      return {
        id: item.id,
        descricao: item.descricao,
        percentualExecutado,
        percentualPlanejado,
        desvio,
        percentualTempo,
        status: desvio < -10 ? 'atrasado' : desvio > 10 ? 'adiantado' : 'no_prazo'
      };
    }) || [];

    // Dados para gráfico temporal
    const dataGrafico = itensComMedicao.map(item => ({
      nome: item.descricao.slice(0, 20),
      planejado: item.percentualPlanejado,
      executado: item.percentualExecutado,
      tempo: item.percentualTempo
    }));

    const statusCount = {
      atrasado: itensComMedicao.filter(i => i.status === 'atrasado').length,
      adiantado: itensComMedicao.filter(i => i.status === 'adiantado').length,
      no_prazo: itensComMedicao.filter(i => i.status === 'no_prazo').length
    };

    const desvioMedio = itensComMedicao.length > 0
      ? itensComMedicao.reduce((acc, i) => acc + i.desvio, 0) / itensComMedicao.length
      : 0;

    return {
      itensComMedicao,
      dataGrafico,
      statusCount,
      desvioMedio
    };
  }, [medicoes, orcamento]);

  if (!performance) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Sem dados de performance disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const { itensComMedicao, dataGrafico, statusCount, desvioMedio } = performance;

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">No Prazo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{statusCount.no_prazo}</p>
            <p className="text-xs text-gray-500 mt-1">atividades</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Adiantadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">{statusCount.adiantado}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">atividades</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <p className="text-2xl font-bold text-red-600">{statusCount.atrasado}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">atividades</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Desvio Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              desvioMedio < 0 ? "text-red-600" : "text-green-600"
            )}>
              {desvioMedio > 0 ? '+' : ''}{desvioMedio.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {desvioMedio < 0 ? 'Atraso' : 'Avanço'} médio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Planejado vs Executado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" />
              <YAxis />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Area type="monotone" dataKey="planejado" fill="#3b82f6" stroke="#1e40af" name="Planejado" opacity={0.6} />
              <Area type="monotone" dataKey="executado" fill="#10b981" stroke="#047857" name="Executado" opacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lista de Atividades com Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status das Atividades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {itensComMedicao.map((item) => (
              <div key={item.id} className={cn(
                'border rounded p-3',
                item.status === 'atrasado' ? 'border-red-300 bg-red-50' :
                item.status === 'adiantado' ? 'border-blue-300 bg-blue-50' :
                'border-green-300 bg-green-50'
              )}>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900 text-sm">
                    {item.descricao}
                  </h4>
                  <Badge className={cn(
                    item.status === 'atrasado' ? 'bg-red-100 text-red-800' :
                    item.status === 'adiantado' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  )}>
                    {item.status === 'atrasado' ? 'Atrasado' :
                     item.status === 'adiantado' ? 'Adiantado' :
                     '✓ No prazo'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-white rounded p-2">
                    <p className="text-gray-600">Planejado</p>
                    <p className="font-semibold text-gray-900">{item.percentualPlanejado.toFixed(0)}%</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-gray-600">Executado</p>
                    <p className="font-semibold text-gray-900">{item.percentualExecutado.toFixed(0)}%</p>
                  </div>
                  <div className={cn(
                    'rounded p-2',
                    item.desvio < 0 ? 'bg-red-100' : 'bg-green-100'
                  )}>
                    <p className="text-gray-600">Desvio</p>
                    <p className={cn(
                      'font-semibold',
                      item.desvio < 0 ? 'text-red-600' : 'text-green-600'
                    )}>
                      {item.desvio > 0 ? '+' : ''}{item.desvio.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}