import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Eye, Clock, Send, CheckCircle, Ban, ArrowRight, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import TransferenciaModal from '@/components/suprimentos/TransferenciaModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  RASCUNHO:  { label: 'Rascunho',   icon: Clock,        cls: 'bg-gray-100 text-gray-600' },
  ENVIADA:   { label: 'Enviada',    icon: Send,         cls: 'bg-blue-100 text-blue-700' },
  CONFIRMADA:{ label: 'Confirmada', icon: CheckCircle,  cls: 'bg-green-100 text-green-700' },
  CANCELADA: { label: 'Cancelada',  icon: Ban,          cls: 'bg-red-100 text-red-500' },
};

export default function SuprimentosTransferencias() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroLocal, setFiltroLocal] = useState('');
  const [modal, setModal] = useState({ open: false, transferencia: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: transferencias = [], isLoading } = useQuery({
    queryKey: ['transferencias-estoque'],
    queryFn: () => base44.entities.TransferenciaEstoqueSuprimentos.list('-created_date', 1000),
  });
  const { data: locais = [] } = useQuery({
    queryKey: ['locais-filtro-transf'],
    queryFn: () => base44.entities.LocalEstoque.list('nome', 500).catch(() => []),
  });
  const localMap = useMemo(() => Object.fromEntries(locais.map((l) => [l.id, l.nome])), [locais]);

  const filtered = useMemo(() => transferencias.filter((t) => {
    const matchBusca = !busca
      || t.origem_local_nome?.toLowerCase().includes(busca.toLowerCase())
      || t.destino_local_nome?.toLowerCase().includes(busca.toLowerCase())
      || t.solicitado_por_user_id?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || t.status === filtroStatus;
    const matchLocal = !filtroLocal || t.origem_local_id === filtroLocal || t.destino_local_id === filtroLocal;
    return matchBusca && matchStatus && matchLocal;
  }), [transferencias, busca, filtroStatus, filtroLocal]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const localOptions = locais.map((l) => ({ value: l.id, label: l.nome }));
  const temFiltro = busca || filtroStatus || filtroLocal;
  const qtdFiltros = [busca, filtroStatus, filtroLocal].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroLocal(''); resetPagina(); };

  const pendentes = transferencias.filter(t => t.status === 'ENVIADA').length;
  const confirmadas = transferencias.filter(t => t.status === 'CONFIRMADA').length;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transferências de Estoque</h1>
          <p className="text-sm text-gray-500">{transferencias.length} transferências registradas</p>
        </div>
        <Button onClick={() => setModal({ open: true, transferencia: null })} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Nova Transferência
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{pendentes}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Aguardando Confirmação</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{confirmadas}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Confirmadas</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-gray-700 tabular-nums">{transferencias.length}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Total</p>
        </Card>
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
            <span className="text-xs text-gray-500">{filtered.length} transferência(s)</span>
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
                    <Input className="pl-9 h-11" placeholder="Local ou solicitante..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Local (origem ou destino)</Label>
                  <ComboboxBusca options={localOptions} value={filtroLocal} onSelect={(v) => { setFiltroLocal(v); resetPagina(); }} placeholder="Todos os locais" searchPlaceholder="Buscar local..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))} value={filtroStatus} onSelect={(v) => { setFiltroStatus(v || ''); resetPagina(); }} placeholder="Todos status" searchPlaceholder="Buscar..." />
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
              <p className="text-gray-400">Nenhuma transferência encontrada.</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={() => setModal({ open: true, transferencia: null })}>Criar primeira transferência</Button>
            </div>
          ) : (
            <>
            {/* Tabela — desktop */}
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Origem → Destino</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Solicitado por</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Confirmado por</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map(t => {
                  const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.RASCUNHO;
                  const StatusIcon = stCfg.icon;
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-xs">
                        {t.data_transferencia ? format(new Date(t.data_transferencia), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="p-3">
                        <span className="font-medium text-gray-900">{t.origem_local_nome || localMap[t.origem_local_id] || '—'}</span>
                        <ArrowRight className="w-3 h-3 inline mx-1 text-gray-400" />
                        <span className="font-medium text-gray-900">{t.destino_local_nome || localMap[t.destino_local_id] || '—'}</span>
                      </td>
                      <td className="p-3 text-gray-500 text-xs">{t.solicitado_por_user_id || '—'}</td>
                      <td className="p-3">
                        <Badge className={`gap-1 ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">{t.confirmado_por_user_id || '—'}</td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, transferencia: t })}>
                          <Eye className="w-4 h-4 text-gray-400" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Cards — mobile */}
            <div className="md:hidden flex flex-col gap-y-2 p-2">
              {paginatedItems.map(t => {
                const stCfg = STATUS_CONFIG[t.status] || STATUS_CONFIG.RASCUNHO;
                const StatusIcon = stCfg.icon;
                return (
                  <div key={t.id} className="p-3 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5">
                        <span className="font-medium text-gray-900 break-words">{t.origem_local_nome || localMap[t.origem_local_id] || '—'}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-900 break-words">{t.destino_local_nome || localMap[t.destino_local_id] || '—'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t.data_transferencia ? format(new Date(t.data_transferencia), 'dd/MM/yy', { locale: ptBR }) : '—'}
                        {t.solicitado_por_user_id ? <span className="break-words"> · {t.solicitado_por_user_id}</span> : null}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`gap-1 whitespace-nowrap ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setModal({ open: true, transferencia: t })}>
                        <Eye className="w-4 h-4 text-gray-400" />
                      </Button>
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

      <TransferenciaModal open={modal.open} onClose={() => setModal({ open: false, transferencia: null })} transferencia={modal.transferencia} />
    </div>
  );
}