import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw, AlertCircle, Building2, TrendingUp, TrendingDown } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardConsolidadoEmpresa() {
  const queryClient = useQueryClient();

  const { data: dreGlobal, isLoading, refetch } = useQuery({
    queryKey: ['dre-global-empresa'],
    queryFn: async () => {
      const res = await base44.functions.invoke('calcularDREGlobalEmpresa');
      return res.data;
    }
  });

  const recalcular = useMutation({
    mutationFn: async () => {
      return await base44.functions.invoke('calcularDREGlobalEmpresa');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-global-empresa'] });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Calculando DRE consolidado...</p>
        </div>
      </div>
    );
  }

  if (!dreGlobal || !dreGlobal.success) {
    return (
      <Card className="border-l-4 border-red-500">
        <CardContent className="py-8">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Erro ao calcular DRE</p>
              <p className="text-sm text-red-700">{dreGlobal?.error || 'Erro desconhecido'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { consolidado, ranking_lucro, obras_criticas } = dreGlobal;

  const dadosReceitas = [
    { nome: 'Contratada', valor: consolidado.receitas.contratada },
    { nome: 'Faturada', valor: consolidado.receitas.faturada },
    { nome: 'Recebida', valor: consolidado.receitas.recebida }
  ];

  const dadosCustos = [
    { nome: 'Materiais', valor: consolidado.custos.materiais },
    { nome: 'Mão de obra', valor: consolidado.custos.mao_obra },
    { nome: 'Equipamentos', valor: consolidado.custos.equipamentos },
    { nome: 'Combustível', valor: consolidado.custos.combustivel || 0 },
    { nome: 'Indiretas', valor: consolidado.custos.indiretas }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">DRE Consolidado - Empresa</h1>
            <p className="text-gray-600">{consolidado.indicadores.numero_obras} obras ativas</p>
          </div>
        </div>
        <Button
          onClick={() => recalcular.mutate()}
          disabled={recalcular.isPending}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${recalcular.isPending ? 'animate-spin' : ''}`} />
          Recalcular
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Receita Faturada</p>
            <p className="text-3xl font-bold text-blue-600">
              {consolidado.receitas.faturada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Custo Total</p>
            <p className="text-3xl font-bold text-red-600">
              {consolidado.custos.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className={consolidado.indicadores.lucro_bruto >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Lucro Bruto</p>
            <p className={`text-3xl font-bold ${consolidado.indicadores.lucro_bruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {consolidado.indicadores.lucro_bruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Margem Consolidada</p>
            <p className={`text-3xl font-bold ${consolidado.indicadores.margem_percentual >= 10 ? 'text-green-600' : consolidado.indicadores.margem_percentual >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {consolidado.indicadores.margem_percentual.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Obras críticas */}
      {obras_criticas && obras_criticas.length > 0 && (
        <Card className="border-l-4 border-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Obras com Margem Crítica ({obras_criticas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-2">Obra</th>
                    <th className="text-right py-2 px-2">Receita</th>
                    <th className="text-right py-2 px-2">Custo</th>
                    <th className="text-right py-2 px-2">Lucro</th>
                    <th className="text-right py-2 px-2">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {obras_criticas.map((obra, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-red-50">
                      <td className="py-2 px-2 font-semibold">{obra.obra_nome}</td>
                      <td className="text-right py-2 px-2">{obra.receita_faturada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 text-red-600">{obra.custo_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 font-semibold">{obra.lucro_bruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 font-bold text-red-600">{obra.margem_percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas consolidadas */}
        <Card>
          <CardHeader>
            <CardTitle>Receitas Consolidadas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosReceitas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Bar dataKey="valor" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Custos por tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Custos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosCustos}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {dadosCustos.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de obras por lucro */}
      {ranking_lucro && ranking_lucro.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Top 10 Obras - Ranking por Lucro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-2">Posição</th>
                    <th className="text-left py-2 px-2">Obra</th>
                    <th className="text-right py-2 px-2">Receita</th>
                    <th className="text-right py-2 px-2">Custo</th>
                    <th className="text-right py-2 px-2">Lucro</th>
                    <th className="text-right py-2 px-2">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking_lucro.map((obra, idx) => (
                    <tr key={idx} className={`border-b border-gray-100 hover:bg-gray-50 ${idx < 3 ? 'bg-green-50' : ''}`}>
                      <td className="py-2 px-2 font-bold text-gray-900">{idx + 1}º</td>
                      <td className="py-2 px-2 font-semibold">{obra.obra_nome}</td>
                      <td className="text-right py-2 px-2">{obra.receita_faturada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2">{obra.custo_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 font-bold text-green-600">{obra.lucro_bruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 font-semibold text-green-600">{obra.margem_percentual.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}