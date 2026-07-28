import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  TrendingUp,
  DollarSign,
  BarChart3,
  PieChart,
  Target,
  Download,
  Calculator,
  Wallet,
  ClipboardList
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComboboxBusca from '../components/shared/ComboboxBusca';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from 'recharts';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import DREComponent from '../components/financeiro/DREComponent';
import SimuladorImpacto from '../components/financeiro/SimuladorImpacto';
import IndicadoresAvancados from '../components/financeiro/IndicadoresAvancados';
import FluxoCaixaAvancado from '../components/financeiro/FluxoCaixaAvancado';
import ContasDetalhadas from '../components/financeiro/ContasDetalhadas';
import RelatorioCustosPersonalizavel from '../components/financeiro/RelatorioCustosPersonalizavel';
import AlertasFinanceiros from '../components/financeiro/AlertasFinanceiros';

export default function FinanceiroEstrategico({ embedded = false }) {
  const [obraFilter, setObraFilter] = useState('todas');

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 500)
  });

  const { data: contratos = [] } = useQuery({
    queryKey: ['contratos'],
    queryFn: () => base44.entities.Contrato.list()
  });

  const { data: medicoes = [] } = useQuery({
    queryKey: ['medicoes'],
    queryFn: () => base44.entities.Medicao.list()
  });

  // Filtrar por obra
  const obrasFiltradas = obraFilter === 'todas' ? obras : obras.filter(o => o.id === obraFilter);

  // Cálculo de Margem Real por Obra
  const margensPorObra = obrasFiltradas.map(obra => {
    const contasObra = contas.filter(c => c.obra_id === obra.id);
    const receitas = contasObra.filter(c => c.tipo === 'receber' && c.status === 'recebido').reduce((acc, c) => acc + (c.valor || 0), 0);
    const despesas = contasObra.filter(c => c.tipo === 'pagar' && c.status === 'pago').reduce((acc, c) => acc + (c.valor || 0), 0);
    
    const margemBruta = receitas - despesas;
    const margemPercentual = receitas > 0 ? (margemBruta / receitas) * 100 : 0;

    return {
      nome: obra.nome?.substring(0, 20) || 'Sem nome',
      receitas,
      despesas,
      margem: margemBruta,
      margemPercentual: margemPercentual.toFixed(1),
      valorContrato: obra.valor_contrato || 0
    };
  }).sort((a, b) => parseFloat(b.margemPercentual) - parseFloat(a.margemPercentual)).slice(0, 10);

  // Projeção de Capital de Giro (próximos 6 meses)
  const hoje = new Date();
  const projecaoCapital = [];
  
  for (let i = 0; i < 6; i++) {
    const mesData = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mesInicio = new Date(mesData.getFullYear(), mesData.getMonth(), 1);
    const mesFim = new Date(mesData.getFullYear(), mesData.getMonth() + 1, 0);
    
    const contasMes = contas.filter(c => {
      const dataVenc = new Date(c.data_vencimento);
      return dataVenc >= mesInicio && dataVenc <= mesFim;
    });

    const receberMes = contasMes.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
    const pagarMes = contasMes.filter(c => c.tipo === 'pagar' && c.status === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
    
    projecaoCapital.push({
      mes: mesData.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      receber: receberMes,
      pagar: pagarMes,
      saldo: receberMes - pagarMes
    });
  }

  // Indicadores consolidados
  const totalReceitas = margensPorObra.reduce((acc, o) => acc + o.receitas, 0);
  const totalDespesas = margensPorObra.reduce((acc, o) => acc + o.despesas, 0);
  const margemTotal = totalReceitas - totalDespesas;
  const margemTotalPercentual = totalReceitas > 0 ? (margemTotal / totalReceitas) * 100 : 0;

  // ROI médio das obras
  const obrasComValor = obrasFiltradas.filter(o => o.valor_contrato > 0);
  const roiMedio = obrasComValor.length > 0
    ? obrasComValor.reduce((acc, o) => {
        const investimento = o.valor_realizado || 0;
        const retorno = o.valor_contrato || 0;
        const roi = investimento > 0 ? ((retorno - investimento) / investimento) * 100 : 0;
        return acc + roi;
      }, 0) / obrasComValor.length
    : 0;

  // Contratos vencendo
  const contratosVencendo = contratos.filter(c => {
    if (!c.data_termino) return false;
    const termino = new Date(c.data_termino);
    const diasRestantes = Math.ceil((termino - hoje) / (1000 * 60 * 60 * 24));
    return diasRestantes > 0 && diasRestantes <= 90;
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {!embedded && (
          <PageHeader
            title="Financeiro Estratégico"
            subtitle="DRE, margens e projeções financeiras"
          />
        )}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <ComboboxBusca
              options={[{ value: 'todas', label: 'Todas as Obras' }, ...obras.map(o => ({ value: o.id, label: o.nome }))]}
              value={obraFilter}
              onSelect={(v) => setObraFilter(v || 'todas')}
              placeholder="Todas as Obras"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra encontrada"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Margem Total"
          value={margemTotalPercentual.toFixed(1) + '%'}
          subtitle={margemTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={TrendingUp}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Receitas Realizadas"
          value={totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })}
          icon={DollarSign}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="ROI Médio"
          value={roiMedio.toFixed(1) + '%'}
          subtitle="Retorno sobre investimento"
          icon={Target}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Contratos Vencendo"
          value={contratosVencendo}
          subtitle="Próximos 90 dias"
          icon={BarChart3}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Margem por Obra */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-500" />
              Margem Real por Obra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={margensPorObra} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" fontSize={10} width={120} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Bar dataKey="margemPercentual" fill="#10B981" radius={[0, 8, 8, 0]} name="Margem %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Projeção Capital de Giro */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              Projeção Capital de Giro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={projecaoCapital}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="receber" fill="#10B981" name="A Receber" />
                  <Bar dataKey="pagar" fill="#EF4444" name="A Pagar" />
                  <Line type="monotone" dataKey="saldo" stroke="#F59E0B" strokeWidth={3} name="Saldo" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      <AlertasFinanceiros contas={contas} />

      {/* Tabs */}
      <Tabs defaultValue="fluxo" className="space-y-6">
        <TabsList className="w-full overflow-x-auto">
          <TabsTrigger value="fluxo" className="shrink-0 whitespace-nowrap">
            <Wallet className="w-4 h-4 mr-2" />
            Fluxo de Caixa
          </TabsTrigger>
          <TabsTrigger value="contas" className="shrink-0 whitespace-nowrap">
            <ClipboardList className="w-4 h-4 mr-2" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="custos" className="shrink-0 whitespace-nowrap">
            <BarChart3 className="w-4 h-4 mr-2" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="dre" className="shrink-0 whitespace-nowrap">
            <PieChart className="w-4 h-4 mr-2" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="simulacao" className="shrink-0 whitespace-nowrap">
            <Calculator className="w-4 h-4 mr-2" />
            Simulador
          </TabsTrigger>
          <TabsTrigger value="indicadores" className="shrink-0 whitespace-nowrap">
            <Target className="w-4 h-4 mr-2" />
            Indicadores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo">
          <FluxoCaixaAvancado contas={contas} />
        </TabsContent>

        <TabsContent value="contas">
          <ContasDetalhadas contas={contas} />
        </TabsContent>

        <TabsContent value="custos">
          <RelatorioCustosPersonalizavel contas={contas} obras={obras} />
        </TabsContent>

        <TabsContent value="dre">
          <DREComponent obras={obrasFiltradas} contas={contas} />
        </TabsContent>

        <TabsContent value="simulacao">
          <SimuladorImpacto obras={obras} />
        </TabsContent>

        <TabsContent value="indicadores">
          <IndicadoresAvancados 
            obras={obrasFiltradas}
            contas={contas}
            contratos={contratos}
            medicoes={medicoes}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}