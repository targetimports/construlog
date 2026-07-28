import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  TrendingUp, 
  TrendingDown,
  Building2,
  DollarSign,
  Calendar,
  BarChart3,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import PageHeader from '../components/ui/PageHeader';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];

export default function BIMultiobras() {
  const [periodo, setPeriodo] = useState('30');
  const [obrasFilter, setObrasFilter] = useState([]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  // Filtro de período
  const dataCorte = useMemo(() => {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() - Number(periodo));
    return hoje;
  }, [periodo]);

  // Filtrar obras selecionadas
  const obrasFiltered = useMemo(() => {
    if (obrasFilter.length === 0) return obras;
    return obras.filter(o => obrasFilter.includes(o.id));
  }, [obras, obrasFilter]);

  const toggleObraFilter = (obraId) => {
    setObrasFilter(prev => 
      prev.includes(obraId) 
        ? prev.filter(id => id !== obraId)
        : [...prev, obraId]
    );
  };

  // KPIs Financeiros
  const contasFiltradas = contas.filter(c => 
    obrasFiltered.length === 0 || obrasFiltered.some(o => o.id === c.obra_id)
  );

  const totalReceitas = contasFiltradas
    .filter(c => c.tipo === 'receber' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const totalDespesas = contasFiltradas
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const saldoOperacional = totalReceitas - totalDespesas;
  const margemOperacional = totalReceitas > 0 ? ((saldoOperacional / totalReceitas) * 100) : 0;

  // KPIs de Obras
  const obrasAtivas = obrasFiltered.filter(o => o.status === 'em_andamento').length;
  const progressoMedio = obrasFiltered.length > 0 
    ? obrasFiltered.reduce((acc, o) => acc + (o.percentual_concluido || 0), 0) / obrasFiltered.length 
    : 0;

  const totalOrcado = obrasFiltered.reduce((acc, o) => acc + (o.valor_orcado || 0), 0);
  const totalRealizado = obrasFiltered.reduce((acc, o) => acc + (o.valor_realizado || 0), 0);
  const variacaoOrcamentaria = totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100) - 100 : 0;

  // Dados para gráficos
  const custosObrasMensais = useMemo(() => {
    const meses = {};
    contasFiltradas.forEach(c => {
      if (c.data_pagamento && c.tipo === 'pagar') {
        const mes = new Date(c.data_pagamento).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        if (!meses[mes]) meses[mes] = 0;
        meses[mes] += c.valor || 0;
      }
    });
    return Object.entries(meses).slice(-6).map(([mes, valor]) => ({ mes, valor }));
  }, [contasFiltradas]);

  const progressoObras = obrasFiltered
    .filter(o => o.status === 'em_andamento')
    .slice(0, 10)
    .map(o => ({
      nome: o.nome.length > 20 ? o.nome.substring(0, 20) + '...' : o.nome,
      progresso: o.percentual_concluido || 0
    }));

  const distribuicaoStatus = [
    { name: 'Em Andamento', value: obrasFiltered.filter(o => o.status === 'em_andamento').length },
    { name: 'Planejamento', value: obrasFiltered.filter(o => o.status === 'planejamento').length },
    { name: 'Pausada', value: obrasFiltered.filter(o => o.status === 'pausada').length },
    { name: 'Concluída', value: obrasFiltered.filter(o => o.status === 'concluida').length }
  ].filter(d => d.value > 0);

  const fluxoCaixaMensal = useMemo(() => {
    const meses = {};
    contasFiltradas.forEach(c => {
      if (c.data_pagamento) {
        const mes = new Date(c.data_pagamento).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        if (!meses[mes]) meses[mes] = { mes, receitas: 0, despesas: 0 };
        if (c.tipo === 'receber') meses[mes].receitas += c.valor || 0;
        else meses[mes].despesas += c.valor || 0;
      }
    });
    return Object.values(meses).slice(-6);
  }, [contasFiltradas]);

  const comparacaoObras = obrasFiltered.slice(0, 8).map(o => ({
    nome: o.nome.length > 12 ? o.nome.substring(0, 12) + '...' : o.nome,
    orcado: o.valor_orcado || 0,
    realizado: o.valor_realizado || 0,
    margem: ((o.valor_orcado - o.valor_realizado) || 0)
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence - Múltiplas Obras"
        subtitle="Análise comparativa e consolidada entre obras"
      />

      {/* Filtros */}
      <div className="space-y-4">
        <div className="flex gap-4 items-center">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
          {obrasFilter.length > 0 && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => setObrasFilter([])}
            >
              Limpar filtro ({obrasFilter.length})
            </Button>
          )}
        </div>

        {/* Seleção de Obras */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Selecione as obras para comparar:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {obras.map(obra => (
              <button
                key={obra.id}
                onClick={() => toggleObraFilter(obra.id)}
                className={`p-3 rounded-lg text-left text-sm font-medium transition-all ${
                  obrasFilter.includes(obra.id)
                    ? 'bg-blue-500 text-white border border-blue-600'
                    : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                <div className="truncate">{obra.nome}</div>
                <div className={`text-xs mt-1 ${obrasFilter.includes(obra.id) ? 'text-blue-100' : 'text-gray-500'}`}>
                  {obra.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="border border-gray-200 p-1 bg-white">
          <TabsTrigger value="geral" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="obras" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Building2 className="w-4 h-4 mr-2" />
            Comparativo Obras
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-6">
          {/* KPIs Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Obras Selecionadas</p>
                <p className="text-2xl font-bold text-gray-900">{obrasFiltered.length}</p>
                <p className="text-gray-500 text-xs mt-1">{obrasAtivas} ativas</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Zap className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Progresso Médio</p>
                <p className="text-2xl font-bold text-gray-900">{progressoMedio.toFixed(1)}%</p>
                <p className="text-gray-500 text-xs mt-1">De todas as obras</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-emerald-600" />
                  {saldoOperacional >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-1">Saldo Operacional</p>
                <p className={`text-2xl font-bold ${saldoOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {saldoOperacional.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Fluxo de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={fluxoCaixaMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="mes" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="receitas" stackId="1" stroke="#10B981" fill="#10B981" name="Receitas" />
                    <Area type="monotone" dataKey="despesas" stackId="1" stroke="#EF4444" fill="#EF4444" name="Despesas" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900">Status das Obras</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={distribuicaoStatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {distribuicaoStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="financeiro" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Total Receitas</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Total Despesas</p>
                <p className="text-3xl font-bold text-red-600">
                  {totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Margem Operacional</p>
                <p className={`text-3xl font-bold ${margemOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {margemOperacional.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Evolução de Custos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={custosObrasMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="mes" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="valor" fill="#F59E0B" name="Custos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obras" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Valor Total Orçado</p>
                <p className="text-3xl font-bold text-gray-900">
                  {totalOrcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Valor Total Realizado</p>
                <p className="text-3xl font-bold text-amber-600">
                  {totalRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-6">
                <p className="text-gray-600 text-sm mb-2">Variação Consolidada</p>
                <p className={`text-3xl font-bold ${variacaoOrcamentaria <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {variacaoOrcamentaria.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Comparativo Orcado vs Realizado</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={comparacaoObras}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="nome" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Legend />
                  <Bar dataKey="orcado" fill="#3B82F6" name="Orçado" />
                  <Bar dataKey="realizado" fill="#F59E0B" name="Realizado" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Progresso das Obras</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={progressoObras} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" domain={[0, 100]} stroke="#6b7280" />
                  <YAxis dataKey="nome" type="category" stroke="#6b7280" width={150} />
                  <Tooltip 
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Bar dataKey="progresso" fill="#3B82F6" name="Progresso %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}