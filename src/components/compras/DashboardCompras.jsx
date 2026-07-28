import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Clock, Package } from 'lucide-react';
import GraficoGastosComTempo from './GraficoGastosComTempo';
import GraficoTempoAprovacao from './GraficoTempoAprovacao';
import GraficoVolumeFornicedor from './GraficoVolumeFornecedor';

export default function DashboardCompras({ requisicoes = [] }) {
  const [periodo, setPeriodo] = useState('mes'); // mes, trimestre, ano

  // Calcular dados baseado no período
  const datasFiltradas = useMemo(() => {
    const agora = new Date();
    let dataInicio = new Date();

    switch (periodo) {
      case 'mes':
        dataInicio.setMonth(agora.getMonth() - 1);
        break;
      case 'trimestre':
        dataInicio.setMonth(agora.getMonth() - 3);
        break;
      case 'ano':
        dataInicio.setFullYear(agora.getFullYear() - 1);
        break;
      default:
        dataInicio.setMonth(agora.getMonth() - 1);
    }

    return requisicoes.filter(r => {
      const dataReq = new Date(r.created_date);
      return dataReq >= dataInicio && dataReq <= agora;
    });
  }, [requisicoes, periodo]);

  // KPIs
  const kpis = useMemo(() => {
    const valorTotal = datasFiltradas.reduce((sum, r) => sum + (r.valor_total_estimado || 0), 0);
    const requisicoesConcluidas = datasFiltradas.filter(r => r.status === 'recebida').length;
    const tempoMedioAprovacao = datasFiltradas.length > 0 
      ? (datasFiltradas.reduce((sum, r) => {
          const dataSolicitacao = new Date(r.created_date);
          const dataAprovacao = r.data_aprovacao ? new Date(r.data_aprovacao) : new Date();
          const diferenca = (dataAprovacao - dataSolicitacao) / (1000 * 60 * 60 * 24);
          return sum + diferenca;
        }, 0) / datasFiltradas.length).toFixed(1)
      : 0;

    return {
      valorTotal,
      requisicoesConcluidas,
      tempoMedioAprovacao,
      totalRequisicoes: datasFiltradas.length
    };
  }, [datasFiltradas]);

  return (
    <div className="space-y-6">
      {/* Filtros de Período */}
      <div className="flex items-center gap-3">
        <Calendar className="w-5 h-5 text-gray-600" />
        <p className="font-medium text-gray-900">Período:</p>
        <div className="flex gap-2">
          {[
            { value: 'mes', label: 'Último Mês' },
            { value: 'trimestre', label: 'Último Trimestre' },
            { value: 'ano', label: 'Último Ano' }
          ].map(opt => (
            <Button
              key={opt.value}
              variant={periodo === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Valor Total
              </p>
              <p className="text-2xl font-bold text-blue-600">
                R$ {(kpis.valorTotal / 1000).toFixed(1)}K
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Requisições
              </p>
              <p className="text-2xl font-bold text-green-600">
                {kpis.totalRequisicoes}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Tempo Médio Aprovação
              </p>
              <p className="text-2xl font-bold text-orange-600">
                {kpis.tempoMedioAprovacao} dias
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Concluídas</p>
              <p className="text-2xl font-bold text-emerald-600">
                {kpis.requisicoesConcluidas}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {datasFiltradas.length > 0 
                  ? `${((kpis.requisicoesConcluidas / datasFiltradas.length) * 100).toFixed(0)}% do total`
                  : '0%'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GraficoGastosComTempo requisicoes={datasFiltradas} periodo={periodo} />
        <GraficoTempoAprovacao requisicoes={datasFiltradas} periodo={periodo} />
      </div>

      {/* Gráfico de Volume por Fornecedor - Full Width */}
      <GraficoVolumeFornicedor requisicoes={datasFiltradas} periodo={periodo} />
    </div>
  );
}