import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Eye, CheckCircle, Clock, Ban, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import RecebimentoModal from '@/components/suprimentos/RecebimentoModal';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  RASCUNHO:   { label: 'Rascunho',   icon: Clock,         cls: 'bg-gray-100 text-gray-600' },
  CONFIRMADO: { label: 'Confirmado', icon: CheckCircle,   cls: 'bg-green-100 text-green-700' },
  CANCELADO:  { label: 'Cancelado',  icon: Ban,           cls: 'bg-red-100 text-red-500' },
};

export default function SuprimentosRecebimentos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [modal, setModal] = useState({ open: false, recebimento: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: recebimentos = [], isLoading } = useQuery({
    queryKey: ['recebimentos'],
    queryFn: () => base44.entities.Recebimento.list('-created_date', 1000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-receb'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000).catch(() => []),
  });

  const filtered = useMemo(() => recebimentos.filter((r) => {
    const matchBusca = !busca
      || r.obra_nome?.toLowerCase().includes(busca.toLowerCase())
      || r.fornecedor_nome?.toLowerCase().includes(busca.toLowerCase())
      || r.numero_nf?.includes(busca)
      || r.pedido_numero?.includes(busca);
    const matchStatus = !filtroStatus || r.status === filtroStatus;
    const matchObra = !filtroObra || r.obra_id === filtroObra;
    return matchBusca && matchStatus && matchObra;
  }), [recebimentos, busca, filtroStatus, filtroObra]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const temFiltro = busca || filtroStatus || filtroObra;
  const qtdFiltros = [busca, filtroStatus, filtroObra].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); resetPagina(); };

  // KPIs
  const totalConfirmados = recebimentos.filter(r => r.status === 'CONFIRMADO').length;
  const totalRascunhos = recebimentos.filter(r => r.status === 'RASCUNHO').length;
  const valorTotal = recebimentos.filter(r => r.status === 'CONFIRMADO').reduce((acc, r) => acc + (r.valor_total || 0), 0);

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recebimentos</h1>
          {/* Só CONSULTA: o recebimento não se cria avulso aqui — ele nasce de um
              pedido de compra ("Confirmar compra" em Pedidos) ou de uma requisição
              de transferência. Isto trava recebimento sem documento por trás. */}
          <p className="text-sm text-gray-500">{recebimentos.length} recebimentos · histórico de compras e notas fiscais</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{totalConfirmados}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Confirmados</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-gray-500 tabular-nums">{totalRascunhos}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Rascunhos</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 col-span-2 sm:col-span-1 flex flex-col">
          <p className="text-lg sm:text-xl font-bold text-gray-700 tabular-nums break-words leading-tight">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Valor Recebido (confirmados)</p>
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
            <span className="text-xs text-gray-500">{filtered.length} recebimento(s)</span>
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
                    <Input className="pl-9 h-11" placeholder="Obra, fornecedor ou NF..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca options={obraOptions} value={filtroObra} onSelect={(v) => { setFiltroObra(v); resetPagina(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca
                    options={[{ value: '', label: 'Todos status' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ value: k, label: v.label }))]}
                    value={filtroStatus}
                    onSelect={(v) => { setFiltroStatus(v || ''); resetPagina(); }}
                    placeholder="Todos status"
                    searchPlaceholder="Buscar..."
                  />
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
            <TableSkeleton bare rows={6} cols={10} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Nenhum recebimento ainda.</p>
              <p className="text-xs text-gray-400 mt-1">Os recebimentos aparecem aqui quando uma compra é confirmada (em Pedidos).</p>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Pedido</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Local Destino</th>
                  <th className="text-left p-3 font-semibold text-gray-600">NF Referência</th>
                  <th className="text-center p-3 font-semibold text-gray-600">NF Anexada</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                  <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map(r => {
                  const stCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.RASCUNHO;
                  const StatusIcon = stCfg.icon;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-500 text-xs">
                        {r.data_recebimento ? format(new Date(r.data_recebimento), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="p-3 font-mono text-xs text-gray-400">{r.pedido_numero || '—'}</td>
                      <td className="p-3 font-medium text-gray-900">{r.obra_nome || '—'}</td>
                      <td className="p-3 text-gray-600">{r.fornecedor_nome || '—'}</td>
                      <td className="p-3 text-gray-500">{r.local_estoque_nome || '—'}</td>
                      <td className="p-3 text-gray-400 font-mono text-xs">{r.numero_nf || '—'}</td>
                      <td className="p-3 text-center">
                        <BotaoAnexarNFGasto
                          referencia_tipo="RECEBIMENTO"
                          referencia_id={r.id}
                          referencia_nome={r.pedido_numero || r.id.slice(0, 8)}
                          obra_id={r.obra_id}
                          podeEditar={r.status !== 'CANCELADO'}
                          onSuccess={() => qc.invalidateQueries({ queryKey: ['recebimentos'] })}
                        />
                      </td>
                      <td className="p-3">
                        <Badge className={`gap-1 ${stCfg.cls}`}>
                          <StatusIcon className="w-3 h-3" /> {stCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium text-gray-700 text-xs">
                        {r.valor_total ? `R$ ${r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, recebimento: r })}>
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
                  <div key={r.id} className="p-3 rounded-lg border border-gray-200 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 break-words">{r.obra_nome || '—'}</p>
                        <p className="text-sm text-gray-600 break-words">{r.fornecedor_nome || '—'}</p>
                      </div>
                      <Badge className={`gap-1 shrink-0 ${stCfg.cls}`}>
                        <StatusIcon className="w-3 h-3" /> {stCfg.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>Data: {r.data_recebimento ? format(new Date(r.data_recebimento), 'dd/MM/yy', { locale: ptBR }) : '—'}</span>
                      <span className="font-mono break-words">Pedido: {r.pedido_numero || '—'}</span>
                      <span className="break-words">Destino: {r.local_estoque_nome || '—'}</span>
                      <span className="font-mono break-words">NF: {r.numero_nf || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-base font-semibold text-gray-800 tabular-nums break-words">
                        {r.valor_total ? `R$ ${r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <BotaoAnexarNFGasto
                          referencia_tipo="RECEBIMENTO"
                          referencia_id={r.id}
                          referencia_nome={r.pedido_numero || r.id.slice(0, 8)}
                          obra_id={r.obra_id}
                          podeEditar={r.status !== 'CANCELADO'}
                          onSuccess={() => qc.invalidateQueries({ queryKey: ['recebimentos'] })}
                        />
                        <Button variant="ghost" size="icon" onClick={() => setModal({ open: true, recebimento: r })}>
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

      <RecebimentoModal open={modal.open} onClose={() => setModal({ open: false, recebimento: null })} recebimento={modal.recebimento} />
    </div>
  );
}