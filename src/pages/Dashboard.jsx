import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import {
  Building2,
  Truck,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Filter,
  Database,
  Trash2,
  Loader2,
  ThumbsUp,
  FileText,
  ShoppingCart,
  Ruler,
  NotebookPen } from
'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from 'recharts';
import { useCanAccess } from '../components/shared/RBACContext';
import StatCard from '../components/dashboard/StatCard';
import SafeStatCard from '../components/dashboard/SafeStatCard';
import ObraCard from '../components/dashboard/ObraCard';
import AlertasIA from '../components/dashboard/AlertasIA';
import AlertasIntegrados from '../components/dashboard/AlertasIntegrados';
import ShortcutsCard from '../components/dashboard/ShortcutsCard';
import SupervisorIAFuncao from '../components/ia/SupervisorIAFuncao';
import ProximosRecebimentos from '../components/dashboard/ProximosRecebimentos';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import DashboardCampo from '../components/dashboard/DashboardCampo';
import DashboardEngenharia from '../components/dashboard/DashboardEngenharia';
import DashboardFinanceiro from '../components/dashboard/DashboardFinanceiro';
import DashboardCompras from '../components/dashboard/DashboardCompras';
import DashboardMotorista from '../components/dashboard/DashboardMotorista';
import DashboardRH from '../components/dashboard/DashboardRH';
import DashboardAlmoxarife from '../components/dashboard/DashboardAlmoxarife';
import DashboardEncarregado from '../components/dashboard/DashboardEncarregado';
import DashboardOperacional from '../components/dashboard/DashboardOperacional';
import DashboardSupervisor from '../components/dashboard/DashboardSupervisor';
import AprovacoesPendentesWidget from '../components/aprovacoes/AprovacoesPendentesWidget';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

// Moeda responsiva nos KPIs: no mobile mostra compacto ("R$ 5,5 mi") pra caber
// sem cortar/reticências; no desktop (sm+) mostra o valor cheio.
const moedaResp = (v) => {
  const n = v || 0;
  const cheia = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const curta = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  return (
    <>
      <span className="sm:hidden">{curta}</span>
      <span className="hidden sm:inline">{cheia}</span>
    </>
  );
};

// Ícone + cor por tipo de atividade (caixinha tintada na lista de Atividades Recentes).
const tipoAtividade = {
  obra: { icon: Building2, color: 'bg-blue-50 text-blue-600' },
  requisicao: { icon: FileText, color: 'bg-amber-50 text-amber-600' },
  ordem_compra: { icon: ShoppingCart, color: 'bg-violet-50 text-violet-600' },
  medicao: { icon: Ruler, color: 'bg-emerald-50 text-emerald-600' },
  diario: { icon: NotebookPen, color: 'bg-cyan-50 text-cyan-600' }
};

export default function Dashboard() {
  return (
    <div>
      <RouteGuardFinalV2 requiredPermissionKey="DASHBOARD_VIEW">
        <DashboardContent />
      </RouteGuardFinalV2>
    </div>);

}

