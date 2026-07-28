import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, AlertCircle } from 'lucide-react';

export default function PlanejadoVsRealWidget() {
  const navigate = useNavigate();
  const [obraId, setObraId] = useState('');

  const { data: obras } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' })
  });

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['kpis-planejado-real', obraId],
    queryFn: async () => {
      if (!obraId) return null;
      const res = await base44.functions.invoke('getKpisObraPlanejadoReal', { 
        obra_id: obraId,
        debug_mode: true 
      });
      console.log('KPIs Debug:', res.data);
      return res.data;
    },
    enabled: !!obraId
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const chartData = kpis ? [
    { name: 'Planejado', valor: kpis.planejado_total || 0 },
    { name: 'Real', valor: kpis.real_total || 0 },
    { name: 'Receita Real', valor: kpis.receita_realizada || 0 }
  ] : [];

  const desvioColor = kpis?.desvio > 0 ? 'text-red-600' : 'text-green-600';
  const margemColor = kpis?.margem > 0 ? 'text-green-600' : 'text-red-600';

  // Handlers para drill-down
  const handleDrillDown = (tipo) => {
    if (!obraId) return;

    const baseParams = `obra_id=${obraId}&origem=planejado_vs_real`;
    
    switch(tipo) {
      case 'materiais':
        // Navegar para MovimentacoesEstoque filtrado por saída consumo/transferência
        navigate(createPageUrl('MovimentacoesEstoque') + `?${baseParams}&tipo=saida`);
        break;
      case 'mao_obra':
        // Navegar para DiarioObra filtrado por obra
        navigate(createPageUrl('DiarioObra') + `?${baseParams}`);
        break;
      case 'financeiro':
        // Navegar para ContasPagar (contas a pagar - despesas)
        navigate(createPageUrl('ContasPagar') + `?${baseParams}`);
        break;
      case 'receita':
        // Navegar para ContasReceber filtrado por recebidos
        navigate(createPageUrl('ContasReceber') + `?${baseParams}&status=pago`);
        break;
      default:
        break;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Planejado vs Real por Obra</CardTitle>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione uma obra" />
              </SelectTrigger>
              <SelectContent>
                {obras?.map(obra => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.codigo || obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {!obraId && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-5 h-5 mr-2" />
              Selecione uma obra para visualizar os KPIs
            </div>
          )}

          {isLoading && obraId && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {kpis && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Planejado</p>
                        <p className="text-2xl font-bold text-blue-900">{formatCurrency(kpis.planejado_total)}</p>
                      </div>
                      <Target className="w-8 h-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-orange-600">Real Total</p>
                        <p className="text-2xl font-bold text-orange-900">{formatCurrency(kpis.real_total)}</p>
                        <p className="text-xs text-orange-600 mt-1">
                          Mat: {formatCurrency(kpis.real_materiais)} | MO: {formatCurrency(kpis.real_mao_obra)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="bg-green-50 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => handleDrillDown('receita')}
                  title="Clique para ver receitas realizadas"
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Receita Realizada </p>
                        <p className="text-2xl font-bold text-green-900">{formatCurrency(kpis.receita_realizada || 0)}</p>
                        <p className="text-xs text-green-600 mt-1">
                          Prevista: {formatCurrency(kpis.receita_prevista || 0)}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card className={kpis.margem > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Margem</p>
                        <p className={`text-2xl font-bold ${margemColor}`}>{formatCurrency(kpis.margem)}</p>
                        <p className={`text-xs ${margemColor} mt-1`}>
                          {kpis.margem_percentual?.toFixed(1)}%
                        </p>
                      </div>
                      {kpis.margem > 0 ? 
                        <TrendingUp className="w-8 h-8 text-green-600" /> : 
                        <TrendingDown className="w-8 h-8 text-red-600" />
                      }
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desvio Orçamentário</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600">Desvio Total</p>
                      <p className={`text-xl font-bold ${desvioColor}`}>
                        {formatCurrency(Math.abs(kpis.desvio))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Percentual</p>
                      <p className={`text-xl font-bold ${desvioColor}`}>
                        {kpis.desvio > 0 ? '+' : ''}{kpis.desvio_percentual?.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div 
                      className="flex justify-between text-sm cursor-pointer hover:bg-blue-50 p-2 rounded transition-colors"
                      onClick={() => handleDrillDown('materiais')}
                      title="Clique para ver movimentações de materiais"
                    >
                      <span className="text-gray-600">Materiais:</span>
                      <span className="font-medium">{formatCurrency(kpis.real_materiais)}</span>
                    </div>
                    <div 
                      className="flex justify-between text-sm cursor-pointer hover:bg-green-50 p-2 rounded transition-colors"
                      onClick={() => handleDrillDown('mao_obra')}
                      title="Clique para ver diários de obra"
                    >
                      <span className="text-gray-600">Mão de Obra:</span>
                      <span className="font-medium">{formatCurrency(kpis.real_mao_obra)}</span>
                    </div>
                    <div 
                      className="flex justify-between text-sm cursor-pointer hover:bg-purple-50 p-2 rounded transition-colors"
                      onClick={() => handleDrillDown('financeiro')}
                      title="Clique para ver contas financeiras"
                    >
                      <span className="text-gray-600">Financeiro:</span>
                      <span className="font-medium">{formatCurrency(kpis.real_financeiro)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comparativo Geral</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #ddd' }}
                      />
                      <Legend />
                      <Bar dataKey="valor" fill="#3b82f6" name="Valor (R$)" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}