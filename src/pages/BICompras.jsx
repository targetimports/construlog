import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter
} from 'recharts';
import PageHeader from '../components/ui/PageHeader';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function BICompras() {
  const [periodo, setPeriodo] = useState('90');
  const [fornecedorFilter, setFornecedorFilter] = useState('todos');

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes'],
    queryFn: () => base44.entities.RequisicaoCompra.list()
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  const { data: ordensCompra = [] } = useQuery({
    queryKey: ['ordensCompra'],
    queryFn: () => base44.entities.OrdemCompra.list()
  });

  const { data: historicoPrecos = [] } = useQuery({
    queryKey: ['historicoPrecos'],
    queryFn: () => base44.entities.HistoricoPrecos.list()
  });

  // Filtro de período
  const dataCorte = useMemo(() => {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() - Number(periodo));
    return hoje;
  }, [periodo]);

  // Filtrar por fornecedor
  const requisicoesFiltered = fornecedorFilter === 'todos' 
    ? requisicoes 
    : requisicoes.filter(r => r.fornecedor_id === fornecedorFilter);

  // KPIs
  const totalRequisicoes = requisicoesFiltered.length;
  const valorTotalRequisitado = requisicoesFiltered.reduce((acc, r) => acc + (r.valor_total_estimado || 0), 0);
  const requisicoesAprovadas = requisicoesFiltered.filter(r => r.status_aprovacao === 'aprovada').length;
  const requisicoesEmAberto = requisicoesFiltered.filter(r => r.status_aprovacao === 'aguardando').length;

  const ordensCompraFiltered = ordensCompra.filter(oc => {
    const data = oc.data_criacao ? new Date(oc.data_criacao) : new Date();
    return data >= dataCorte;
  });

  const valorTotalOrdensCompra = ordensCompraFiltered.reduce((acc, oc) => acc + (oc.valor_total || 0), 0);
  const ordensCompraEntregues = ordensCompraFiltered.filter(oc => oc.status === 'entregue').length;

  // Análise de Fornecedores
  const desempenhoFornecedores = useMemo(() => {
    const mapa = {};
    ordensCompraFiltered.forEach(oc => {
      if (oc.fornecedor_id) {
        if (!mapa[oc.fornecedor_id]) {
          mapa[oc.fornecedor_id] = { 
            id: oc.fornecedor_id,
            total: 0, 
            ordensCount: 0,
            entregasOk: 0,
            atrasos: 0
          };
        }
        mapa[oc.fornecedor_id].total += oc.valor_total || 0;
        mapa[oc.fornecedor_id].ordensCount += 1;
        if (oc.status === 'entregue') mapa[oc.fornecedor_id].entregasOk += 1;
        if (oc.status === 'atrasado') mapa[oc.fornecedor_id].atrasos += 1;
      }
    });

    return Object.values(mapa)
      .map(f => {
        const fornec = fornecedores.find(forn => forn.id === f.id);
        return {
          ...f,
          nome: fornec?.nome || 'Desconhecido',
          taxa_entrega: f.ordensCount > 0 ? ((f.entregasOk / f.ordensCount) * 100).toFixed(1) : 0,
          valor_medio: f.ordensCount > 0 ? (f.total / f.ordensCount).toFixed(2) : 0
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [ordensCompraFiltered, fornecedores]);

  // Evolução de Despesas
  const evolucaoDespesas = useMemo(() => {
    const meses = {};
    ordensCompraFiltered.forEach(oc => {
      if (oc.data_criacao) {
        const mes = new Date(oc.data_criacao).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        if (!meses[mes]) meses[mes] = 0;
        meses[mes] += oc.valor_total || 0;
      }
    });
    return Object.entries(meses).slice(-6).map(([mes, valor]) => ({ mes, valor }));
  }, [ordensCompraFiltered]);

  // Distribuição por Categoria
  const distribuicaoCategoria = useMemo(() => {
    const cats = {};
    ordensCompraFiltered.forEach(oc => {
      const cat = oc.categoria || 'Outros';
      if (!cats[cat]) cats[cat] = 0;
      cats[cat] += oc.valor_total || 0;
    });
    return Object.entries(cats).map(([nome, valor]) => ({ 
      name: nome.replace(/_/g, ' '), 
      value: Math.round(valor) 
    }));
  }, [ordensCompraFiltered]);

  // Taxa de Aprovação
  const taxaAprovacao = totalRequisicoes > 0 
    ? ((requisicoesAprovadas / totalRequisicoes) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="BI Compras"
        subtitle="Análise de requisições, ordens de compra e desempenho de fornecedores"
      />

      {/* Filtros */}
      <div className="flex gap-4 flex-wrap">
        <Select value={periodo} onValueChange={setPeriodo}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Fornecedores</SelectItem>
            {fornecedores.map(f => (
              <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Requisições</p>
            <p className="text-2xl font-bold text-gray-900">{totalRequisicoes}</p>
            <p className="text-gray-500 text-xs mt-1">{requisicoesAprovadas} aprovadas</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <DollarSign className="w-8 h-8 text-emerald-600" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Valor Requisitado</p>
            <p className="text-2xl font-bold text-gray-900">
              {(valorTotalRequisitado / 1000).toFixed(1)}K
            </p>
            <p className="text-gray-500 text-xs mt-1">Total em requisições</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <Package className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Ordens Entregues</p>
            <p className="text-2xl font-bold text-gray-900">{ordensCompraEntregues}</p>
            <p className="text-gray-500 text-xs mt-1">De {ordensCompraFiltered.length} ordens</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-3">
              <AlertCircle className="w-8 h-8 text-orange-600" />
            </div>
            <p className="text-gray-600 text-sm mb-1">Taxa Aprovação</p>
            <p className="text-2xl font-bold text-gray-900">{taxaAprovacao}%</p>
            <p className="text-gray-500 text-xs mt-1">{requisicoesEmAberto} pendentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="visao-geral" className="w-full">
        <TabsList className="border border-gray-200 p-1 bg-white">
          <TabsTrigger value="visao-geral" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Fornecedores
          </TabsTrigger>
          <TabsTrigger value="analises" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            Análises
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Evolução de Despesas</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={evolucaoDespesas}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="mes" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip
                      formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      name="Valor"
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Distribuição por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distribuicaoCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {distribuicaoCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Status das Requisições</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-blue-600 text-sm font-medium">Em Aberto</p>
                  <p className="text-2xl font-bold text-blue-900">{requisicoesEmAberto}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                  <p className="text-emerald-600 text-sm font-medium">Aprovadas</p>
                  <p className="text-2xl font-bold text-emerald-900">{requisicoesAprovadas}</p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-red-600 text-sm font-medium">Recusadas</p>
                  <p className="text-2xl font-bold text-red-900">
                    {requisicoesFiltered.filter(r => r.status_aprovacao === 'recusada').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fornecedores" className="space-y-6 mt-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Top Fornecedores por Valor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={desempenhoFornecedores}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#9CA3AF" />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" width={190} />
                  <Tooltip
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  />
                  <Bar dataKey="total" fill="#3B82F6" name="Total Gasto" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Quantidade de Ordens</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={desempenhoFornecedores.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }} />
                    <Bar dataKey="ordensCount" fill="#10B981" name="Ordens" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Taxa de Entrega</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={desempenhoFornecedores.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={80} stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" domain={[0, 100]} />
                    <Tooltip
                      formatter={(value) => `${value}%`}
                      contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    />
                    <Bar dataKey="taxa_entrega" fill="#F59E0B" name="% Entrega" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analises" className="space-y-6 mt-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Comparativo: Valor Médio vs Taxa de Entrega</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    type="number"
                    dataKey="taxa_entrega"
                    name="Taxa Entrega %"
                    stroke="#9CA3AF"
                  />
                  <YAxis
                    type="number"
                    dataKey="valor_medio"
                    name="Valor Médio (R$)"
                    stroke="#9CA3AF"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Scatter
                    name="Fornecedores"
                    data={desempenhoFornecedores}
                    fill="#3B82F6"
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Resumo de Fornecedores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                      <th className="px-4 py-2 text-right font-semibold text-gray-700">Total</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700">Ordens</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700">Entregues</th>
                      <th className="px-4 py-2 text-center font-semibold text-gray-700">Taxa Entrega</th>
                    </tr>
                  </thead>
                  <tbody>
                    {desempenhoFornecedores.map((f, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{f.nome}</td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {f.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">{f.ordensCount}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{f.entregasOk}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                            f.taxa_entrega >= 90 ? 'bg-emerald-100 text-emerald-800' :
                            f.taxa_entrega >= 70 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {f.taxa_entrega}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}