function DashboardContent() {
  const navigate = useNavigate();
  const { can } = useCanAccess();
  // Esconde um bloco só quando a permissão é negada de fato (can === false).
  // Enquanto o RBAC carrega (null) ou é super admin (true), mostra normalmente —
  // evita "piscar" e nunca deixa o dashboard em branco.
  const ver = (k) => can(k) !== false;
  const verQualquer = (...ks) => ks.some((k) => can(k) !== false);
  // Nº de colunas da grade de KPIs conforme quantos cards estão visíveis (evita
  // card solto ocupando 1/4 da tela quando a role só pode ver poucos).
  const gridCols = (n) =>
    n <= 1 ? 'grid-cols-1 sm:max-w-xs'
    : n === 2 ? 'grid-cols-1 sm:grid-cols-2 sm:max-w-2xl'
    : n === 3 ? 'grid-cols-2 lg:grid-cols-3'
    : 'grid-cols-2 lg:grid-cols-4';
  const [periodoFilter, setPeriodoFilter] = useState('30');
  const [obraFilter, setObraFilter] = useState('todas');

  // Calcular período start/end baseado no filtro
  const getPeriodo = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(periodoFilter));
    return {
      periodStart: start.toISOString().split('T')[0],
      periodEnd: end.toISOString().split('T')[0]
    };
  };

  // KPIs Financeiros (FONTE ÚNICA - getFinanceAdvancedKPIs)
  const { data: financeKPIs, isLoading: loadingKPIs, error: errorKPIs, refetch: refetchKPIs } = useQuery({
    queryKey: ['finance-advanced-kpis', periodoFilter, obraFilter],
    queryFn: async () => {
      const periodo = getPeriodo();
      const res = await base44.functions.invoke('getFinanceAdvancedKPIs', {
        periodStart: periodo.periodStart,
        periodEnd: periodo.periodEnd,
        obraId: obraFilter !== 'todas' ? obraFilter : null
      });
      return res.data;
    },
    staleTime: 120000,
    refetchOnWindowFocus: false,
    retry: 1,
    gcTime: 300000
  });

  const { data: obras = [], isLoading: loadingObras, error: errorObras, refetch: refetchObras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 50),
    staleTime: 120000,
    gcTime: 300000
  });

  const { data: veiculos = [], isLoading: loadingVeiculos, error: errorVeiculos, refetch: refetchVeiculos } = useQuery({
    queryKey: ['ativos-frota-dash'],
    // Modelo novo = Ativo Único (Veiculo é legado). status: disponivel/em_uso/manutencao.
    queryFn: () => base44.entities.Ativo.list(),
    staleTime: 300000,
    gcTime: 600000
  });

  const { data: contas = [], isLoading: loadingContas, error: errorContas, refetch: refetchContas } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list('-data_vencimento', 100),
    staleTime: 120000,
    gcTime: 300000
  });

  const { data: colaboradores = [], isLoading: loadingColaboradores, error: errorColaboradores, refetch: refetchColaboradores } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list()
  });

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-recentes'],
    queryFn: () => base44.entities.RequisicaoCompra.list('-updated_date', 20)
  });

  // Medição canônica = BM (Medicao é legado e vem vazia no fluxo atual).
  const { data: medicoes = [] } = useQuery({
    queryKey: ['bms-recentes'],
    queryFn: () => base44.entities.BM.list('-updated_date', 20)
  });

  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-recentes'],
    queryFn: () => base44.entities.DiarioObra.list('-updated_date', 20)
  });

  const { data: ordemCompras = [] } = useQuery({
    queryKey: ['ordem-compras-recentes'],
    queryFn: () => base44.entities.OrdemCompra.list('-updated_date', 20)
  });

  const { data: insumos = [], isLoading: loadingInsumos, error: errorInsumos, refetch: refetchInsumos } = useQuery({
    queryKey: ['insumos-ativos'],
    queryFn: async () => {
      return await base44.entities.Insumo.filter({ ativo: true });
    },
    staleTime: 120000
  });


  const { data: comprasPendentes = [], isLoading: loadingComprasPendentes, error: errorComprasPendentes, refetch: refetchComprasPendentes } = useQuery({
    queryKey: ['compras-pendentes'],
    queryFn: async () => {
      // Fluxo ATIVO de compras = SolicitacaoCompra (a antiga RequisicaoCompra é legado).
      // "Pendente/aberta" = ainda não convertida em pedido, nem cancelada/rejeitada.
      const todas = await base44.entities.SolicitacaoCompra.list('-updated_date', 100);
      const fechadas = ['convertida', 'cancelada', 'rejeitada'];
      return todas.filter((s) => !fechadas.includes(String(s.status || '').toLowerCase()));
    },
    staleTime: 120000
  });



  // Filtros
  const obrasFiltradas = obraFilter === 'todas' ?
  obras :
  obras.filter((o) => o.id === obraFilter);

  // Cálculos dos indicadores (usando dados das entidades para contagens)
  const obrasEmAndamento = obrasFiltradas.filter((o) => o.status === 'em_andamento').length;
  const obrasConcluidas = obrasFiltradas.filter((o) => o.status === 'concluida').length;
  const obrasAtrasadas = obrasFiltradas.filter((o) => {
    if (o.status !== 'em_andamento') return false;
    const hoje = new Date();
    const previsao = new Date(o.data_prevista_fim);
    return previsao < hoje;
  }).length;

  const veiculosAtivos = veiculos.filter((v) => v.status === 'disponivel' || v.status === 'em_uso').length;
  const veiculosManutencao = veiculos.filter((v) => v.status === 'manutencao').length;
  const veiculosInativos = veiculos.filter((v) => v.status === 'inativo' || v.status === 'baixado').length;

  const contasAtrasadas = contas.filter((c) => {
    if (c.status !== 'pendente') return false;
    const hoje = new Date();
    const vencimento = new Date(c.data_vencimento);
    return vencimento < hoje;
  }).length;

  const colaboradoresAtivos = colaboradores.filter((c) => c.status === 'ativo').length;

  // KPIs Financeiros (usar valores da função centralizada - getFinanceAdvancedKPIs)
  const totalReceber = financeKPIs?.kpis?.aReceberPendente || 0;
  const totalPagar = financeKPIs?.kpis?.aPagarPendente || 0;
  const saldoCaixaConsolidado = financeKPIs?.kpis?.saldoConsolidadoTesouraria ?? financeKPIs?.kpis?.saldoCaixaPeriodo ?? 0;
  const lucroNoPeriodo = financeKPIs?.kpis?.lucroOuPrejuizoPeriodo || 0;
  const recebidoNoPeriodo = financeKPIs?.kpis?.recebidoNoPeriodo || 0;
  // Custos no período: usa custos operacionais; se vier 0, cai para total pago no período.
  const totalCustos = financeKPIs?.kpis?.custosOperacionaisPeriodo || financeKPIs?.kpis?.pagoNoPeriodo || 0;
  const margemLucro = recebidoNoPeriodo > 0 ? (lucroNoPeriodo / recebidoNoPeriodo) * 100 : 0;
  const qtdContasTesouraria = financeKPIs?.tesouraria?.qtdContas || 0;

  // Atividades Recentes - unifica diferentes tipos de atividades com dados REAIS
  const atividadesRecentes = React.useMemo(() => {
    const atividades = [];

    // Obras recentes
    obras.forEach((obra) => {
      if (!obra.id) return;
      atividades.push({
        tipo: 'obra',
        id: obra.id,
        titulo: obra.nome || 'Obra sem nome',
        subtitulo: obra.descricao || (obra.tipo === 'publica' ? 'Obra Pública' : 'Obra Privada'),
        responsavel: obra.responsavel_tecnico || obra.responsavel_obra || obra.created_by || 'Não definido',
        status: obra.status || 'em_andamento',
        data: obra.updated_date || obra.created_date,
        page: 'ObraDetalhes'
      });
    });

    // Requisições recentes
    requisicoes.forEach((req) => {
      if (!req.id) return;
      atividades.push({
        tipo: 'requisicao',
        id: req.id,
        titulo: req.titulo || 'Requisição de Compra',
        subtitulo: req.descricao_resumo || 'Requisição de materiais',
        responsavel: req.solicitante || req.created_by || 'Não definido',
        status: req.status || 'aguardando',
        data: req.updated_date || req.created_date,
        page: 'SolicitacaoDetalhes'
      });
    });

    // Ordens de Compra recentes
    ordemCompras.forEach((oc) => {
      if (!oc.id) return;
      atividades.push({
        tipo: 'ordem_compra',
        id: oc.id,
        titulo: `Ordem de Compra #${oc.numero || oc.id.substring(0, 8)}`,
        subtitulo: oc.fornecedor_nome || 'Fornecedor não definido',
        responsavel: oc.aprovado_por || oc.created_by || 'Não definido',
        status: oc.status || 'criada',
        data: oc.updated_date || oc.created_date,
        page: 'CompraDetalhes'
      });
    });

    // Medições recentes (BMs)
    medicoes.forEach((med) => {
      if (!med.id) return;
      atividades.push({
        tipo: 'medicao',
        id: med.id,
        titulo: `Medição BM #${med.numero || med.id.substring(0, 8)}`,
        subtitulo: med.percent_concluida != null ? `${Number(med.percent_concluida).toFixed(1)}% concluída` : 'Boletim de medição',
        responsavel: med.aprovada_por || med.created_by || 'Não definido',
        status: med.status || 'RASCUNHO',
        data: med.updated_date || med.created_date,
        page: 'BMDetalhes',
        link: `/BMDetalhes?bm_id=${med.id}`
      });
    });

    // Diários recentes
    diarios.forEach((diario) => {
      if (!diario.id) return;
      atividades.push({
        tipo: 'diario',
        id: diario.id,
        titulo: 'Diário de Obra',
        subtitulo: diario.atividades_realizadas?.substring(0, 50) || 'Registro diário',
        responsavel: diario.responsavel || diario.created_by || 'Não definido',
        status: diario.status || 'rascunho',
        data: diario.updated_date || diario.created_date || diario.data,
        page: 'DiarioCampo'
      });
    });

    // Ordena por data mais recente e filtra entradas sem data
    return atividades.
    filter((a) => a.data).
    sort((a, b) => new Date(b.data) - new Date(a.data)).
    slice(0, 10);
  }, [obras, requisicoes, medicoes, diarios, ordemCompras]);

  // Dados para gráficos
  const obrasPorStatus = [
  { name: 'Em Andamento', value: obrasFiltradas.filter((o) => o.status === 'em_andamento').length },
  { name: 'Planejamento', value: obrasFiltradas.filter((o) => o.status === 'planejamento').length },
  { name: 'Concluídas', value: obrasFiltradas.filter((o) => o.status === 'concluida').length },
  { name: 'Pausadas', value: obrasFiltradas.filter((o) => o.status === 'pausada').length }].
  filter((item) => item.value > 0);

  const orcadoVsRealizado = obrasFiltradas.map((obra) => ({
    nome: obra.nome?.substring(0, 15) || 'Sem nome',
    orcado: obra.valor_orcado || 0,
    realizado: obra.valor_realizado || 0
  })).slice(0, 6);

  // FIX #2: Fluxo de caixa real — agrega contas por mês dos últimos 6 meses
  const fluxoCaixa = React.useMemo(() => {
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      meses.push({
        mes: d.toLocaleString('pt-BR', { month: 'short' }),
        ano: d.getFullYear(),
        mesNum: d.getMonth(),
        receitas: 0,
        despesas: 0
      });
    }
    contas.forEach((c) => {
      const ref = c.data_pagamento || c.data_vencimento;
      if (!ref) return;
      const d = new Date(ref);
      const entry = meses.find((m) => m.mesNum === d.getMonth() && m.ano === d.getFullYear());
      if (!entry) return;
      if (c.status === 'pago' || c.status === 'recebido') {
        if (c.tipo === 'receber') entry.receitas += c.valor || 0;
        if (c.tipo === 'pagar') entry.despesas += c.valor || 0;
      }
    });
    return meses;
  }, [contas]);

  const contasVencer = contas.
  filter((c) => c.status === 'pendente').
  sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento)).
  slice(0, 5);

  if (loadingObras || loadingVeiculos || loadingContas || loadingKPIs) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) =>
          <Skeleton key={i} className="h-36 rounded-lg" />
          )}
        </div>
      </div>);

  }

  // KPIs visíveis conforme a permissão da role (uma única grade adaptativa).
  const kpis = [
    ver('OBRAS_VIEW') && (
      <SafeStatCard key="obras" title="Obras Ativas" routePath="/Obras" isLoading={loadingObras} error={errorObras} data={obras} onRetry={refetchObras} value={obrasEmAndamento} subtitle={`${obras.length} total • ${obrasConcluidas} concluídas`} icon={Building2} trend={obrasAtrasadas > 0 ? `${obrasAtrasadas} atrasadas` : 'No prazo'} trendUp={obrasAtrasadas === 0} iconBg="bg-blue-500/10" iconColor="text-blue-600" />
    ),
    ver('FINANCEIRO_VIEW') && (
      <SafeStatCard key="receber" title="A Receber" routePath="/Financeiro" isLoading={loadingKPIs} error={errorKPIs} data={financeKPIs} onRetry={refetchKPIs} value={moedaResp(totalReceber)} subtitle="Pendente de recebimento" icon={DollarSign} trend={totalReceber > 0 ? 'Aguardando' : 'Zerado'} trendUp={false} iconBg="bg-emerald-500/10" iconColor="text-emerald-600" />
    ),
    ver('FINANCEIRO_VIEW') && (
      <SafeStatCard key="custos" title="Custos" routePath="/Financeiro" isLoading={loadingKPIs} error={errorKPIs} data={financeKPIs} onRetry={refetchKPIs} value={moedaResp(totalCustos)} subtitle={margemLucro ? `Margem ${margemLucro.toFixed(1)}%` : 'No período'} icon={TrendingUp} trend={lucroNoPeriodo > 0 ? 'Lucrativo' : 'Prejuízo'} trendUp={lucroNoPeriodo > 0} iconBg={lucroNoPeriodo > 0 ? "bg-emerald-500/10" : "bg-red-500/10"} iconColor={lucroNoPeriodo > 0 ? "text-emerald-600" : "text-red-600"} />
    ),
    ver('FINANCEIRO_VIEW') && (
      <SafeStatCard key="saldo" title="Saldo de Caixa (Consolidado)" routePath="/Tesouraria" isLoading={loadingKPIs} error={errorKPIs} data={financeKPIs} onRetry={refetchKPIs} value={moedaResp(saldoCaixaConsolidado)} subtitle={qtdContasTesouraria > 0 ? `${qtdContasTesouraria} conta(s) ativa(s)` : 'Saldo real de caixa e bancos'} icon={DollarSign} iconBg={saldoCaixaConsolidado >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"} iconColor={saldoCaixaConsolidado >= 0 ? "text-emerald-600" : "text-red-600"} />
    ),
    ver('COMPRAS_VIEW') && (
      <SafeStatCard key="compras" title="Compras Pendentes" routePath="/SuprimentosSolicitacoes" isLoading={loadingComprasPendentes} error={errorComprasPendentes} data={comprasPendentes} onRetry={refetchComprasPendentes} value={comprasPendentes.length} subtitle="Solicitações abertas" icon={Truck} trend={comprasPendentes.length > 0 ? 'Atenção' : 'Em dia'} trendUp={comprasPendentes.length === 0} iconBg="bg-amber-500/10" iconColor="text-amber-600" />
    ),
    verQualquer('ESTOQUE_VIEW', 'COMPRAS_VIEW') && (
      <SafeStatCard key="materiais" title="Insumos" routePath="/Insumos" isLoading={loadingInsumos} error={errorInsumos} data={insumos} onRetry={refetchInsumos} value={insumos.length} subtitle="Cadastrados no sistema" icon={Database} trendUp={true} iconBg="bg-indigo-500/10" iconColor="text-indigo-600" />
    ),
    ver('LOGISTICA_VIEW') && (
      <SafeStatCard key="frota" title="Frota" routePath="/Ativos" isLoading={loadingVeiculos} error={errorVeiculos} data={veiculos} onRetry={refetchVeiculos} value={`${veiculosAtivos}/${veiculos.length}`} subtitle={`${veiculosManutencao} em manutenção`} icon={Truck} iconBg="bg-cyan-500/10" iconColor="text-cyan-600" />
    ),
    verQualquer('RH_VIEW', 'CADASTROS_VIEW') && (
      <SafeStatCard key="colab" title="Colaboradores" routePath="/Colaboradores" isLoading={loadingColaboradores} error={errorColaboradores} data={colaboradores} onRetry={refetchColaboradores} value={colaboradoresAtivos} subtitle="Ativos no sistema" icon={Users} iconBg="bg-purple-500/10" iconColor="text-purple-600" />
    ),
  ].filter(Boolean);

  // Itens do banner de status visíveis pela role.
  const bannerPendencias = [
    ver('OBRAS_VIEW') && obrasAtrasadas > 0 && `${obrasAtrasadas} obra(s) atrasada(s)`,
    ver('FINANCEIRO_VIEW') && contasAtrasadas > 0 && `${contasAtrasadas} conta(s) vencida(s)`,
    ver('LOGISTICA_VIEW') && veiculosManutencao > 0 && `${veiculosManutencao} veículo(s) em manutenção`,
  ].filter(Boolean);
  const bannerContadores = [
    ver('OBRAS_VIEW') && { label: 'Obras', value: obras.length },
    verQualquer('RH_VIEW', 'CADASTROS_VIEW') && { label: 'Colaboradores', value: colaboradoresAtivos },
    ver('LOGISTICA_VIEW') && { label: 'Veículos', value: veiculos.length },
  ].filter(Boolean);
  const semPendencias = bannerPendencias.length === 0;

  // Layout da grade principal e dos gráficos conforme o que a role pode ver.
  const temAtividades = ver('OBRAS_VIEW');
  const temLateral = ver('FINANCEIRO_VIEW') || ver('LOGISTICA_VIEW') || bannerPendencias.length > 0;
  const temGraficoObras = ver('OBRAS_VIEW');
  const temGraficoFin = ver('FINANCEIRO_VIEW');

  // Banner de status reutilizado (aparece em todos os layouts).
  const StatusBanner = (
    <div className="bg-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("p-2.5 rounded-xl", semPendencias ? "bg-emerald-100" : "bg-amber-100")}>
          {semPendencias ?
          <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
          <AlertTriangle className="w-5 h-5 text-amber-600" />}
        </div>
        <div>
          <p className={cn("text-sm font-semibold", semPendencias ? "text-emerald-700" : "text-amber-700")}>
            {semPendencias ? "Sistema saudável — Tudo em ordem!" : "Há pendências que precisam de atenção"}
          </p>
          <p className="text-gray-500 mt-0.5 text-xs">
            {bannerPendencias.join(' • ') || 'Nenhum alerta crítico'}
          </p>
        </div>
      </div>
      {bannerContadores.length > 0 && (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-center">
        {bannerContadores.map((item, i, arr) => (
          <div key={item.label} className="flex items-center gap-3">
            <div>
              <p className="text-gray-900 text-xl font-bold">{item.value}</p>
              <p className="text-gray-500 text-xs">{item.label}</p>
            </div>
            {i < arr.length - 1 && <div className="w-px h-7 bg-gray-200" />}
          </div>
        ))}
      </div>
      )}
    </div>
  );

  // Perfil RH / Dep. Pessoal: dashboard dedicado a Pessoas (sem obras/financeiro/estoque).
  const roleAtual = String(user?.role || user?.cargo || '').toLowerCase().trim();
  if (roleAtual === 'rh') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        {StatusBanner}
        <DashboardRH colaboradores={colaboradores} isLoading={loadingColaboradores} />
      </div>
    );
  }

  // Perfil ALMOXARIFE: fila de estoque (separar, trânsito, compras, falta) — sem os
  // KPIs de obra/colaboradores, que não são responsabilidade dele.
  if (roleAtual === 'almoxarife') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        {StatusBanner}
        <DashboardAlmoxarife />
      </div>
    );
  }

  // Perfil ENCARREGADO: o canteiro dele — ponto do dia, material a receber e diário.
  if (roleAtual === 'encarregado') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        {StatusBanner}
        <DashboardEncarregado />
      </div>
    );
  }

  // Perfil SUPERVISOR: andamento das obras — avanço, medição e diário.
  if (roleAtual === 'supervisor') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        {StatusBanner}
        <DashboardSupervisor />
      </div>
    );
  }

  // Perfil OPERACIONAL: campo — obras dele e o diário do dia.
  if (roleAtual === 'operacional') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        {StatusBanner}
        <DashboardOperacional />
      </div>
    );
  }

  // Perfil MOTORISTA: a viagem de agora e as próximas entregas.
  if (roleAtual === 'motorista') {
    return (
      <div className="space-y-6 pb-8 overflow-x-hidden">
        <DashboardMotorista />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 overflow-x-hidden">


      {/* Banner de Status Geral */}
      <div className="bg-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-gray-200 shadow-sm">



        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", semPendencias ? "bg-emerald-100" : "bg-amber-100")}>
            {semPendencias ?
            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
            <AlertTriangle className="w-5 h-5 text-amber-600" />}
          </div>
          <div>
            <p className={cn("text-sm font-semibold", semPendencias ? "text-emerald-700" : "text-amber-700")}>
              {semPendencias ? "Sistema saudável — Tudo em ordem!" : "Há pendências que precisam de atenção"}
            </p>
            <p className="text-gray-500 mt-0.5 text-xs">
              {bannerPendencias.join(' • ') || 'Nenhum alerta crítico'}
            </p>
          </div>
        </div>
        {bannerContadores.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-center">
          {bannerContadores.map((item, i, arr) => (
            <div key={item.label} className="flex items-center gap-3">
              <div>
                <p className="text-gray-900 text-xl font-bold">{item.value}</p>
                <p className="text-gray-500 text-xs">{item.label}</p>
              </div>
              {i < arr.length - 1 && <div className="w-px h-7 bg-gray-200" />}
            </div>
          ))}
        </div>
        )}
      </div>

      {/* KPIs — grade única adaptativa (só os que a role pode ver) */}
      {kpis.length > 0 && (
        <div className={cn('grid gap-4', gridCols(kpis.length))}>
          {kpis}
        </div>
      )}

      {/* Aprovações Pendentes */}
      <AprovacoesPendentesWidget />

      {/* Atalhos Rápidos */}
      <ShortcutsCard />

      {/* Grid Principal: Atividades + Lateral */}
      {(temAtividades || temLateral) && (
      <div className={cn('grid grid-cols-1 gap-6', temAtividades && temLateral && 'lg:grid-cols-3')}>

        {/* Atividades Recentes */}
        {temAtividades && (
        <div className={cn('bg-white p-6 rounded-xl border border-gray-200 shadow-sm', temLateral && 'lg:col-span-2')}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-gray-900 text-base font-semibold">Atividades Recentes</h3>
            <button onClick={() => navigate('/Auditoria')} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              Ver tudo <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {atividadesRecentes.slice(0, 8).map((atividade) => {
              const statusMap = {
                'em_andamento': { label: 'Em andamento', color: 'bg-blue-100 text-blue-700' },
                'aguardando': { label: 'Aguardando', color: 'bg-amber-100 text-amber-700' },
                'aguardando_aprovacao': { label: 'Ag. Aprovação', color: 'bg-orange-100 text-orange-700' },
                'aprovada': { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700' },
                'concluida': { label: 'Concluída', color: 'bg-gray-100 text-gray-700' },
                'finalizado': { label: 'Finalizado', color: 'bg-gray-100 text-gray-700' },
                'rascunho': { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
                'criada': { label: 'Criada', color: 'bg-blue-100 text-blue-700' }
              };
              const tConfig = tipoAtividade[atividade.tipo] || { icon: Clock, color: 'bg-gray-100 text-gray-500' };
              const TipoIcon = tConfig.icon;
              const status = statusMap[atividade.status] || { label: atividade.status, color: 'bg-gray-100 text-gray-600' };
              const diffMs = new Date() - new Date(atividade.data);
              const diffHrs = Math.floor(diffMs / 3600000);
              const diffDias = Math.floor(diffMs / 86400000);
              const tempoRelativo = diffHrs < 1 ? 'Agora' : diffHrs < 24 ? `${diffHrs}h` : diffDias === 1 ? 'Ontem' : `${diffDias}d`;

              return (
                <div
                  key={`${atividade.tipo}-${atividade.id}`}
                  onClick={() => navigate(atividade.link || `/${atividade.page}?id=${atividade.id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group">

                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", tConfig.color)}>
                    <TipoIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900 text-sm font-medium truncate group-hover:text-blue-600 transition-colors">{atividade.titulo}</p>
                    <p className="text-gray-500 text-xs truncate">{atividade.subtitulo}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full hidden sm:inline", status.color)}>{status.label}</span>
                    <span className="text-xs text-gray-400 w-10 text-right">{tempoRelativo}</span>
                  </div>
                </div>);

            })}
            {atividadesRecentes.length === 0 &&
            <div className="text-center py-10 text-gray-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma atividade recente</p>
              </div>
            }
          </div>
        </div>
        )}

        {/* Coluna Lateral */}
        {temLateral && (
        <div className="space-y-5">

          {/* Alertas Críticos */}
          {((ver('OBRAS_VIEW') && obrasAtrasadas > 0) || (ver('LOGISTICA_VIEW') && veiculosManutencao > 0) || (ver('FINANCEIRO_VIEW') && contasAtrasadas > 0)) &&
          <div className="bg-white border border-red-100 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas Críticos
              </h3>
              <div className="space-y-2">
                {ver('OBRAS_VIEW') && obrasAtrasadas > 0 &&
              <div onClick={() => navigate('/Obras')} className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-red-500" /><span className="text-sm text-red-700">Obras atrasadas</span></div>
                    <span className="font-bold text-red-600">{obrasAtrasadas}</span>
                  </div>
              }
                {ver('FINANCEIRO_VIEW') && contasAtrasadas > 0 &&
              <div onClick={() => navigate('/ContasPagar')} className="flex items-center justify-between p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors">
                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-red-500" /><span className="text-sm text-red-700">Contas vencidas</span></div>
                    <span className="font-bold text-red-600">{contasAtrasadas}</span>
                  </div>
              }
                {ver('LOGISTICA_VIEW') && veiculosManutencao > 0 &&
              <div onClick={() => navigate('/Ativos')} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors">
                    <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-amber-500" /><span className="text-sm text-amber-700">Veíc. manutenção</span></div>
                    <span className="font-bold text-amber-600">{veiculosManutencao}</span>
                  </div>
              }
              </div>
            </div>
          }

          {/* Próximos Vencimentos */}
          {ver('FINANCEIRO_VIEW') && (
          <div className="bg-white p-5 rounded-sm border border-gray-200 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-500" /> Próximos Vencimentos
            </h3>
            <div className="space-y-2">
              {contasVencer.slice(0, 5).map((conta) => {
                const dias = Math.ceil((new Date(conta.data_vencimento) - new Date()) / 86400000);
                return (
                  <div key={conta.id} onClick={() => navigate('/Financeiro')} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full flex-shrink-0", conta.tipo === 'pagar' ? "bg-red-400" : "bg-emerald-400")} />
                      <span className="text-sm text-gray-700 truncate">{conta.descricao || conta.fornecedor_cliente || 'Conta'}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-xs font-semibold text-gray-800">{conta.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 0 })}</p>
                      <p className={cn("text-xs", dias < 0 ? "text-red-500" : dias <= 3 ? "text-amber-500" : "text-gray-400")}>{dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d`}</p>
                    </div>
                  </div>);

              })}
              {contasVencer.length === 0 && <p className="text-sm text-gray-400 text-center py-3">Nenhum vencimento próximo</p>}
              {contasVencer.length > 5 && <button onClick={() => navigate('/ContasPagar')} className="w-full text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">Ver todos ({contasVencer.length}) →</button>}
            </div>
          </div>
          )}

          {/* Frota resumida */}
          {ver('LOGISTICA_VIEW') && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2"><Truck className="w-4 h-4 text-cyan-500" /> Frota</h3>
              <button onClick={() => navigate('/Ativos')} className="text-xs text-blue-600 hover:text-blue-700">Ver →</button>
            </div>
            <div className="space-y-2.5">
              {[{ label: 'Ativos', value: veiculosAtivos, color: 'bg-emerald-500' }, { label: 'Manutenção', value: veiculosManutencao, color: 'bg-amber-500' }, { label: 'Inativos', value: veiculosInativos, color: 'bg-gray-400' }].map((item) =>
              <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{item.label}</span>
                    <span className="font-medium text-gray-800">{item.value}/{veiculos.length}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", item.color)} style={{ width: `${veiculos.length > 0 ? item.value / veiculos.length * 100 : 0}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>
        )}
      </div>
      )}

      {/* Gráficos */}
      {(temGraficoObras || temGraficoFin) && (
      <div className={cn('grid grid-cols-1 gap-6', temGraficoObras && temGraficoFin && 'lg:grid-cols-2')}>
        {ver('OBRAS_VIEW') && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Orçado vs Realizado</h3>
          <div className="h-64 min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orcadoVsRealizado}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="nome" stroke="#9CA3AF" fontSize={11} />
                <YAxis stroke="#9CA3AF" fontSize={11} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} formatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Bar dataKey="orcado" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Orçado" />
                <Bar dataKey="realizado" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Realizado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}
        {ver('FINANCEIRO_VIEW') && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-5">Fluxo de Caixa</h3>
          <div className="h-64 min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxoCaixa}>
                <defs>
                  <linearGradient id="gReceitas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDespesas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} formatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Area type="monotone" dataKey="receitas" stroke="#10B981" fill="url(#gReceitas)" strokeWidth={2} name="Receitas" />
                <Area type="monotone" dataKey="despesas" stroke="#EF4444" fill="url(#gDespesas)" strokeWidth={2} name="Despesas" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Obras em Andamento */}
      {ver('OBRAS_VIEW') && (
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">Obras em Andamento</h3>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{obrasEmAndamento} ativas</Badge>
            <button onClick={() => navigate('/Obras')} className="text-sm text-blue-600 hover:text-blue-700">Ver todas →</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {obrasFiltradas.filter((o) => o.status === 'em_andamento').slice(0, 6).map((obra) =>
          <ObraCard key={obra.id} obra={obra} />
          )}
          {obrasFiltradas.filter((o) => o.status === 'em_andamento').length === 0 &&
          <div className="text-center py-8 text-gray-400 col-span-full">Nenhuma obra em andamento</div>
          }
        </div>
      </div>
      )}

      {/* Alertas Integrados */}
      {verQualquer('OBRAS_VIEW', 'FINANCEIRO_VIEW') && (
      <AlertasIntegrados
        solicitacoesPendentes={[]}
        medicoesAguardando={[]}
        contasVencendo={contasVencer}
        estoqueBaixo={[]}
        obrasCriticas={obrasFiltradas.filter((o) => o.valor_realizado > o.valor_orcado * 1.1)} />
      )}

      {ver('FINANCEIRO_VIEW') && <ProximosRecebimentos diasAntecedencia={30} />}
    </div>);

}