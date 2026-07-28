import React, { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  TrendingUp, 
  TrendingDown,
  Building2,
  DollarSign,
  Truck,
  Users,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, AreaChart
} from 'recharts';
import PageHeader from '../components/ui/PageHeader';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899'];
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BI() {
  const [periodo, setPeriodo] = useState('30');
  const [obraFilter, setObraFilter] = useState('todas');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abastecimentos'],
    queryFn: () => base44.entities.Abastecimento.list()
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes'],
    queryFn: () => base44.entities.Manutencao.list()
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  // Data de corte do período (aplicada de fato nos KPIs financeiros).
  const dataCorteISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(periodo));
    return d.toISOString().slice(0, 10);
  }, [periodo]);

  // Data de liquidação: pagar -> data_pagamento; receber -> data_recebimento.
  const liqDate = useCallback((c) => {
    const d = c.tipo === 'pagar' ? c.data_pagamento : (c.data_recebimento || c.data_pagamento);
    return (d || '').slice(0, 10);
  }, []);

  const orcadoDe = (o) => o.valor_orcado || o.total_orcamento || o.valor_contrato || 0;

  // Obras filtradas pelo seletor
  const obrasFiltered = useMemo(
    () => (obraFilter === 'todas' ? obras : obras.filter(o => o.id === obraFilter)),
    [obras, obraFilter]
  );

  // Contas da obra selecionada (trend usa essa); e o subconjunto dentro do período (KPIs usam essa).
  const contasObra = useMemo(
    () => (obraFilter === 'todas' ? contas : contas.filter(c => c.obra_id === obraFilter)),
    [contas, obraFilter]
  );
  const contasPeriodo = useMemo(
    () => contasObra.filter(c => { const d = liqDate(c); return d && d >= dataCorteISO; }),
    [contasObra, dataCorteISO, liqDate]
  );

  // KPIs Financeiros (receber liquida como 'recebido'; pagar como 'pago')
  const totalReceitas = contasPeriodo
    .filter(c => c.tipo === 'receber' && (c.status === 'recebido' || c.status === 'pago'))
    .reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalDespesas = contasPeriodo
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);
  const saldoOperacional = totalReceitas - totalDespesas;
  const margemOperacional = totalReceitas > 0 ? ((saldoOperacional / totalReceitas) * 100) : 0;

  // KPIs de Obras
  const obrasAtivas = obrasFiltered.filter(o => o.status === 'em_andamento').length;
  const progressoMedio = obrasFiltered.length > 0
    ? obrasFiltered.reduce((acc, o) => acc + (o.percentual_concluido || 0), 0) / obrasFiltered.length
    : 0;
  const totalOrcado = obrasFiltered.reduce((acc, o) => acc + orcadoDe(o), 0);
  const totalRealizado = obrasFiltered.reduce((acc, o) => acc + (o.valor_realizado || 0), 0);
  const variacaoOrcamentaria = totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100) - 100 : 0;

  // KPIs de Frota (não é por obra)
  const totalAbastecimento = abastecimentos.reduce((acc, a) => acc + (a.valor_total || 0), 0);
  const totalManutencao = manutencoes.reduce((acc, m) => acc + (m.valor_total || 0), 0);
  const custoFrota = totalAbastecimento + totalManutencao;

  // Gráficos de tendência (últimos 6 meses da obra selecionada)
  const custosObrasMensais = useMemo(() => {
    const meses = {};
    contasObra.forEach(c => {
      if (c.tipo === 'pagar' && c.status === 'pago' && c.data_pagamento) {
        const mes = new Date(c.data_pagamento).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        meses[mes] = (meses[mes] || 0) + (c.valor || 0);
      }
    });
    return Object.entries(meses).slice(-6).map(([mes, valor]) => ({ mes, valor }));
  }, [contasObra]);

  const progressoObras = obrasFiltered
    .filter(o => o.status === 'em_andamento')
    .slice(0, 5)
    .map(o => ({
      nome: (o.nome || '').length > 20 ? o.nome.substring(0, 20) + '...' : (o.nome || ''),
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
    contasObra.forEach(c => {
      const d = liqDate(c);
      if (!d) return;
      const mes = new Date(d).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
      if (!meses[mes]) meses[mes] = { mes, receitas: 0, despesas: 0 };
      if (c.tipo === 'receber') meses[mes].receitas += c.valor || 0;
      else meses[mes].despesas += c.valor || 0;
    });
    return Object.values(meses).slice(-6);
  }, [contasObra, liqDate]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence"
        subtitle="Análise estratégica e indicadores de desempenho"
      />

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[11rem_16rem] gap-3">
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Período</Label>
          <ComboboxBusca
            options={[
              { value: '7', label: 'Últimos 7 dias' },
              { value: '30', label: 'Últimos 30 dias' },
              { value: '90', label: 'Últimos 90 dias' },
              { value: '365', label: 'Último ano' },
            ]}
            value={periodo}
            onSelect={(v) => setPeriodo(v || '30')}
            placeholder="Período"
            searchPlaceholder="Buscar..."
          />
        </div>
        <div>
          <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
          <ComboboxBusca
            options={[{ value: 'todas', label: 'Todas as Obras' }, ...obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))]}
            value={obraFilter}
            onSelect={(v) => setObraFilter(v || 'todas')}
            placeholder="Todas as Obras"
            searchPlaceholder="Buscar obra..."
            emptyMessage="Nenhuma obra."
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start border border-gray-200 p-1 bg-white">
          <TabsTrigger value="geral" className="whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <BarChart3 className="w-4 h-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="financeiro" className="whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <DollarSign className="w-4 h-4 mr-2" />
            Financeiro
          </TabsTrigger>
          <TabsTrigger value="obras" className="whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Building2 className="w-4 h-4 mr-2" />
            Obras
          </TabsTrigger>
          <TabsTrigger value="frota" className="whitespace-nowrap data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Truck className="w-4 h-4 mr-2" />
            Frota
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6 mt-6">
          {/* KPIs Principais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-emerald-600" />
                  {saldoOperacional >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-1">Saldo Operacional</p>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums truncate ${saldoOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'}`} title={fmtBRL(saldoOperacional)}>
                  {fmtCompactBRL(saldoOperacional)}
                </p>
                <p className="text-gray-500 text-xs mt-1">{margemOperacional.toFixed(1)}% margem</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Building2 className="w-8 h-8 text-blue-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Obras Ativas</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{obrasAtivas}</p>
                <p className="text-gray-500 text-xs mt-1">{progressoMedio.toFixed(1)}% progresso médio</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Truck className="w-8 h-8 text-amber-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Custo Frota (Total)</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(custoFrota)}>
                  {fmtCompactBRL(custoFrota)}
                </p>
                <p className="text-gray-500 text-xs mt-1">{veiculos.length} veículos</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <p className="text-gray-600 text-sm mb-1">Colaboradores Ativos</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">
                  {colaboradores.filter(c => c.status === 'ativo').length}
                </p>
                <p className="text-gray-500 text-xs mt-1">Total: {colaboradores.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Fluxo de Caixa</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={fluxoCaixaMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="mes" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="receitas" stroke="#10B981" fill="#10B981" fillOpacity={0.4} name="Receitas" />
                    <Area type="monotone" dataKey="despesas" stroke="#EF4444" fill="#EF4444" fillOpacity={0.4} name="Despesas" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardHeader>
                <CardTitle className="text-base font-semibold text-gray-900">Status das Obras</CardTitle>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Total Receitas</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums truncate" title={fmtBRL(totalReceitas)}>
                  {fmtCompactBRL(totalReceitas)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Total Despesas</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums truncate" title={fmtBRL(totalDespesas)}>
                  {fmtCompactBRL(totalDespesas)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Margem Operacional</p>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums ${margemOperacional >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {margemOperacional.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-gray-200">
             <CardHeader>
               <CardTitle className="text-base font-semibold text-gray-900">Evolução de Custos</CardTitle>
             </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={custosObrasMensais}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="valor" fill="#F59E0B" name="Custos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="obras" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Valor Orçado</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(totalOrcado)}>
                  {fmtCompactBRL(totalOrcado)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Valor Realizado</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums truncate" title={fmtBRL(totalRealizado)}>
                  {fmtCompactBRL(totalRealizado)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Variação Orçamentária</p>
                <p className={`text-lg sm:text-2xl font-bold tabular-nums ${variacaoOrcamentaria <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {variacaoOrcamentaria.toFixed(1)}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-gray-200">
             <CardHeader>
               <CardTitle className="text-base font-semibold text-gray-900">Progresso das Obras</CardTitle>
             </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={progressoObras} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" domain={[0, 100]} stroke="#9CA3AF" />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" width={150} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value) => `${value.toFixed(1)}%`}
                  />
                  <Bar dataKey="progresso" fill="#3B82F6" name="Progresso %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="frota" className="space-y-6 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Total Abastecimento</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums truncate" title={fmtBRL(totalAbastecimento)}>
                  {fmtCompactBRL(totalAbastecimento)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Total Manutenção</p>
                <p className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums truncate" title={fmtBRL(totalManutencao)}>
                  {fmtCompactBRL(totalManutencao)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Veículos Ativos</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums">
                  {veiculos.filter(v => v.status === 'ativo').length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-gray-600 text-sm mb-2">Em Manutenção</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums">
                  {veiculos.filter(v => v.status === 'manutencao').length}
                </p>
              </CardContent>
            </Card>
          </div>

          {veiculos.length === 0 && abastecimentos.length === 0 && manutencoes.length === 0 && (
            <Card className="bg-white border-gray-200">
              <CardContent className="py-10 text-center text-gray-500">
                <Truck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                Nenhum dado de frota cadastrado (veículos, abastecimentos ou manutenções).
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}