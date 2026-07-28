import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Calendar, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import SafeStatCard from '@/components/dashboard/SafeStatCard';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function DashboardObrasFinanceiro() {
  return (
    <div>
      <RouteGuardFinalV2 requiredPermissionKey="DASHBOARD_VIEW">
        <DashboardFinanceiroContent />
      </RouteGuardFinalV2>
    </div>
  );
}

function DashboardFinanceiroContent() {
  const navigate = useNavigate();
  const [periodoFilter, setPeriodoFilter] = useState('30');

  // Calcular período
  const getPeriodo = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(periodoFilter));
    return {
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0]
    };
  };

  // KPIs Financeiros
  const { data: financeKPIs = {}, isLoading: loadingKPIs, error: errorKPIs, refetch: refetchKPIs } = useQuery({
    queryKey: ['finance-advanced-kpis', periodoFilter],
    queryFn: async () => {
      const periodo = getPeriodo();
      const res = await base44.functions.invoke('getFinanceAdvancedKPIs', {
        periodStart: periodo.periodStart,
        periodEnd: periodo.periodEnd
      });
      return res.data || {};
    },
    staleTime: 120000,
    refetchOnWindowFocus: false
  });

  // Dados das obras para análise
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-financeiro'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 100)
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiro'],
    queryFn: () => base44.entities.ContaFinanceira.list('-updated_date', 100)
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-financeiro'],
    queryFn: () => base44.entities.Fornecedor.list()
  });

  // Cálculos
  const kpis = financeKPIs.kpis || {};
  const totalReceber = kpis.aReceberPendente || 0;
  const totalPagar = kpis.aPagarPendente || 0;
  const fluxo30dias = (kpis.aReceberPendente || 0) - (kpis.aPagarPendente || 0);
  const margemLucro = kpis.margemLucro || 0;

  // Dados para gráficos
  const contasPagar = contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente');
  const contasReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente');

  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();

  const contasPagarMesAtual = contasPagar.filter(c => {
    const data = new Date(c.data_vencimento);
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
  }).reduce((sum, c) => sum + (c.valor || 0), 0);

  const contasReceberMesAtual = contasReceber.filter(c => {
    const data = new Date(c.data_vencimento);
    return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
  }).reduce((sum, c) => sum + (c.valor || 0), 0);

  // Ranking de obras por margem
  const obraRanking = obras
    .filter(o => o.total_orcamento > 0)
    .map(o => ({
      nome: o.nome?.substring(0, 20) || 'Sem nome',
      orcado: o.total_orcamento || 0,
      realizado: o.total_final_orcamento || o.total_orcamento || 0,
      margem: ((o.total_orcamento - (o.total_final_orcamento || 0)) / o.total_orcamento * 100) || 0
    }))
    .sort((a, b) => b.margem - a.margem)
    .slice(0, 6);

  // Distribuição por fornecedor
  const fornecedorGastos = {};
  contas
    .filter(c => c.tipo === 'pagar' && c.fornecedor_cliente)
    .forEach(c => {
      if (!fornecedorGastos[c.fornecedor_cliente]) {
        fornecedorGastos[c.fornecedor_cliente] = 0;
      }
      fornecedorGastos[c.fornecedor_cliente] += c.valor || 0;
    });

  const fornecedorRanking = Object.entries(fornecedorGastos)
    .map(([nome, valor]) => ({ nome: nome.substring(0, 20), valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro/Gerencial</h1>
          <p className="text-gray-600 mt-1">Análise de desempenho financeiro e margens por obra</p>
        </div>
        <div className="flex gap-2">
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="w-44">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/FinanceiroAvancado')} className="bg-blue-600 hover:bg-blue-700">
            Ver Detalhes
          </Button>
        </div>
      </div>

      {/* KPIs Financeiros Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SafeStatCard
          title="A Pagar (Mês)"
          isLoading={loadingKPIs}
          error={errorKPIs}
          onRetry={refetchKPIs}
          value={contasPagarMesAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          subtitle={`${contasPagar.length} contas pendentes`}
          icon={DollarSign}
          iconBg="bg-red-500/10"
          iconColor="text-red-600"
          trend={contasPagar.length > 5 ? 'Alto' : 'Normal'}
          trendUp={false}
        />
        <SafeStatCard
          title="A Receber (Mês)"
          isLoading={loadingKPIs}
          error={errorKPIs}
          onRetry={refetchKPIs}
          value={contasReceberMesAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          subtitle={`${contasReceber.length} contas pendentes`}
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600"
          trend={contasReceber.length > 5 ? 'Alto' : 'Normal'}
          trendUp={true}
        />
        <SafeStatCard
          title="Fluxo Previsto (30d)"
          isLoading={loadingKPIs}
          error={errorKPIs}
          onRetry={refetchKPIs}
          value={fluxo30dias.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          subtitle={fluxo30dias > 0 ? 'Superávit' : 'Déficit'}
          icon={TrendingUp}
          iconBg={fluxo30dias > 0 ? "bg-emerald-500/10" : "bg-red-500/10"}
          iconColor={fluxo30dias > 0 ? "text-emerald-600" : "text-red-600"}
          trendUp={fluxo30dias > 0}
        />
        <SafeStatCard
          title="Margem Média"
          isLoading={loadingKPIs}
          error={errorKPIs}
          onRetry={refetchKPIs}
          value={`${margemLucro.toFixed(1)}%`}
          subtitle="Lucro sobre faturamento"
          icon={TrendingUp}
          iconBg={margemLucro > 10 ? "bg-emerald-500/10" : "bg-amber-500/10"}
          iconColor={margemLucro > 10 ? "text-emerald-600" : "text-amber-600"}
          trendUp={margemLucro > 10}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking de Obras por Margem */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Ranking de Obras (Margem)
          </h3>
          {obraRanking.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={obraRanking}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="nome" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB' }}
                    formatter={(v) => `${v.toFixed(1)}%`}
                  />
                  <Bar dataKey="margem" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-10">Sem dados disponíveis</p>
          )}
        </div>

        {/* Ranking de Fornecedores */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" /> Top Fornecedores
          </h3>
          {fornecedorRanking.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie data={fornecedorRanking} dataKey="valor" nameKey="nome">
                  {fornecedorRanking.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-10">Sem dados disponíveis</p>
          )}
        </div>
      </div>

      {/* Lista Ranking Detalhada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detalhes Obras */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Margem por Obra</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {obraRanking.map((obra) => (
                <div key={obra.nome} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{obra.nome}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">
                      {obra.margem.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      {obra.orcado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Detalhes Fornecedores */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Gastos com Fornecedores</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {fornecedorRanking.map((forn) => (
                <div key={forn.nome} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{forn.nome}</span>
                  <p className="text-sm font-semibold text-gray-900">
                    {forn.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Contas */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" /> Próximas Contas a Vencer
        </h3>
        <div className="space-y-2">
          {contas
            .filter(c => c.status === 'pendente')
            .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))
            .slice(0, 8)
            .map((conta) => {
              const dias = Math.ceil(
                (new Date(conta.data_vencimento) - new Date()) / 86400000
              );
              return (
                <div
                  key={conta.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {conta.descricao || conta.fornecedor_cliente || 'Conta'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Vence em {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {conta.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                    <Badge
                      className={`text-xs mt-1 ${
                        dias < 0
                          ? 'bg-red-100 text-red-800'
                          : dias <= 3
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {dias < 0 ? `${Math.abs(dias)}d atrasada` : dias === 0 ? 'Hoje' : `${dias}d`}
                    </Badge>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}