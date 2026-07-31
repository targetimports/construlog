import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  ArrowLeft,
  Edit,
  MapPin,
  Calendar,
  User,
  DollarSign,
  TrendingUp,
  ClipboardList,
  Package,
  Users,
  History,
  FileText,
  Camera } from
'lucide-react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger } from
'@/components/ui/tabs';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import KPIDashboard from '../components/obra/KPIDashboard';
import MarcosTimeline from '../components/obra/MarcosTimeline';
import AnexosSection from '../components/obra/AnexosSection';
import DashboardObraIntegrado from '../components/obra/DashboardObraIntegrado';
import PainelDocumentosObra from '../components/documentos/PainelDocumentosObra';
import ComprasDaObra from '../components/obra/ComprasDaObra';
import OperacoesObra from '../components/obra/OperacoesObra';
import MenuOperacoes from '../components/obra/MenuOperacoes';
import DiagnosticoObra from '../components/obra/DiagnosticoObra';
import ContratosObra from '../components/obra/ContratosObra';
import ContasReceberObra from '../components/conta-receber/ContasReceberObra';
import OrcamentoPlanejadoTab from '../components/obra/OrcamentoPlanejadoTab';
import CronogramaObraTab from '../components/obra/CronogramaObraTab';
import FinanceiroObraTab from '../components/obra/FinanceiroObraTab';
import GerenciadorDocumentosObra from '../components/obra/GerenciadorDocumentosObra';
import ObraDetalhesSidebar from '../components/obra/ObraDetalhesSidebar';
import SecaoOrcamento from '../components/obra/SecaoOrcamento';
import SecaoCronograma from '../components/obra/SecaoCronograma';
import SecaoFinanceiro from '../components/obra/SecaoFinanceiro';
import SecaoRelatorios from '../components/obra/SecaoRelatorios';
import SecaoDocumentos from '../components/obra/SecaoDocumentos';
import DiarioEquipePresenca from '../components/diario/DiarioEquipePresenca';
import RelatorioPresencaObra from '../components/diario/RelatorioPresencaObra';
import EquipeObraTab from '../components/obra/EquipeObraTab';
import DiarioObraTab from '../components/obra/DiarioObraTab';
import BannerPendenciasObra from '../components/obra/BannerPendenciasObra';
import SuprimentosObraCards from '../components/suprimentos/SuprimentosObraCards';
import { useObraDetailsData } from '../components/obra/useObraDetailsData';
import StatusMateriaisObra from '../components/obra/StatusMateriaisObra';
import MateriaisObraSection from '../components/obra/materiais/MateriaisObraSection';
import SecaoVisaoGeral from '../components/obra/SecaoVisaoGeral';
import CentroCustosObraTab from '../components/obra/CentroCustosObraTab';
import RecebimentosPrevistoTab from '../components/recebimentos/RecebimentosPrevistoTab';
import CustosPrevistoTab from '../components/financeiro/CustosPrevistoTab';
import CustoPorServicoTab from '../components/financeiro/CustoPorServicoTab';
import DesvioObraTab from '../components/financeiro/DesvioObraTab';
import ContratosObraTab from '../components/obra/ContratosObraTab';
import MedicoesObraTab from '../components/obra/MedicoesObraTab';
import EmprestimosAtivos from './EmprestimosAtivos';
import { podeEditarObra } from '@/lib/obraAccess';

