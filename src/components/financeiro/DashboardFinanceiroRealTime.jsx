import React, { useMemo, useState } from 'react';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../dashboard/StatCard';

export default function DashboardFinanceiroRealTime() {
  const navigate = useNavigate();
  const [periodoFilter, setPeriodoFilter] = useState('30');
  const [showValues, setShowValues] = useState(true);
  const [obraFilter, setObraFilter] = React.useState(null);

  // Ler querystring (período e obra vindo do Dashboard)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inicio = params.get('inicio');
    const fim = params.get('fim');
    const obraId = params.get('obraId');
    
    if (inicio && fim) {
      // Calcular período em dias com base nas datas recebidas
      const dataInicio = new Date(inicio);
      const dataFim = new Date(fim);
      const dias = Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24));
      setPeriodoFilter(dias.toString());
    }
    if (obraId) setObraFilter(obraId);
  }, []);

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

  // KPIs Financeiros (fonte única - getFinanceAdvancedKPIs com período/obra)
  const { data: financeKPIs, isLoading: loadingKPIs, refetch } = useQuery({
    queryKey: ['finance-advanced-kpis', periodoFilter, obraFilter],
    queryFn: async () => {
      const periodo = getPeriodo();
      const res = await base44.functions.invoke('getFinanceAdvancedKPIs', {
        periodStart: periodo.periodStart,
        periodEnd: periodo.periodEnd,
        obraId: obraFilter || null
      });
      return res.data;
    },
    staleTime: 30000,
    refetchInterval: 60000
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Usar KPIs da fonte centralizada (getUnifiedFinanceKpis)
  // Fallback direto: buscar contas de tesouraria se backend não retornar
  const { data: contasTesourariaLocal = [] } = useQuery({
    queryKey: ['contas-tesouraria-fallback'],
    queryFn: () => base44.entities.ContaTesouraria.list(),
    staleTime: 60000,
  });

  const totalReceber = financeKPIs?.kpis?.aReceberPendente || 0;
  const totalPagar = financeKPIs?.kpis?.aPagarPendente || 0;
  const recebidoMes = financeKPIs?.kpis?.recebidoNoPeriodo || 0;
  const pagoMes = financeKPIs?.kpis?.pagoNoPeriodo || 0;
  const custosOperacionais = financeKPIs?.kpis?.custosOperacionaisPeriodo || 0;
  const lucroOuPrejuizo = financeKPIs?.kpis?.lucroOuPrejuizoPeriodo || 0;
  const statusSaude = financeKPIs?.kpis?.statusSaude || 'desconhecido';
  
  // Usar tesouraria do backend se disponível; senão, montar a partir do fallback local
  const tesourariaBackend = financeKPIs?.tesouraria || {};
  const contasAtivas = contasTesourariaLocal.filter(c => !c.status || c.status === 'ativa');
  
  const tesouraria = (tesourariaBackend?.contas?.length > 0) ? tesourariaBackend : {
    saldoConsolidado: contasAtivas.reduce((s, c) => s + (c.saldo_atual || 0), 0),
    qtdContas: contasAtivas.length,
    totalCaixa: contasAtivas.filter(c => c.tipo === 'caixa').reduce((s, c) => s + (c.saldo_atual || 0), 0),
    totalBancos: contasAtivas.filter(c => (c.tipo || '').startsWith('banco_')).reduce((s, c) => s + (c.saldo_atual || 0), 0),
    totalObras: contasAtivas.filter(c => c.tipo === 'conta_obra').reduce((s, c) => s + (c.saldo_atual || 0), 0),
    contas: contasAtivas.map(c => ({
      id: c.id,
      nome: c.nome,
      tipo: c.tipo,
      saldo_atual: c.saldo_atual || 0,
      banco: c.banco || '',
      obra_id: c.obra_id || ''
    }))
  };
  
  const saldoConsolidado = tesouraria.saldoConsolidado ?? financeKPIs?.kpis?.saldoConsolidadoTesouraria ?? financeKPIs?.kpis?.saldoCaixaPeriodo ?? 0;

  const stats = useMemo(() => {
    return { 
      pagar: totalPagar, 
      receber: totalReceber, 
      pagoMes, 
      recebidoMes,
      custosOperacionais,
      lucroOuPrejuizo,
      statusSaude
    };
  }, [totalPagar, totalReceber, pagoMes, recebidoMes, custosOperacionais, lucroOuPrejuizo, statusSaude]);

  const formatValue = (val) => !showValues ? '***' : val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleNavigateAReceber = () => {
    const periodo = getPeriodo();
    navigate(`/FinanceiroAvancado?tab=dashboard&inicio=${periodo.periodStart}&fim=${periodo.periodEnd}${obraFilter ? `&obraId=${obraFilter}` : ''}`);
  };

  const handleNavigateSaldoCaixa = () => {
    const periodo = getPeriodo();
    navigate(`/FinanceiroAvancado?tab=dashboard&inicio=${periodo.periodStart}&fim=${periodo.periodEnd}${obraFilter ? `&obraId=${obraFilter}` : ''}`);
  };

  const handleNavigateCustos = () => {
    const periodo = getPeriodo();
    navigate(`/FinanceiroAvancado?tab=pagamentos&inicio=${periodo.periodStart}&fim=${periodo.periodEnd}${obraFilter ? `&obraId=${obraFilter}` : ''}`);
  };

  if (loadingKPIs) {
    return <KpiCardsSkeleton count={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard Financeiro</h2>
          <p className="text-sm text-gray-600 mt-1">
            Período: {getPeriodo().periodStart} a {getPeriodo().periodEnd}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          {/* Seletor de período */}
          <select
            value={periodoFilter}
            onChange={(e) => setPeriodoFilter(e.target.value)}
            className="w-full sm:w-44 h-10 px-3 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Últimos 7 dias</option>
            <option value="15">Últimos 15 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="60">Últimos 60 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>

          {/* Filtro por obra */}
          <div className="w-full sm:w-52">
            <ComboboxBusca
              className="h-10 rounded-lg"
              options={[{ value: '__all', label: 'Todas as obras' }, ...obras.map(o => ({ value: o.id, label: o.nome }))]}
              value={obraFilter || ''}
              onSelect={(v) => setObraFilter(v === '__all' ? null : v)}
              placeholder="Todas as obras"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra."
            />
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowValues(!showValues)}
              className="h-10 w-10 flex items-center justify-center shrink-0 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              title={showValues ? "Ocultar valores" : "Mostrar valores"}
            >
              {showValues ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>

            <Button
              onClick={() => refetch()}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none h-10 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div onClick={handleNavigateAReceber} className="cursor-pointer">
          <StatCard
            title="A Pagar"
            value={formatValue(stats.pagar)}
            icon={TrendingDown}
            iconBg="bg-red-50"
            iconColor="text-red-500"
          />
        </div>

        <div onClick={handleNavigateAReceber} className="cursor-pointer">
          <StatCard
            title="A Receber"
            value={formatValue(stats.receber)}
            icon={TrendingUp}
            iconBg="bg-green-50"
            iconColor="text-green-500"
          />
        </div>

        <div>
          <StatCard
            title="Pago (Período)"
            value={formatValue(stats.pagoMes)}
            icon={DollarSign}
            iconBg="bg-green-50"
            iconColor="text-green-500"
          />
        </div>

        <div>
          <StatCard
            title="Recebido (Período)"
            value={formatValue(stats.recebidoMes)}
            icon={DollarSign}
            iconBg="bg-green-50"
            iconColor="text-green-500"
          />
        </div>

        <div onClick={handleNavigateCustos} className="cursor-pointer">
          <StatCard
            title="Custos (Período)"
            value={formatValue(stats.custosOperacionais)}
            icon={TrendingDown}
            iconBg="bg-amber-50"
            iconColor="text-amber-500"
          />
        </div>

        <div>
          <StatCard
            title="Lucro/Prejuízo"
            value={formatValue(stats.lucroOuPrejuizo)}
            icon={stats.lucroOuPrejuizo >= 0 ? TrendingUp : TrendingDown}
            iconBg={stats.lucroOuPrejuizo >= 0 ? "bg-green-50" : "bg-red-50"}
            iconColor={stats.lucroOuPrejuizo >= 0 ? "text-green-500" : "text-red-500"}
          />
        </div>
      </div>

      {/* Saldo Consolidado de Caixa (Tesouraria) */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            Saldo de Caixa (Consolidado)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-3xl font-bold mb-3 ${saldoConsolidado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
            {formatValue(saldoConsolidado)}
          </p>
          {tesouraria.contas?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contas Ativas ({tesouraria.qtdContas})</p>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tesouraria.contas.map(c => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.nome}</p>
                      <p className="text-xs text-gray-400 capitalize">{(c.tipo || '').replace(/_/g, ' ')}{c.banco ? ` • ${c.banco}` : ''}</p>
                    </div>
                    <p className={`text-sm font-bold flex-shrink-0 ml-3 ${(c.saldo_atual || 0) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                      {showValues ? (c.saldo_atual || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '***'}
                    </p>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2 text-blue-700" onClick={() => navigate('/Tesouraria')}>
                Ver Extrato Completo →
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-2">Nenhuma conta de tesouraria cadastrada</p>
              <Button variant="outline" size="sm" onClick={() => navigate('/Tesouraria')}>Configurar Contas</Button>
            </div>
          )}
        </CardContent>
      </Card>

       {/* Detalhamento de gastos adicionais */}
       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
         <StatCard
           title="Impostos"
           value={formatValue(financeKPIs?.kpis?.custosPorCategoria?.impostos || 0)}
           icon={TrendingDown}
           iconBg="bg-gray-100"
           iconColor="text-gray-500"
         />
         <StatCard
           title="Alimentação"
           value={formatValue(financeKPIs?.kpis?.custosPorCategoria?.alimentacao || 0)}
           icon={TrendingDown}
           iconBg="bg-gray-100"
           iconColor="text-gray-500"
         />
         <StatCard
           title="Aluguel"
           value={formatValue(financeKPIs?.kpis?.custosPorCategoria?.aluguel || 0)}
           icon={TrendingDown}
           iconBg="bg-gray-100"
           iconColor="text-gray-500"
         />
       </div>

    </div>
  );
}