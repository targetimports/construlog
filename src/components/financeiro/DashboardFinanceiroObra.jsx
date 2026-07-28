import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6'];

export default function DashboardFinanceiroObra({ obra_id }) {
  const queryClient = useQueryClient();
  const [calculando, setCalculando] = useState(false);

  // Buscar DRE mais recente
  const { data: dre, isLoading: dreLoading } = useQuery({
    queryKey: ['dre-obra', obra_id],
    queryFn: async () => {
      const dreBd = await base44.entities.DREObra.filter({
        obra_id
      });
      return dreBd && dreBd.length > 0 ? dreBd[dreBd.length - 1] : null;
    }
  });

  // Mutation: calcular DRE
  const calcularDre = useMutation({
    mutationFn: async () => {
      setCalculando(true);
      try {
        return await base44.functions.invoke('calcularDREObra', { obra_id });
      } finally {
        setCalculando(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dre-obra', obra_id] });
    }
  });

  const dadosCustos = dre ? [
    { nome: 'Materiais', valor: dre.custo_materiais || 0 },
    { nome: 'Mão de obra', valor: dre.custo_mao_obra || 0 },
    { nome: 'Equipamentos', valor: dre.custo_equipamentos || 0 },
    // Combustível é custo de OPERAÇÃO — linha própria, separada da posse da máquina.
    { nome: 'Combustível', valor: dre.custo_combustivel || 0 },
    { nome: 'Indiretas', valor: dre.custo_despesas_indiretas || 0 }
  ] : [];

  const dadosReceitas = dre ? [
    { periodo: 'Contratada', valor: dre.receita_contratada || 0 },
    { periodo: 'Faturada', valor: dre.receita_faturada || 0 },
    { periodo: 'Recebida', valor: dre.receita_recebida || 0 }
  ] : [];

  const dadosItens = dre && dre.consumo_vs_previsto
    ? Object.entries(dre.consumo_vs_previsto).map(([item, dados]) => ({
        item,
        previsto: dados.previsto,
        realizado: dados.realizado,
        desvio: dados.desvio
      }))
    : [];

  if (dreLoading) {
    return <div className="text-center py-8 text-gray-500">Carregando DRE...</div>;
  }

  if (!dre) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-gray-600 mb-4">Nenhuma DRE calculada ainda.</p>
          <Button
            onClick={() => calcularDre.mutate()}
            disabled={calculando || calcularDre.isPending}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Calcular DRE Agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com botão refresh */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Financeiro da Obra</h2>
        <Button
          onClick={() => calcularDre.mutate()}
          disabled={calculando || calcularDre.isPending}
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${calculando ? 'animate-spin' : ''}`} />
          Recalcular
        </Button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Receita Faturada</p>
            <p className="text-3xl font-bold text-blue-600">
              {(dre.receita_faturada || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Recebida: {(dre.receita_recebida || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Custo Total</p>
            <p className="text-3xl font-bold text-red-600">
              {(dre.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {((dre.custo_total / (dre.receita_faturada || 1)) * 100).toFixed(1)}% da receita
            </p>
          </CardContent>
        </Card>

        <Card className={dre.lucro_bruto >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600 mb-2">Lucro / Margem</p>
            <p className={`text-3xl font-bold ${dre.lucro_bruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(dre.lucro_bruto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className={`text-sm font-bold mt-2 ${dre.margem_percentual >= 10 ? 'text-green-600' : dre.margem_percentual >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
              {(dre.margem_percentual || 0).toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {dre.alertas && dre.alertas.length > 0 && (
        <Card className="border-l-4 border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="w-5 h-5" />
              Alertas ({dre.alertas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {dre.alertas.map((alerta, idx) => (
                <li key={idx} className="text-sm text-gray-700 flex gap-2">
                  <span className="text-yellow-600 font-bold">•</span>
                  {alerta}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receitas */}
        <Card>
          <CardHeader>
            <CardTitle>Receitas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dadosReceitas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="periodo" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR')} />
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
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={dadosCustos}
                  dataKey="valor"
                  nameKey="nome"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {dadosCustos.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR')} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Previsto vs Realizado por Item */}
      {dadosItens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Previsto vs Realizado por Item</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosItens}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="item" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR')} />
                <Legend />
                <Bar dataKey="previsto" fill="#3b82f6" name="Previsto" />
                <Bar dataKey="realizado" fill="#ef4444" name="Realizado" />
              </BarChart>
            </ResponsiveContainer>

            {/* Tabela de desvios */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr>
                    <th className="text-left py-2 px-2">Item</th>
                    <th className="text-right py-2 px-2">Previsto</th>
                    <th className="text-right py-2 px-2">Realizado</th>
                    <th className="text-right py-2 px-2">Desvio %</th>
                  </tr>
                </thead>
                <tbody>
                  {dadosItens.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 font-semibold">{item.item}</td>
                      <td className="text-right py-2 px-2">{item.previsto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="text-right py-2 px-2 text-red-600 font-semibold">{item.realizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className={`text-right py-2 px-2 font-semibold ${Math.abs(item.desvio) > 10 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.desvio > 0 ? '+' : ''}{item.desvio.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de custos */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
              <span className="font-semibold">Materiais</span>
              <span className="text-lg font-bold text-blue-600">
                {(dre.custo_materiais || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="font-semibold">Mão de obra</span>
              <span className="text-lg font-bold text-green-600">
                {(dre.custo_mao_obra || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
              <span className="font-semibold">Equipamentos</span>
              <span className="text-lg font-bold text-purple-600">
                {(dre.custo_equipamentos || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
              <span className="font-semibold">Combustível</span>
              <span className="text-lg font-bold text-orange-600">
                {(dre.custo_combustivel || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
              <span className="font-semibold">Despesas indiretas</span>
              <span className="text-lg font-bold text-amber-600">
                {(dre.custo_despesas_indiretas || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-t-2 mt-4">
              <span className="font-bold text-lg">CUSTO TOTAL</span>
              <span className="text-2xl font-bold text-gray-900">
                {(dre.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}