const statusConfig = {
  planejamento: { label: 'Planejamento', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  em_andamento: { label: 'Em Andamento', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  pausada: { label: 'Pausada', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  concluida: { label: 'Concluída', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  cancelada: { label: 'Cancelada', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

// Compatibilidade com deep-links antigos (?secao=...): as seções que viraram
// abas internas redirecionam para o grupo certo já com a aba certa aberta.
const MAPA_SECOES_LEGADO = {
  contratos: { secao: 'orcamento', tab: 'contratos' },
  recebimentos: { secao: 'financeiro', tab: 'recebimentos' },
  custos_previstos: { secao: 'financeiro', tab: 'custos_previstos' },
  centro_custos: { secao: 'financeiro', tab: 'centro_custos' },
  compras: { secao: 'suprimentos', tab: 'compras' },
  materiais: { secao: 'suprimentos', tab: 'materiais' },
  saida_estoque: { secao: 'suprimentos', tab: 'materiais' },
  equipe: { secao: 'equipe_diario', tab: 'equipe' },
  diario: { secao: 'equipe_diario', tab: 'diario' },
  diario_equipe: { secao: 'equipe_diario', tab: 'presenca' },
  // Diárias foi absorvida pela Presença / Ponto (mesma entidade, uma porta só).
  mao_obra_diarias: { secao: 'equipe_diario', tab: 'presenca' },
};

export default function ObraDetalhes() {
  const [activeTab, setActiveTab] = useState('painel');
  const [operacaoSelecionada, setOperacaoSelecionada] = useState('resumo');
  const urlParams = new URLSearchParams(window.location.search);
  const obraId = urlParams.get('id') || urlParams.get('obraId');
  const secaoUrl = urlParams.get('secao');
  const legado = MAPA_SECOES_LEGADO[secaoUrl];
  const [secaoAtiva, setSecaoAtivaState] = useState(legado?.secao || secaoUrl || 'visao_geral');

  // A seção aberta vive na URL (?secao=...), não só no estado.
  //
  // Sem isso, sair para uma tela de fora (uma medição em /BMDetalhes, por
  // exemplo) e voltar devolvia o usuário à Visão Geral: o histórico guardava
  // /ObraDetalhes?id=X, sem memória de onde ele estava.
  //
  // replaceState em vez de push: trocar de seção é navegar DENTRO da obra, não
  // um passo de histórico — senão o botão Voltar viraria "desfaça cada clique
  // de aba" antes de finalmente sair da obra.
  const setSecaoAtiva = useCallback((secao) => {
    setSecaoAtivaState(secao);
    // A aba interna pertence à seção anterior; levá-la adiante confundiria.
    setSubTabState(null);
    const p = new URLSearchParams(window.location.search);
    if (secao && secao !== 'visao_geral') p.set('secao', secao);
    else p.delete('secao');
    p.delete('tab');
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, []);
  // Aba interna (Contas / Recebimentos / ...). Também mora na URL, pelo mesmo
  // motivo da seção: sair para outra tela e voltar tem de cair no mesmo lugar.
  const [subTab, setSubTabState] = useState(legado?.tab || urlParams.get('tab') || null);

  const setSubTab = useCallback((tab) => {
    setSubTabState(tab);
    const p = new URLSearchParams(window.location.search);
    if (tab) p.set('tab', tab); else p.delete('tab');
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, []);

  // Cada seção tem seu próprio conjunto de abas: se a URL trouxer uma aba que não
  // pertence a esta seção (deep-link antigo, ou troca de seção), cai no padrão.
  const abaAtual = useCallback(
    (validas, padrao) => (validas.includes(subTab) ? subTab : padrao),
    [subTab],
  );
  const [percentPreview, setPercentPreview] = useState(undefined);

  // Buscar % concluída real da última BM APROVADA (fallback se obra.percent_concluida_atual estiver desatualizado)
  const { data: ultimaBMAprovada } = useQuery({
    queryKey: ['ultima-bm-aprovada', obraId],
    queryFn: async () => {
      const bmsAprovadas = await base44.entities.BM.filter({ obra_id: obraId, status: 'APROVADA' });
      if (!bmsAprovadas?.length) return null;
      return bmsAprovadas.sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
    },
    enabled: !!obraId,
    staleTime: 30000,
  });

  // Buscar usuário para verificar se é admin
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Empresa do grupo responsável pela obra (deriva de obra.empresa_id).
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
    staleTime: 5 * 60 * 1000,
  });

  // Hook agregador principal — uma chamada para todos os dados essenciais
  const {
    obra: obraFromHook,
    resumoOrcamento,
    resumoCronograma,
    resumoFinanceiro,
    contagens,
    isLoading,
    isError,
    refetch: refetchObra
  } = useObraDetailsData(obraId);

  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-obra', obraId],
    queryFn: () => base44.entities.DiarioObra.filter({ obra_id: obraId }, '-data', 10),
    enabled: !!obraId
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-obra', obraId],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['historico-obra', obraId],
    queryFn: () => base44.entities.HistoricoObra.filter({ obra_id: obraId }, '-data_hora', 50),
    enabled: !!obraId
  });

  const { data: marcos = [] } = useQuery({
    queryKey: ['marcos-obra', obraId],
    queryFn: () => base44.entities.MarcoObra.filter({ obra_id: obraId }, 'data_prevista'),
    enabled: !!obraId
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos-obra', obraId],
    queryFn: () => base44.entities.AnexoObra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId
  });

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="space-y-4 w-full max-w-2xl px-8">
          <Skeleton className="h-10 w-64 bg-gray-200 rounded-lg" />
          <Skeleton className="h-4 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            <Skeleton className="h-32 bg-gray-200 rounded-xl" />
            <Skeleton className="h-32 bg-gray-200 rounded-xl" />
            <Skeleton className="h-32 bg-gray-200 rounded-xl" />
          </div>
          <Skeleton className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>);

  }

  if (isError) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center py-12">
          <p className="text-red-600 text-lg font-semibold mb-2">Erro ao carregar dados da obra</p>
          <p className="text-gray-500 text-sm mb-6">Não foi possível carregar os dados. Tente novamente.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => refetchObra()} className="bg-gray-900 hover:bg-gray-800 text-white">Recarregar</Button>
            <Link to={createPageUrl('Obras')}><Button variant="outline" className="border-gray-300 text-gray-700">Voltar para Obras</Button></Link>
          </div>
        </div>
      </div>);

  }

  const obra = obraFromHook;

  if (!obra) {
    return (
      <div className="flex h-screen bg-gray-50 items-center justify-center">
        <div className="text-center py-12">
          <p className="text-gray-700 text-lg font-semibold mb-2">Obra não encontrada</p>
          <p className="text-gray-500 text-sm mb-6">O ID "{obraId}" não corresponde a nenhuma obra.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => refetchObra()} variant="outline" className="border-gray-300 text-gray-700">Tentar novamente</Button>
            <Link to={createPageUrl('Obras')}><Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">Voltar para Obras</Button></Link>
          </div>
        </div>
      </div>);

  }

  const status = statusConfig[obra.status] || statusConfig.planejamento;
  const empresaResp = empresas.find((e) => e.id === obra.empresa_id);
  // Só responsáveis pela obra (ou Admin/TI/Financeiro) podem editar/solicitar.
  const podeEditar = podeEditarObra(user, obra);
  const percentConcluida = ultimaBMAprovada?.percent_concluida ?? obra.percent_concluida_atual ?? 0;
  const orcadoVsRealizado = obra.valor_orcado > 0 ?
  (obra.valor_realizado / obra.valor_orcado * 100).toFixed(1) :
  0;

  const totalReceitas = contas.
  filter((c) => c.tipo === 'receber').
  reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalDespesas = contas.
  filter((c) => c.tipo === 'pagar').
  reduce((acc, c) => acc + (c.valor || 0), 0);

  return (
    <div className="flex flex-col md:flex-row md:h-screen bg-gray-50 md:overflow-hidden">
      {/* Sidebar de Seções (desktop) */}
      <ObraDetalhesSidebar
        activeSecao={secaoAtiva}
        onSelectSecao={setSecaoAtiva}
      />

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col md:overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
                className="text-gray-500 hover:text-gray-900">

                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                   <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{obra.nome}</h1>
                   <Badge className={cn("border", status.color)}>{status.label}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                   <p className="text-gray-500">{obra.cliente}</p>
                   {empresaResp?.nome && (
                     <>
                       <span className="text-gray-300">|</span>
                       <span className="text-gray-400" title="Empresa responsável pela obra">{empresaResp.nome}</span>
                     </>
                   )}
                   <StatusMateriaisObra obra_id={obraId} />
                </div>
              </div>
            </div>
            {podeEditar && (
              <div className="flex gap-2 w-full sm:w-auto">
                <Link to={createPageUrl(`ObraForm?id=${obra.id}`)} className="w-full sm:w-auto">
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full sm:w-auto">
                    <Edit className="w-4 h-4" />
                    Editar Obra
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Progresso da obra — minimalista, logo abaixo do cabeçalho */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Progresso da obra</span>
              <span className="text-sm font-semibold text-gray-700">{percentConcluida.toFixed(1)}% concluída</span>
            </div>
            <Progress value={percentConcluida} className="h-2" />
          </div>
        </div>

        {/* Navegação de seções — mobile (barra horizontal rolável) */}
        <ObraDetalhesSidebar
          variant="mobile"
          activeSecao={secaoAtiva}
          onSelectSecao={setSecaoAtiva}
        />

        {/* Área de Conteúdo com Scroll */}
        <div className="flex-1 md:overflow-y-auto overflow-x-hidden bg-gray-50 p-3 sm:p-6">
          {/* Banner de pendências de completude */}
          <div className="mb-4">
            <BannerPendenciasObra
              obra={obra}
              dark={false}
              autoOpenIfPending={true}
              readOnly={user?.role !== 'admin' && user?.role !== 'programador' && user?.perfil_acesso !== 'engenharia' && user?.perfil_acesso !== 'gerente'}
              onSaved={() => {
                // Refetch direto da query desta obra específica
                refetchObra();
              }} />

          </div>

          {/* ── Visão Geral (resumo executivo) ─────────────────────────── */}
          {secaoAtiva === 'visao_geral' && (
            <SecaoVisaoGeral
              obra={obra}
              percentConcluida={percentConcluida}
              ultimaBM={ultimaBMAprovada}
              contas={contas}
              diarios={diarios}
              onNavigate={setSecaoAtiva}
            />
          )}

          {/* ── Orçamento & Contratos ──────────────────────────────────── */}
          {secaoAtiva === 'orcamento' && (
            <Tabs value={abaAtual(['orcamento', 'contratos'], 'orcamento')} onValueChange={setSubTab} className="space-y-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-2">
                <TabsTrigger value="orcamento">Orçamento</TabsTrigger>
                <TabsTrigger value="contratos">Contratos</TabsTrigger>
              </TabsList>
              <TabsContent value="orcamento">
                <SecaoOrcamento obraId={obraId} obra={obra} resumoOrcamento={resumoOrcamento} />
              </TabsContent>
              <TabsContent value="contratos">
                <ContratosObraTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
            </Tabs>
          )}

          {/* ── Cronograma / Medições (núcleo — intocados) ─────────────── */}
          {secaoAtiva === 'cronograma' && <SecaoCronograma obraId={obraId} obra={obra} resumoCronograma={resumoCronograma} podeEditar={podeEditar} />}
          {secaoAtiva === 'medicoes' && <MedicoesObraTab obraId={obraId} onSelectRascunho={setPercentPreview} podeEditar={podeEditar} />}

          {/* ── Financeiro (Contas · Recebimentos · Custos Previstos · Centro de Custos) ── */}
          {secaoAtiva === 'financeiro' && (
            <Tabs value={abaAtual(['contas', 'recebimentos', 'custos_previstos', 'custo_servico', 'desvios', 'centro_custos'], 'contas')} onValueChange={setSubTab} className="space-y-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-6">
                <TabsTrigger value="contas">Contas</TabsTrigger>
                <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
                <TabsTrigger value="custos_previstos">Custos Previstos</TabsTrigger>
                <TabsTrigger value="custo_servico">Custo por Serviço</TabsTrigger>
                <TabsTrigger value="desvios">Desvios</TabsTrigger>
                <TabsTrigger value="centro_custos">Centro de Custos</TabsTrigger>
              </TabsList>
              <TabsContent value="contas">
                <SecaoFinanceiro obraId={obraId} obra={obra} resumoFinanceiro={resumoFinanceiro} />
              </TabsContent>
              <TabsContent value="recebimentos">
                <RecebimentosPrevistoTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="custos_previstos">
                <CustosPrevistoTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="custo_servico">
                <CustoPorServicoTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="desvios">
                <DesvioObraTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="centro_custos">
                <CentroCustosObraTab obraId={obraId} />
              </TabsContent>
            </Tabs>
          )}

          {/* ── Suprimentos (Materiais · Compras) ──────────────────────── */}
          {secaoAtiva === 'suprimentos' && (
            <Tabs value={abaAtual(['materiais', 'compras'], 'materiais')} onValueChange={setSubTab} className="space-y-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-2">
                <TabsTrigger value="materiais">Materiais & Estoque</TabsTrigger>
                <TabsTrigger value="compras">Compras</TabsTrigger>
              </TabsList>
              <TabsContent value="materiais">
                <MateriaisObraSection obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="compras">
                <ComprasDaObra obraId={obraId} podeSolicitar={podeEditar} />
              </TabsContent>
            </Tabs>
          )}

          {/* ── Veículos & Ativos (empréstimo da frota da matriz) ──────── */}
          {secaoAtiva === 'ativos' && <EmprestimosAtivos obraId={obraId} embedded podeSolicitar={podeEditar} />}

          {/* ── Equipe & Diário (Diário · Presença · Diárias · Equipe) ─── */}
          {secaoAtiva === 'equipe_diario' && (
            <Tabs value={abaAtual(['diario', 'presenca', 'equipe'], 'diario')} onValueChange={setSubTab} className="space-y-4">
              <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
                <TabsTrigger value="diario">Diário (RDO)</TabsTrigger>
                <TabsTrigger value="presenca">Presença / Ponto</TabsTrigger>
                <TabsTrigger value="equipe">Equipe</TabsTrigger>
              </TabsList>
              <TabsContent value="diario">
                <DiarioObraTab obraId={obraId} user={user} podeEditar={podeEditar} />
              </TabsContent>
              <TabsContent value="presenca">
                <div className="space-y-6">
                  <DiarioEquipePresenca obraId={obraId} obraNome={obra?.nome} podeEditar={podeEditar} />
                  <hr className="my-6" />
                  <RelatorioPresencaObra obraId={obraId} />
                </div>
              </TabsContent>
              <TabsContent value="equipe">
                <EquipeObraTab obraId={obraId} podeEditar={podeEditar} />
              </TabsContent>
            </Tabs>
          )}

          {secaoAtiva === 'documentos' && <SecaoDocumentos obraId={obraId} obra={obra} user={user} />}
          {secaoAtiva === 'relatorios' && <SecaoRelatorios obraId={obraId} obra={obra} />}
        </div>
      </div>
    </div>);

}