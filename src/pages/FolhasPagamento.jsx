import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, AlertCircle, CheckCircle2, Clock, ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import DetalheFolhaModal from '@/components/rh/DetalheFolhaModal';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { TableSkeleton } from '@/components/shared/Skeletons';

/**
 * FolhasPagamento - Geração de folha de pagamento mensal
 * Integra automaticamente com Gastos/ContaFinanceira
 */
export default function FolhasPagamento() {
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState(''); // '' = todas as empresas
  const [confirmarGeracao, setConfirmarGeracao] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [folhaParaVisualizar, setFolhaParaVisualizar] = useState(null);
  const [detalheAberto, setDetalheAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const queryClient = useQueryClient();
  const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // Gerar lista de competências (últimos 12 meses + próximos 3)
  const gerarCompetencias = () => {
    const competencias = [];
    const now = new Date();
    for (let i = 12; i >= -3; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      competencias.push(`${year}-${month}`);
    }
    return competencias;
  };

  // Buscar folhas geradas
  const { data: folhas = [], isLoading: loadingFolhas } = useQuery({
    queryKey: ['folhas-pagamento'],
    queryFn: () => base44.entities.FolhaPagamento.list('-created_date', 100)
  });

  // Buscar colaboradores ativos
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores-ativos'],
    queryFn: () => base44.entities.Colaborador.filter({ status: 'ativo' }, '-created_date', 500)
  });

  // Empresas (para exibir a qual empresa cada folha pertence — a folha é gerada por empresa)
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-folha'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
    staleTime: 300000,
  });
  const empresaNome = (id) => (id ? (empresas.find((e) => e.id === id)?.nome || 'Empresa') : 'Matriz/Grupo');

  // Geração de folha
  const gerarFolhaMutation = useMutation({
    mutationFn: async ({ competencia, empresa_id }) => {
      const res = await base44.functions.invoke('gerarFolhaPagamento', { competencia, ...(empresa_id ? { empresa_id } : {}) });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['folhas-pagamento'] });
      const puladas = data?.puladas?.length ? ` (${data.puladas.length} empresa(s) já tinham folha)` : '';
      toast.success(`Folha ${competenciaSelecionada}: ${data.criadas} empresa(s), ${data.total_itens} colaboradores${puladas}`);
      // Quem mudou de empresa no meio do mês e já foi pago na folha da anterior fica
      // de fora — precisa aparecer, senão o RH acha que a folha saiu completa.
      if (data?.duplicados?.length) {
        for (const d of data.duplicados) {
          toast.warning(
            `${d.colaborador_nome} não entrou na folha de ${d.empresa_atual}: já consta na folha ${competenciaSelecionada} de ${d.ja_pago_em}.`,
            { duration: 10000 }
          );
        }
      }
      setCompetenciaSelecionada('');
      setEmpresaSelecionada('');
    },
    onError: (error) => {
      if (error.response?.status === 409) {
        // Mostra o motivo do backend (pode citar quem já foi pago em outra empresa).
        toast.error(error.response?.data?.message || error.detail?.message || 'Folha já existe para esta competência');
      } else {
        toast.error('Erro ao gerar folha: ' + error.message);
      }
    }
  });

  const handleGerarFolha = () => {
    if (!competenciaSelecionada) {
      toast.error('Selecione uma competência');
      return;
    }
    setConfirmarGeracao(true);
  };

  const confirmarEGerar = () => {
    setConfirmarGeracao(false);
    gerarFolhaMutation.mutate({ competencia: competenciaSelecionada, empresa_id: empresaSelecionada || null });
  };

  const handleVisualizarFolha = (folha) => {
    setFolhaParaVisualizar(folha);
    setDialogOpen(true);
  };

  const getStatusBadge = (status) => {
    const badges = {
      'gerada': 'bg-blue-100 text-blue-800',
      'processada': 'bg-green-100 text-green-800',
      'rascunho': 'bg-yellow-100 text-yellow-800',
      'cancelada': 'bg-red-100 text-red-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    if (status === 'processada') return <CheckCircle2 className="w-4 h-4" />;
    if (status === 'cancelada') return <AlertCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const folhasFiltradas = useMemo(() => {
    const q = busca.toLowerCase();
    return folhas.filter((f) => {
      const matchBusca = !q || (f.competencia || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'todos' || f.status === statusFilter;
      return matchBusca && matchStatus;
    });
  }, [folhas, busca, statusFilter]);

  const totalAcumulado = folhas.filter((f) => f.status !== 'cancelada').reduce((s, f) => s + (f.total || 0), 0);
  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(folhasFiltradas, 20);
  const ativos = (busca ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0);
  const limparFiltros = () => { setBusca(''); setStatusFilter('todos'); };
  const competencias = gerarCompetencias();

  // Competências que já têm folha ativa (não-cancelada) — para avisar/bloquear na UI
  const competenciasGeradas = useMemo(
    () => new Set(folhas.filter((f) => f.status !== 'cancelada').map((f) => f.competencia)),
    [folhas]
  );
  // Chaves (competência|empresa) já geradas — bloqueia só quando uma empresa específica
  // já tem folha. "Todas as empresas" nunca bloqueia (o backend cria as faltantes e pula as existentes).
  const folhasPorEmpresa = useMemo(
    () => new Set(folhas.filter((f) => f.status !== 'cancelada').map((f) => `${f.competencia}|${f.empresa_id || ''}`)),
    [folhas]
  );
  const jaGerada = !!(competenciaSelecionada && empresaSelecionada && folhasPorEmpresa.has(`${competenciaSelecionada}|${empresaSelecionada}`));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Folha de Pagamento"
        subtitle={`${folhas.length} folhas geradas`}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Folhas Geradas</div><div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{folhas.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Total Acumulado</div><div className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums truncate" title={fmtBRL(totalAcumulado)}>{fmtCompactBRL(totalAcumulado)}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Colaboradores Ativos</div><div className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{colaboradores.length}</div></CardContent></Card>
      </div>

      {/* GERAÇÃO DE FOLHA */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <h3 className="font-semibold text-gray-900 mb-3 sm:mb-1">Gerar Nova Folha</h3>
          <p className="hidden sm:block text-sm text-gray-500 mb-4">
            Selecione a competência (mês) e a empresa — ou deixe "Todas as empresas". É gerada uma folha e uma conta a pagar <strong>por empresa</strong>, com os colaboradores ativos de cada uma (remunerações, benefícios e encargos calculados automaticamente).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <Label className="text-xs text-gray-600 mb-1 block">Competência (YYYY-MM)</Label>
              <ComboboxBusca
                options={competencias.map((c) => ({ value: c, label: (!empresaSelecionada && competenciasGeradas.has(c)) ? `${c} — já gerada` : c }))}
                value={competenciaSelecionada}
                onSelect={(v) => setCompetenciaSelecionada(v)}
                placeholder="Selecione a competência"
                searchPlaceholder="Buscar competência..."
                emptyMessage="Sem competências."
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-gray-600 mb-1 block">Empresa</Label>
              <ComboboxBusca
                options={[{ value: '__todas', label: 'Todas as empresas' }, ...empresas.map((e) => ({ value: e.id, label: e.nome || e.id }))]}
                value={empresaSelecionada || '__todas'}
                onSelect={(v) => setEmpresaSelecionada(v === '__todas' ? '' : v)}
                placeholder="Todas as empresas"
                searchPlaceholder="Buscar empresa..."
                emptyMessage="Sem empresas."
              />
            </div>
            <Button onClick={handleGerarFolha} disabled={gerarFolhaMutation.isPending || !competenciaSelecionada || jaGerada} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 h-11">
              {gerarFolhaMutation.isPending ? 'Gerando...' : 'Gerar Folha'}
            </Button>
          </div>
          {jaGerada && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Já existe folha de <strong>{competenciaSelecionada}</strong> para <strong>{empresaNome(empresaSelecionada)}</strong>. Cancele a folha existente dessa empresa para gerar novamente.
            </div>
          )}
          {colaboradores.length === 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Nenhum colaborador ativo encontrado. Cadastre colaboradores em RH &gt; Colaboradores.
            </div>
          )}
        </CardContent>
      </Card>

      {/* FILTROS */}
      <FiltrosColapsaveis ativos={ativos} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{folhasFiltradas.length} folha(s)</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar competência</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Ex: 2025-06" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'gerada', label: 'Gerada' },
                { value: 'processada', label: 'Processada' },
                { value: 'rascunho', label: 'Rascunho' },
                { value: 'cancelada', label: 'Cancelada' },
              ]}
              value={statusFilter}
              onSelect={(v) => setStatusFilter(v || 'todos')}
              placeholder="Todos"
              searchPlaceholder="Buscar status..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* LISTA DE FOLHAS */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {loadingFolhas ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : folhasFiltradas.length === 0 ? (
            <p className="text-center py-12 text-gray-400">{folhas.length === 0 ? 'Nenhuma folha gerada ainda.' : 'Nenhuma folha encontrada.'}</p>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((folha) => (
                  <div key={folha.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{folha.competencia}</p>
                        <p className="text-xs text-gray-700 truncate">{empresaNome(folha.empresa_id)}</p>
                        <p className="text-xs text-gray-500">{folha.total_itens} colaboradores</p>
                      </div>
                      <Badge className={`border-0 capitalize inline-flex items-center gap-1 flex-shrink-0 ${getStatusBadge(folha.status)}`}>
                        {getStatusIcon(folha.status)}{folha.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 tabular-nums">{fmtBRL(folha.total)}</span>
                      <span className="text-xs text-gray-500">{folha.created_date ? new Date(folha.created_date).toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                    <div className="flex justify-end pt-1 border-t border-gray-100">
                      <Button variant="ghost" size="sm" onClick={() => handleVisualizarFolha(folha)} className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                        <FileText className="w-4 h-4 mr-1" /> Visualizar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Competência</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Empresa</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaboradores</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Total</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((folha) => (
                      <tr key={folha.id} className="hover:bg-gray-50">
                        <td className="p-3 font-semibold text-gray-900">{folha.competencia}</td>
                        <td className="p-3 text-gray-600">{empresaNome(folha.empresa_id)}</td>
                        <td className="p-3 text-gray-600">{folha.total_itens} colaboradores</td>
                        <td className="p-3 text-right font-medium text-gray-900 tabular-nums">{fmtBRL(folha.total)}</td>
                        <td className="p-3">
                          <Badge className={`border-0 capitalize inline-flex items-center gap-1 ${getStatusBadge(folha.status)}`}>
                            {getStatusIcon(folha.status)}{folha.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-gray-600">{folha.created_date ? new Date(folha.created_date).toLocaleDateString('pt-BR') : '—'}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleVisualizarFolha(folha)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            <FileText className="w-4 h-4 mr-1" /> Visualizar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      {/* DIALOG: CONFIRMAR GERAÇÃO */}
      <Dialog open={confirmarGeracao} onOpenChange={setConfirmarGeracao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-blue-600" /> Gerar folha de {competenciaSelecionada} — {empresaSelecionada ? empresaNome(empresaSelecionada) : 'todas as empresas'}?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-gray-600 space-y-2">
            <p>Esta operação vai:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Incluir os <strong>{(empresaSelecionada ? colaboradores.filter((c) => c.empresa_id === empresaSelecionada).length : colaboradores.length)} colaboradores ativos</strong> {empresaSelecionada ? 'dessa empresa' : '(de todas as empresas)'} com salário, benefícios e encargos calculados.</li>
              <li>Lançar automaticamente uma <strong>conta a pagar</strong> no Financeiro com o total da folha.</li>
            </ul>
            <p className="text-gray-500">Você poderá visualizar os itens depois. A folha não pode ser duplicada para a mesma competência.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarGeracao(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={confirmarEGerar} disabled={gerarFolhaMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {gerarFolhaMutation.isPending ? 'Gerando...' : 'Confirmar e gerar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: VISUALIZAR FOLHA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3 pr-6 flex-wrap">
              <span>Folha {folhaParaVisualizar?.competencia} - Itens</span>
              <Button size="sm" variant="outline" onClick={() => setDetalheAberto(true)} className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50">
                <FileText className="w-4 h-4" /> Ver detalhado
              </Button>
            </DialogTitle>
          </DialogHeader>

          {folhaParaVisualizar && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-gray-600">Colaboradores</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{folhaParaVisualizar.total_itens}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Total da Folha</p>
                  <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(folhaParaVisualizar.total)}>{fmtCompactBRL(folhaParaVisualizar.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Status</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-900 capitalize">{folhaParaVisualizar.status}</p>
                </div>
              </div>

              {/* Lista de itens */}
              <ItemsFolha folhaId={folhaParaVisualizar.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: FOLHA DETALHADA (composição + horas por obra + PDF) */}
      <DetalheFolhaModal
        open={detalheAberto}
        onClose={() => setDetalheAberto(false)}
        folha={folhaParaVisualizar}
      />
    </div>
  );
}

// Sub-component: Lista de itens da folha
function ItemsFolha({ folhaId }) {
  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['folha-itens', folhaId],
    queryFn: () => base44.entities.FolhaPagamentoItem.filter({ folha_id: folhaId }, '-created_date', 500)
  });
  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
  });
  const nomePorId = React.useMemo(() => Object.fromEntries(colaboradores.map((c) => [c.id, c.nome])), [colaboradores]);

  // Detalhamento: horas por obra no mês. Fonte = Ponto/Presença (Equipe & Diário),
  // que grava no ApontamentoMaoObra. Só leitura — não altera a folha.
  const { data: detalheResp } = useQuery({
    queryKey: ['folha-detalhe', folhaId],
    queryFn: async () => (await base44.functions.invoke('getDetalheFolhaPagamento', { folha_id: folhaId })).data,
    enabled: !!folhaId,
  });
  const detalhes = detalheResp?.detalhes || {};
  const [expandido, setExpandido] = React.useState(null);

  const POR_PAGINA = 10;
  const [pagina, setPagina] = React.useState(1);
  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pageItens = itens.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);
  const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (isLoading) {
    return <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>;
  }
  if (itens.length === 0) {
    return <p className="text-center py-8 text-sm text-gray-400">Nenhum item nesta folha.</p>;
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left p-3 font-semibold text-gray-600">Colaborador</th>
              <th className="text-right p-3 font-semibold text-gray-600">Salário</th>
              <th className="text-right p-3 font-semibold text-gray-600">Bônus</th>
              <th className="text-right p-3 font-semibold text-gray-600">FGTS</th>
              <th className="text-right p-3 font-semibold text-gray-600">Benefícios</th>
              <th className="text-right p-3 font-semibold text-gray-600">Extras</th>
              <th className="text-right p-3 font-semibold text-gray-600">Horas</th>
              <th className="text-right p-3 font-semibold text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageItens.map((item) => {
              const det = detalhes[item.colaborador_id];
              const temDetalhe = det && det.obras?.length > 0;
              const aberto = expandido === item.id;
              return (
                <React.Fragment key={item.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {temDetalhe ? (
                          <button
                            onClick={() => setExpandido(aberto ? null : item.id)}
                            className="p-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                            title="Ver horas por obra"
                          >
                            {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        ) : <span className="w-5 inline-block" />}
                        {nomePorId[item.colaborador_id] || item.colaborador_id}
                      </div>
                    </td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{fmt(item.salario_base)}</td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{fmt(item.bonificacao)}</td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{fmt(item.fgts)}</td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{fmt(item.beneficios)}</td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{fmt(item.extras)}</td>
                    <td className="p-3 text-right text-gray-600 tabular-nums">{det?.horas_total > 0 ? `${fmt(det.horas_total)}h` : '—'}</td>
                    <td className="p-3 text-right font-semibold text-gray-900 tabular-nums">{fmt(item.total_item)}</td>
                  </tr>

                  {aberto && temDetalhe && (
                    <tr className="bg-gray-50/70">
                      <td colSpan={8} className="px-3 pb-3 pt-0">
                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-600">Horas por obra — fonte: Ponto/Presença (Equipe &amp; Diário)</span>
                            {det.custo_hora_real > 0 && (
                              <span className="text-xs text-gray-500">Custo real da hora: <b className="text-gray-700">R$ {fmt(det.custo_hora_real)}</b></span>
                            )}
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-white border-b border-gray-100">
                                <tr>
                                  <th className="text-left px-3 py-1.5 font-semibold text-gray-500">Obra</th>
                                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Dias</th>
                                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Horas normais</th>
                                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Horas extra</th>
                                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Total h</th>
                                  <th className="text-right px-3 py-1.5 font-semibold text-gray-500">Custo aplicado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {det.obras.map((o) => (
                                  <tr key={o.obra_id || 'sem-obra'}>
                                    <td className="px-3 py-1.5 text-gray-800">{o.obra_nome}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{o.dias}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{fmt(o.horas_normais)}</td>
                                    <td className="px-3 py-1.5 text-right text-gray-600 tabular-nums">{fmt(o.horas_extra)}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums">{fmt(o.horas_total)}</td>
                                    <td className="px-3 py-1.5 text-right font-medium text-gray-900 tabular-nums">R$ {fmt(o.valor_rateado)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
                            Custo aplicado = horas × custo real da hora (custo do mês ÷ horas úteis do mês{det.horas_uteis_mes ? ` = ${det.horas_uteis_mes}h` : ''}). Mensalista tem salário fixo — as horas não calculam o pagamento, mostram <b>onde o custo foi aplicado</b>.
                            {det.nao_alocado > 0 && <> Sem apontamento no mês: <b className="text-amber-700">R$ {fmt(det.nao_alocado)}</b>.</>}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-3 p-3 border-t border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500">Mostrando {(pagAtual - 1) * POR_PAGINA + 1}–{Math.min(pagAtual * POR_PAGINA, itens.length)} de {itens.length}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={pagAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
          <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
          <Button variant="outline" size="sm" disabled={pagAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>
  );
}