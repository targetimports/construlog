import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Plus, Search, Eye, Clock, Send, CheckCircle, ArrowDownCircle, Ban, Filter, ChevronDown, ChevronUp, X, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import RequisicaoModal from '@/components/suprimentos/RequisicaoModal';
import AtenderRequisicaoModal from '@/components/obra/materiais/AtenderRequisicaoModal';
import { podeEditarObra } from '@/lib/obraAccess';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ATENDIVEL = (status) => status !== 'BAIXADA' && status !== 'CANCELADA';

const STATUS_CONFIG = {
  RASCUNHO:  { label: 'Rascunho',  icon: Clock,           cls: 'bg-gray-100 text-gray-600' },
  ENVIADA:   { label: 'Enviada',   icon: Send,            cls: 'bg-blue-100 text-blue-700' },
  APROVADA:  { label: 'Aprovada',  icon: CheckCircle,     cls: 'bg-yellow-100 text-yellow-700' },
  EM_TRANSITO: { label: 'Em trânsito', icon: Truck,       cls: 'bg-blue-100 text-blue-700' },
  BAIXADA:   { label: 'Recebida',  icon: ArrowDownCircle, cls: 'bg-green-100 text-green-700' },
  CANCELADA: { label: 'Cancelada', icon: Ban,             cls: 'bg-red-100 text-red-500' },
};

