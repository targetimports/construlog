import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import {
  Search, FileText, CheckCircle2, Clock, XCircle, Eye, Pencil, Trash2,
  Upload, MoreVertical, Loader2, Award,
  List, BarChart3, LineChart, Filter, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Versão compacta p/ mobile: R$ 1,2 mi
const fmtBRLcompact = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });

const statusConfig = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700', icon: FileText },
  em_analise: { label: 'Em Análise', color: 'bg-blue-100 text-blue-700', icon: Clock },
  aprovado: { label: 'Aprovado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', color: 'bg-red-100 text-red-700', icon: XCircle },
  vigente: { label: 'Vigente', color: 'bg-amber-100 text-amber-700', icon: CheckCircle2 },
};

export default function Orcamentos() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [obraFiltro, setObraFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [excluindo, setExcluindo] = useState(null);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamentos'],
    queryFn: () => base44.entities.Orcamento.list('-created_date', 1000),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000),
  });
  const obraMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o])), [obras]);

  const { data: itensOrcamento = [] } = useQuery({
    queryKey: ['itens-orcamento-todos'],
    queryFn: () => base44.entities.ItemOrcamento.list('-created_date', 10000).catch(() => []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Orcamento.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orcamentos'] });
      toast.success('Orçamento excluído com sucesso!');
      setExcluindo(null);
    },
    onError: (e) => toast.error('Erro ao excluir: ' + e.message),
  });

  const filteredOrcamentos = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return orcamentos.filter((orc) => {
      const obra = obraMap[orc.obra_id];
      const matchSearch = !q
        || orc.descricao?.toLowerCase().includes(q)
        || orc.titulo?.toLowerCase().includes(q)
        || orc.versao?.toLowerCase().includes(q)
        || obra?.nome?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'todos' || orc.status === statusFilter;
      const matchObra = !obraFiltro || orc.obra_id === obraFiltro;
      let matchData = true;
      if (dataInicio && orc.created_date) matchData = matchData && new Date(orc.created_date) >= new Date(dataInicio);
      if (dataFim && orc.created_date) matchData = matchData && new Date(orc.created_date) <= new Date(dataFim + 'T23:59:59');
      return matchSearch && matchStatus && matchObra && matchData;
    });
  }, [orcamentos, obraMap, searchTerm, statusFilter, obraFiltro, dataInicio, dataFim]);

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filteredOrcamentos, 15);
  const resetPagina = () => goToPage(1);

  const limparFiltros = () => { setSearchTerm(''); setStatusFilter('todos'); setObraFiltro(''); setDataInicio(''); setDataFim(''); resetPagina(); };
  const temFiltro = searchTerm || statusFilter !== 'todos' || obraFiltro || dataInicio || dataFim;
  const qtdFiltrosAtivos = [searchTerm, statusFilter !== 'todos', obraFiltro, dataInicio, dataFim].filter(Boolean).length;

  // ── Aba Analítico (itens reais de orçamento) ──
  const [analObra, setAnalObra] = useState('');
  const [analBusca, setAnalBusca] = useState('');

  const itensAnalitico = useMemo(() => {
    const q = analBusca.toLowerCase();
    return itensOrcamento.filter((it) => {
      const matchObra = !analObra || it.obra_id === analObra;
      const matchBusca = !q || it.descricao?.toLowerCase().includes(q);
      return matchObra && matchBusca;
    });
  }, [itensOrcamento, analObra, analBusca]);

  const analTotais = useMemo(() => {
    const valor = itensAnalitico.reduce((s, it) => s + num(it.valor_total ?? it.valor_unitario * it.quantidade), 0);
    // Margem só sobre o que tem os dois lados. Item cujo custo é igual à venda
    // (ou ausente) tem custo DESCONHECIDO, não margem zero: entrar na conta com
    // custo zero daria 100% de lucro, e com custo = venda daria 0%. Nenhum dos
    // dois é verdade, então esse item fica fora e a cobertura denuncia quantos são.
    const comCusto = itensAnalitico.filter((it) => {
      const c = num(it.custo_total ?? it.custo_unitario * it.quantidade);
      const v = num(it.valor_total ?? it.valor_unitario * it.quantidade);
      return c > 0 && v > 0 && c < v * 0.9999;
    });
    const custo = comCusto.reduce((s, it) => s + num(it.custo_total ?? it.custo_unitario * it.quantidade), 0);
    const valorComCusto = comCusto.reduce((s, it) => s + num(it.valor_total ?? it.valor_unitario * it.quantidade), 0);
    const margem = valorComCusto > 0 ? ((valorComCusto - custo) / valorComCusto) * 100 : null;
    const cobertura = valor > 0 ? (valorComCusto / valor) * 100 : 0;
    return { custo, valor, margem, cobertura, qtd: itensAnalitico.length, qtdComCusto: comCusto.length };
  }, [itensAnalitico]);

  const {
    paginatedItems: analPage,
    currentPage: analCurrentPage,
    totalPages: analTotalPages,
    goToPage: analGoToPage,
    startIndex: analStartIndex,
    endIndex: analEndIndex,
    totalItems: analTotalItems,
  } = usePagination(itensAnalitico, 15);

  // Margem PLANEJADA por obra: (proposta - custo) / proposta.
  // proposta = valor_proposta do orçamento; se ausente, usa custo + margem%; senão, o próprio custo (0%).
  const rankingMargens = obras.map((obra) => {
    const orcsObra = orcamentos.filter((o) => o.obra_id === obra.id);
    const custo = orcsObra.reduce((acc, o) => acc + num(o.valor_total), 0);
    const proposta = orcsObra.reduce((acc, o) => {
      const p = num(o.valor_proposta)
        || (num(o.valor_total) * (1 + (num(o.margem_lucro_percentual) || 0) / 100))
        || num(o.valor_total);
      return acc + p;
    }, 0);
    const margem = proposta > 0 ? ((proposta - custo) / proposta) * 100 : 0;
    return { obra: obra.nome, custo, proposta, margem };
  }).filter((r) => r.custo > 0 || r.proposta > 0).sort((a, b) => b.margem - a.margem).slice(0, 20);

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));

  // Menu de ações (Ver / Editar / Excluir) — reusado na tabela (desktop) e nos cards (mobile).
  const acoesMenu = (orcamento) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link to={createPageUrl(`OrcamentoDetalhes?id=${orcamento.id}`)} className="flex items-center gap-2"><Eye className="w-4 h-4" /> Ver</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={createPageUrl(`OrcamentoForm?id=${orcamento.id}`)} className="flex items-center gap-2"><Pencil className="w-4 h-4" /> Editar</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setExcluindo(orcamento)} className="text-red-600 focus:text-red-600">
          <Trash2 className="w-4 h-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral de Orçamentos"
        subtitle="Consolidado de orçamentos de todas as obras — análises, status e margens. (Para criar/editar, abra a obra na seção Orçamento.)"
        action={() => { window.location.href = createPageUrl('OrcamentoForm'); }}
        actionLabel="Novo Orçamento"
      />

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="mx-auto flex w-fit max-w-full overflow-x-auto gap-1 rounded-lg bg-gray-100 p-1 h-auto">
          {[['lista', 'Lista', List], ['analitico', 'Analítico', BarChart3], ['sintetico', 'Sintético', LineChart], ['margens', 'Margens', Award]].map(([v, label, Icon]) => (
            <TabsTrigger
              key={v}
              value={v}
              className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2 rounded-md px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
            >
              <Icon className="w-4 h-4 flex-shrink-0" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ───────── LISTA ───────── */}
        <TabsContent value="lista" className="space-y-4 mt-6">
          {/* Filtros */}
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-4 sm:pt-6">
              {/* Cabeçalho clicável — expande/recolhe; "Importar" fica sempre visível */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setFiltrosAbertos((v) => !v)}
                  aria-expanded={filtrosAbertos}
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                >
                  <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  <h3 className="font-semibold text-gray-900">Filtros</h3>
                  {qtdFiltrosAtivos > 0 && (
                    <span className="text-xs font-semibold bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 flex-shrink-0">{qtdFiltrosAtivos}</span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-300 flex-shrink-0 ${filtrosAbertos ? 'rotate-180' : ''}`} />
                </button>
                <Button asChild variant="outline" size="sm" className="gap-2 border-gray-300 text-gray-700 flex-shrink-0">
                  <Link to={createPageUrl('ImportarOrcaFacil')}><Upload className="w-4 h-4" /> <span className="hidden sm:inline">Importar OrçaFascio</span><span className="sm:hidden">Importar</span></Link>
                </Button>
              </div>

              {/* Conteúdo — anima a altura (grid-rows 0fr → 1fr) */}
              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${filtrosAbertos ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-4">
                    <div className="md:col-span-4">
                      <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input placeholder="Obra, título, versão..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); resetPagina(); }} className="pl-10 h-11" />
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                      <ComboboxBusca options={obraOptions} value={obraFiltro} onSelect={(v) => { setObraFiltro(v); resetPagina(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                      <ComboboxBusca
                        options={[
                          { value: 'rascunho', label: 'Rascunho' },
                          { value: 'em_analise', label: 'Em Análise' },
                          { value: 'aprovado', label: 'Aprovado' },
                          { value: 'vigente', label: 'Vigente' },
                          { value: 'rejeitado', label: 'Rejeitado' },
                        ]}
                        value={statusFilter === 'todos' ? '' : statusFilter}
                        onSelect={(v) => { setStatusFilter(v || 'todos'); resetPagina(); }}
                        placeholder="Todos"
                        searchPlaceholder="Buscar status..."
                      />
                    </div>
                    <div className="md:col-span-3 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">De</Label>
                        <Input type="date" value={dataInicio} onChange={(e) => { setDataInicio(e.target.value); resetPagina(); }} className="h-11 text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600 mb-1 block">Até</Label>
                        <Input type="date" value={dataFim} onChange={(e) => { setDataFim(e.target.value); resetPagina(); }} className="h-11 text-xs" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-xs text-gray-500">{filteredOrcamentos.length} orçamento(s)</span>
                    {temFiltro && <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-700" onClick={limparFiltros}>Limpar filtros</Button>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela */}
          {isLoading ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <TableSkeleton bare rows={6} cols={8} />
            </div>
          ) : filteredOrcamentos.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum orçamento encontrado</h3>
              <p className="text-gray-500">{temFiltro ? 'Tente ajustar os filtros.' : 'Crie um orçamento dentro de uma obra (seção Orçamento) ou importe.'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Desktop: tabela */}
              <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto bg-white">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Código</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Obra</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left font-semibold text-gray-700">Cliente</th>
                      <th className="hidden md:table-cell px-4 py-3 text-left font-semibold text-gray-700">Status Obra</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                      <th className="hidden lg:table-cell px-4 py-3 text-center font-semibold text-gray-700">Importado</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Valor</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pageItens.map((orcamento) => {
                      const status = statusConfig[orcamento.status] || statusConfig.rascunho;
                      const obra = obraMap[orcamento.obra_id];
                      return (
                        <tr key={orcamento.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">{orcamento.numero || orcamento.id?.slice(0, 8) || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[130px] sm:max-w-xs truncate">{obra?.nome || '-'}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{obra?.cliente || '-'}</td>
                          <td className="hidden md:table-cell px-4 py-3"><Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-600 text-xs">{obra?.status || '-'}</Badge></td>
                          <td className="px-4 py-3"><Badge className={cn('border-0 text-xs', status.color)}>{status.label}</Badge></td>
                          <td className="hidden lg:table-cell px-4 py-3 text-center">{orcamento.importado && <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">✓</Badge>}</td>
                          <td className="px-4 py-3 text-gray-900 font-medium text-right tabular-nums">{fmtBRL(orcamento.valor_total)}</td>
                          <td className="px-2 py-3 text-center">
                            {acoesMenu(orcamento)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="md:hidden space-y-2">
                {pageItens.map((orcamento) => {
                  const status = statusConfig[orcamento.status] || statusConfig.rascunho;
                  const obra = obraMap[orcamento.obra_id];
                  return (
                    <div key={orcamento.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{orcamento.numero || orcamento.id?.slice(0, 8) || '-'}</span>
                            <Badge className={cn('border-0 text-xs', status.color)}>{status.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-800 truncate mt-0.5">{obra?.nome || '-'}</p>
                          {obra?.cliente && <p className="text-xs text-gray-500 truncate">{obra.cliente}</p>}
                        </div>
                        <div className="shrink-0">{acoesMenu(orcamento)}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        {obra?.status
                          ? <Badge variant="outline" className="bg-gray-50 border-gray-300 text-gray-600 text-xs">{obra.status}</Badge>
                          : <span />}
                        <span className="font-semibold text-gray-900 tabular-nums">{fmtBRL(orcamento.valor_total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </div>
          )}
        </TabsContent>

        {/* ───────── ANALÍTICO ───────── */}
        <TabsContent value="analitico" className="space-y-6 mt-6">
          {/* KPIs reais (itens de orçamento) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm font-semibold text-gray-600">Itens</div><div className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{analTotais.qtd}</div></CardContent></Card>
            <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm font-semibold text-gray-600">Custo Total</div><div className="text-xl sm:text-2xl font-bold text-blue-600 mt-2 tabular-nums leading-tight truncate"><span className="sm:hidden">{fmtBRLcompact(analTotais.custo)}</span><span className="hidden sm:inline">{fmtBRL(analTotais.custo)}</span></div></CardContent></Card>
            <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm font-semibold text-gray-600">Valor Total</div><div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-2 tabular-nums leading-tight truncate"><span className="sm:hidden">{fmtBRLcompact(analTotais.valor)}</span><span className="hidden sm:inline">{fmtBRL(analTotais.valor)}</span></div></CardContent></Card>
            <Card className="bg-white border-gray-200"><CardContent className="pt-6"><div className="text-sm font-semibold text-gray-600">Margem</div><div className={cn('text-2xl font-bold mt-2 tabular-nums', analTotais.margem == null ? 'text-gray-400' : analTotais.margem >= 0 ? 'text-green-600' : 'text-red-600')}>{analTotais.margem == null ? '—' : `${analTotais.margem.toFixed(1)}%`}</div>{analTotais.margem != null && analTotais.cobertura < 99.5 && <div className="text-[11px] text-amber-600 mt-1">sobre {analTotais.cobertura.toFixed(0)}% do valor ({analTotais.qtdComCusto} de {analTotais.qtd} itens)</div>}</CardContent></Card>
          </div>

          {/* Filtros */}
          <FiltrosColapsaveis
            ativos={[analObra, analBusca].filter(Boolean).length}
            onLimpar={() => { setAnalObra(''); setAnalBusca(''); analGoToPage(1); }}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                <ComboboxBusca options={obraOptions} value={analObra} onSelect={(v) => { setAnalObra(v); analGoToPage(1); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Pesquisar item</Label>
                <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input placeholder="Descrição do item..." value={analBusca} onChange={(e) => { setAnalBusca(e.target.value); analGoToPage(1); }} className="pl-10 h-11" /></div>
              </div>
            </div>
          </FiltrosColapsaveis>

          {/* Tabela de itens */}
          <Card className="bg-white border-gray-200">
            <CardHeader><CardTitle className="text-base">Itens de Orçamento ({itensAnalitico.length})</CardTitle></CardHeader>
            <CardContent>
              {itensAnalitico.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Nenhum item encontrado. Os itens aparecem aqui após criar/importar orçamentos com itens.</div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Obra</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-center hidden sm:table-cell">Un.</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Custo Unit.</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Valor Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {analPage.map((it) => (
                          <TableRow key={it.id} className="hover:bg-gray-50">
                            <TableCell className="text-gray-600 max-w-[110px] truncate">{obraMap[it.obra_id]?.nome || '—'}</TableCell>
                            <TableCell className="max-w-[150px] sm:max-w-md truncate">{it.descricao}</TableCell>
                            <TableCell className="text-center text-gray-600 hidden sm:table-cell">{it.unidade || '—'}</TableCell>
                            <TableCell className="text-right tabular-nums">{num(it.quantidade)}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-600 hidden lg:table-cell">{fmtBRL(it.custo_unitario)}</TableCell>
                            <TableCell className="text-right tabular-nums hidden md:table-cell">{fmtBRL(it.valor_unitario)}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{fmtBRL(it.valor_total ?? it.valor_unitario * it.quantidade)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Pagination currentPage={analCurrentPage} totalPages={analTotalPages} onPageChange={analGoToPage} startIndex={analStartIndex} endIndex={analEndIndex} totalItems={analTotalItems} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── SINTÉTICO ───────── */}
        <TabsContent value="sintetico" className="space-y-6 mt-6">
          <Card className="bg-white border-gray-200">
            <CardHeader><CardTitle className="text-base">Visão Sintética por Obra</CardTitle></CardHeader>
            <CardContent>
              {(() => {
                const linhas = obras
                  .map((obra) => {
                    const orcsObra = orcamentos.filter((o) => o.obra_id === obra.id);
                    const valorTotal = orcsObra.reduce((acc, o) => acc + num(o.valor_total), 0);
                    const valorAprovado = orcsObra.filter((o) => ['aprovado', 'vigente'].includes(o.status)).reduce((acc, o) => acc + num(o.valor_total), 0);
                    return { obra, qtd: orcsObra.length, valorTotal, valorAprovado };
                  })
                  .filter((l) => l.qtd > 0)
                  .sort((a, b) => b.valorTotal - a.valorTotal);
                const totalGeral = linhas.reduce((s, l) => s + l.valorTotal, 0);
                const aprovadoGeral = linhas.reduce((s, l) => s + l.valorAprovado, 0);
                if (linhas.length === 0) return <div className="text-center py-8 text-gray-500">Nenhuma obra com orçamento ainda.</div>;
                return (
                  <div className="space-y-3">
                    {linhas.map(({ obra, qtd, valorTotal, valorAprovado }) => (
                      <div key={obra.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                          <div className="min-w-0"><h3 className="font-semibold text-gray-900 truncate">{obra.nome}</h3><p className="text-sm text-gray-600">{qtd} orçamento(s)</p></div>
                          <div className="flex gap-4 sm:gap-6 text-right flex-shrink-0">
                            <div className="flex-1 sm:flex-none sm:w-36 min-w-0"><p className="text-xs text-gray-500">Aprovado/Vigente</p><p className="text-sm sm:text-base font-semibold text-emerald-600 tabular-nums truncate"><span className="sm:hidden">{fmtBRLcompact(valorAprovado)}</span><span className="hidden sm:inline">{fmtBRL(valorAprovado)}</span></p></div>
                            <div className="flex-1 sm:flex-none sm:w-40 min-w-0"><p className="text-xs text-gray-500">Valor Total</p><p className="text-lg sm:text-xl font-bold text-blue-600 tabular-nums truncate"><span className="sm:hidden">{fmtBRLcompact(valorTotal)}</span><span className="hidden sm:inline">{fmtBRL(valorTotal)}</span></p></div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
                      <h3 className="font-bold text-gray-900">Total Geral</h3>
                      <div className="flex gap-4 sm:gap-6 text-right">
                        <div className="flex-1 sm:flex-none sm:w-36 min-w-0"><p className="text-xs text-gray-500">Aprovado/Vigente</p><p className="text-sm sm:text-base font-bold text-emerald-600 tabular-nums truncate"><span className="sm:hidden">{fmtBRLcompact(aprovadoGeral)}</span><span className="hidden sm:inline">{fmtBRL(aprovadoGeral)}</span></p></div>
                        <div className="flex-1 sm:flex-none sm:w-40 min-w-0"><p className="text-xs text-gray-500">Valor Total</p><p className="text-lg sm:text-xl font-bold text-blue-600 tabular-nums truncate"><span className="sm:hidden">{fmtBRLcompact(totalGeral)}</span><span className="hidden sm:inline">{fmtBRL(totalGeral)}</span></p></div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───────── MARGENS ───────── */}
        <TabsContent value="margens" className="space-y-6 mt-6">
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Award className="w-5 h-5 text-amber-500" /> Ranking de Margens por Obra</CardTitle>
              <p className="text-xs text-gray-500 mt-1">Margem planejada = (Proposta − Custo) ÷ Proposta, somando os orçamentos de cada obra.</p>
            </CardHeader>
            <CardContent>
              {rankingMargens.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Sem dados de margens ainda — crie orçamentos com valores.</div>
              ) : (
                <div className="space-y-3">
                  {rankingMargens.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-gray-100 text-gray-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-600')}>{idx + 1}</div>
                          <div className="min-w-0"><h3 className="font-semibold text-gray-900 truncate">{item.obra}</h3><p className="text-xs text-gray-500 truncate">Custo {fmtBRL(item.custo)} · Proposta {fmtBRL(item.proposta)}</p></div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={cn('text-2xl font-bold', item.margem >= 15 ? 'text-green-600' : item.margem >= 8 ? 'text-blue-600' : item.margem > 0 ? 'text-amber-600' : 'text-gray-500')}>{item.margem.toFixed(1)}%</p>
                          <p className="text-xs text-gray-500">Margem</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      {/* Confirmação de exclusão */}
      <Dialog open={!!excluindo} onOpenChange={() => setExcluindo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir orçamento</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Tem certeza que deseja excluir o orçamento <strong>{excluindo?.numero || excluindo?.titulo || excluindo?.id?.slice(0, 8)}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => deleteMutation.mutate(excluindo.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2">
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