export default function SuprimentosRequisicoes() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroDe, setFiltroDe] = useState('');
  const [filtroAte, setFiltroAte] = useState('');
  const [modal, setModal] = useState({ open: false, requisicao: null });
  const [atenderReq, setAtenderReq] = useState(null);
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-obra'],
    queryFn: () => base44.entities.RequisicaoObra.list('-created_date', 1000),
  });
  const { data: user } = useQuery({ queryKey: ['me-req'], queryFn: () => base44.auth.me().catch(() => null) });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-req'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000).catch(() => []),
  });
  const obraObjMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o])), [obras]);

  // Itens de todas as requisições (para a coluna "Itens").
  const { data: todosItens = [] } = useQuery({
    queryKey: ['req-itens-todos'],
    queryFn: () => base44.entities.RequisicaoObraItem.list('-created_date', 3000).catch(() => []),
  });
  const itensPorReq = useMemo(() => {
    const m = {};
    for (const it of todosItens) (m[it.requisicao_id] ||= []).push(it);
    return m;
  }, [todosItens]);

  // Estoque Central + saldos (para o modal de atendimento validar disponibilidade).
  const { data: locaisCentral = [] } = useQuery({
    queryKey: ['locais-central-req'],
    queryFn: () => base44.entities.LocalEstoque.filter({ tipo: 'CENTRAL' }).catch(() => []),
    staleTime: 60000,
  });
  const centralId = locaisCentral[0]?.id;
  const { data: saldosCentral = [] } = useQuery({
    queryKey: ['saldos-central-req', centralId],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: centralId }),
    enabled: !!centralId,
    staleTime: 30000,
  });
  const saldoCentralMap = useMemo(() => {
    const m = {};
    for (const s of saldosCentral) m[s.material_id ?? s.insumo_id] = s.saldo_atual || 0;
    return m;
  }, [saldosCentral]);

  // Itens da requisição selecionada para atender.
  const { data: itensAtender = [] } = useQuery({
    queryKey: ['req-itens-atender', atenderReq?.id],
    queryFn: () => base44.entities.RequisicaoObraItem.filter({ requisicao_id: atenderReq.id }),
    enabled: !!atenderReq?.id,
  });

  const qc = useQueryClient();
  const gerivel = (r) => !!user && podeEditarObra(user, obraObjMap[r.obra_id]);
  const aprovarMut = useMutation({
    mutationFn: (r) => base44.entities.RequisicaoObra.update(r.id, { status: 'APROVADA', aprovado_por_user_id: user?.email, aprovado_em: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('requisic') }); toast.success('Requisição aprovada'); },
    onError: (e) => toast.error(e.response?.data?.error || e.message),
  });
  const { data: locais = [] } = useQuery({
    queryKey: ['locais-filtro-req'],
    queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []),
  });
  const obraMap = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);
  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l.nome])), [locais]);

  const filtered = useMemo(() => requisicoes.filter((r) => {
    const b = busca.toLowerCase();
    const nomeObra = (r.obra_nome || obraMap[r.obra_id] || '').toLowerCase();
    const matchBusca = !busca || nomeObra.includes(b) || r.local_estoque_nome?.toLowerCase().includes(b) || r.solicitante_nome?.toLowerCase().includes(b);
    const matchStatus = !filtroStatus || r.status === filtroStatus;
    const matchObra = !filtroObra || r.obra_id === filtroObra;
    const matchDe = !filtroDe || (r.data_requisicao && r.data_requisicao >= filtroDe);
    const matchAte = !filtroAte || (r.data_requisicao && r.data_requisicao <= filtroAte);
    return matchBusca && matchStatus && matchObra && matchDe && matchAte;
  }).sort((a, b) => {
    // Mais recém-criada no topo (a última requisição feita aparece primeiro).
    const dc = new Date(b.created_date || 0) - new Date(a.created_date || 0);
    if (dc !== 0) return dc;
    return new Date(b.data_requisicao || 0) - new Date(a.data_requisicao || 0);
  }), [requisicoes, busca, filtroStatus, filtroObra, filtroDe, filtroAte, obraMap]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const temFiltro = busca || filtroStatus || filtroObra || filtroDe || filtroAte;
  const qtdFiltros = [busca, filtroStatus, filtroObra, filtroDe, filtroAte].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); setFiltroDe(''); setFiltroAte(''); resetPagina(); };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          {/* "Consumo" descrevia a baixa de estoque; esta tela é o pedido da obra. */}
          <h1 className="text-2xl font-bold text-gray-900">Requisições de Material</h1>
          <p className="text-sm text-gray-500">
            Pedidos de material das obras · {requisicoes.length} registrada(s)
          </p>
        </div>
        <Button onClick={() => setModal({ open: true, requisicao: null })} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Nova Requisição
        </Button>
      </div>

      {/* Filtros (colapsáveis) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
              <Filter className="w-4 h-4" /> Filtros
              {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
              {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <span className="text-xs text-gray-500">{filtered.length} requisição(ões)</span>
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={limpar} className="gap-1 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFiltros && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className="pl-9 h-11" placeholder="Obra, local ou solicitante..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca options={obraOptions} value={filtroObra} onSelect={(v) => { setFiltroObra(v); resetPagina(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} value={filtroStatus} onSelect={(v) => { setFiltroStatus(v || ''); resetPagina(); }} placeholder="Todos status" searchPlaceholder="Buscar..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Data de</Label>
                  <Input type="date" className="h-11" value={filtroDe} onChange={(e) => { setFiltroDe(e.target.value); resetPagina(); }} />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Data até</Label>
                  <Input type="date" className="h-11" value={filtroAte} onChange={(e) => { setFiltroAte(e.target.value); resetPagina(); }} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Nenhuma requisição encontrada.</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={() => setModal({ open: true, requisicao: null })}>Criar primeira requisição</Button>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Obra</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Itens</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Solicitante</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map(r => {
                  const stCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.RASCUNHO;
                  const StatusIcon = stCfg.icon;
                  const itensReq = itensPorReq[r.id] || [];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {r.data_requisicao ? format(new Date(r.data_requisicao), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{r.obra_nome || obraMap[r.obra_id] || '—'}</td>
                      <td className="px-4 py-3">
                        {itensReq.length === 0 ? (
                          <span className="text-gray-300 text-xs">—</span>
                        ) : (
                          <div className="space-y-0.5 max-w-[260px]">
                            {itensReq.slice(0, 3).map((it) => (
                              <div key={it.id} className="text-xs text-gray-600 truncate">
                                {it.material_nome || 'Material'}
                                <span className="text-gray-400"> · {it.quantidade_solicitada} {it.material_unidade}</span>
                              </div>
                            ))}
                            {itensReq.length > 3 && <div className="text-xs text-gray-400">+{itensReq.length - 3} item(ns)</div>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{r.solicitante_nome || r.solicitante_user_id || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={`gap-1 border-0 ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {gerivel(r) && r.status === 'ENVIADA' && (
                          <Button variant="outline" size="sm" className="h-8 gap-1 mr-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            disabled={aprovarMut.isPending} onClick={() => aprovarMut.mutate(r)}>
                            <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                          </Button>
                        )}
                        {gerivel(r) && r.status === 'APROVADA' && (
                          <Button variant="outline" size="sm" className="h-8 gap-1 mr-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => setAtenderReq(r)}>
                            <Truck className="w-3.5 h-3.5" /> Atender
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, requisicao: r })}>
                          <Eye className="w-4 h-4 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Cards (mobile) */}
            <div className="md:hidden flex flex-col gap-y-2 p-2">
              {paginatedItems.map(r => {
                const stCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.RASCUNHO;
                const StatusIcon = stCfg.icon;
                return (
                  <div key={r.id} className="p-3 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 break-words">{r.obra_nome || obraMap[r.obra_id] || '—'}</p>
                      <p className="text-xs text-gray-500 mt-1 break-words">{r.local_estoque_nome || localMap[r.local_estoque_id] || '—'}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-gray-500">
                        <span>{r.data_requisicao ? format(new Date(r.data_requisicao), 'dd/MM/yy', { locale: ptBR }) : '—'}</span>
                        <span className="text-gray-300">•</span>
                        <span className="break-words">{r.solicitante_nome || r.solicitante_user_id || '—'}</span>
                      </div>
                      {r.aprovado_por_user_id && <p className="text-xs text-gray-400 mt-1 break-words">Aprovado por {r.aprovado_por_user_id}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`gap-1 whitespace-nowrap ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge>
                      <div className="flex items-center gap-1">
                        {gerivel(r) && r.status === 'ENVIADA' && (
                          <Button variant="outline" size="sm" className="h-8 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            disabled={aprovarMut.isPending} onClick={() => aprovarMut.mutate(r)}>
                            <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                          </Button>
                        )}
                        {gerivel(r) && r.status === 'APROVADA' && (
                          <Button variant="outline" size="sm" className="h-8 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => setAtenderReq(r)}>
                            <Truck className="w-3.5 h-3.5" /> Atender
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setModal({ open: true, requisicao: r })}>
                          <Eye className="w-4 h-4 text-gray-400" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      <RequisicaoModal open={modal.open} onClose={() => setModal({ open: false, requisicao: null })} requisicao={modal.requisicao} />

      {/* Atendimento: transfere Central → Obra */}
      <AtenderRequisicaoModal
        open={!!atenderReq}
        onClose={() => setAtenderReq(null)}
        requisicao={atenderReq || {}}
        itens={itensAtender}
        saldoCentralMap={saldoCentralMap}
        obraId={atenderReq?.obra_id}
      />
    </div>
  );
}