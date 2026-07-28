import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Eye, Pencil, PackageCheck, Ban, TruckIcon, Clock, CheckCircle, AlertCircle, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirmar';
import PCModal from '@/components/suprimentos/PCModal';
import PCRecebimentoModal from '@/components/suprimentos/PCRecebimentoModal';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_CONFIG = {
  RASCUNHO:  { label: 'Rascunho',   icon: Clock,         cls: 'bg-gray-100 text-gray-600' },
  ENVIADO:   { label: 'Enviado',     icon: TruckIcon,     cls: 'bg-blue-100 text-blue-700' },
  PARCIAL:   { label: 'Parcial',     icon: AlertCircle,   cls: 'bg-orange-100 text-orange-700' },
  // Compra confirmada e enviada à obra; aguarda a obra receber (vistoria).
  EM_TRANSITO: { label: 'Enviado à obra', icon: TruckIcon, cls: 'bg-indigo-100 text-indigo-700' },
  RECEBIDO:  { label: 'Recebido',    icon: CheckCircle,   cls: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado',   icon: Ban,           cls: 'bg-gray-100 text-gray-400' },
};

export default function SuprimentosPedidos() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroFornecedor, setFiltroFornecedor] = useState('');
  const [modal, setModal] = useState({ open: false, pc: null });
  const [recvModal, setRecvModal] = useState({ open: false, pc: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-compra'],
    queryFn: () => base44.entities.PedidoCompra.list('-created_date', 1000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-pc'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000).catch(() => []),
  });
  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores-filtro-pc'],
    queryFn: () => base44.entities.Fornecedor.list('-created_date', 2000).catch(() => []),
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => base44.entities.PedidoCompra.update(id, { status: 'CANCELADO' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pedidos-compra'] }); toast.success('Pedido cancelado.'); },
  });

  const filtered = useMemo(() => {
    const q = busca.toLowerCase();
    return pedidos.filter((p) => {
      const matchBusca = !q || p.obra_nome?.toLowerCase().includes(q) || p.fornecedor_nome?.toLowerCase().includes(q) || p.numero?.toLowerCase().includes(q);
      const matchStatus = !filtroStatus || p.status === filtroStatus;
      const matchObra = !filtroObra || p.obra_id === filtroObra;
      const matchForn = !filtroFornecedor || p.fornecedor_id === filtroFornecedor;
      return matchBusca && matchStatus && matchObra && matchForn;
    });
  }, [pedidos, busca, filtroStatus, filtroObra, filtroFornecedor]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const totalEnviados = pedidos.filter((p) => p.status === 'ENVIADO').length;
  const totalParcial = pedidos.filter((p) => p.status === 'PARCIAL').length;
  const totalRecebido = pedidos.filter((p) => p.status === 'RECEBIDO').length;
  const valorTotal = pedidos.reduce((acc, p) => acc + num(p.valor_total), 0);

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const fornOptions = fornecedores.map((f) => ({ value: f.id, label: f.razao_social || f.nome }));
  const temFiltro = busca || filtroStatus || filtroObra || filtroFornecedor;
  const qtdFiltros = [busca, filtroStatus, filtroObra, filtroFornecedor].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); setFiltroFornecedor(''); resetPagina(); };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de Compra</h1>
          <p className="text-sm text-gray-500">{pedidos.length} pedidos cadastrados</p>
        </div>
        <Button onClick={() => setModal({ open: true, pc: null })} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo Pedido
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{totalEnviados}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Enviados</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-orange-500 tabular-nums">{totalParcial}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Recebimento Parcial</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{totalRecebido}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Recebidos</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-xl font-bold text-gray-700 tabular-nums break-words leading-tight">{fmtBRL(valorTotal)}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Valor Total</p></Card>
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
            <span className="text-xs text-gray-500">{filtered.length} pedido(s)</span>
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className="pl-9 h-11" placeholder="Obra, fornecedor, número..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca options={obraOptions} value={filtroObra} onSelect={(v) => { setFiltroObra(v); resetPagina(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Fornecedor</Label>
                  <ComboboxBusca options={fornOptions} value={filtroFornecedor} onSelect={(v) => { setFiltroFornecedor(v); resetPagina(); }} placeholder="Todos" searchPlaceholder="Buscar fornecedor..." />
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
            <TableSkeleton bare rows={6} cols={8} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">Nenhum pedido encontrado.</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={() => setModal({ open: true, pc: null })}>Criar primeiro pedido</Button>
            </div>
          ) : (
            <>
              {/* Tabela — desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Número</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Fornecedor</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Valor Total</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Previsão</th>
                      <th className="text-center p-3 font-semibold text-gray-600">NF</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((p) => {
                      const stCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.RASCUNHO;
                      const StatusIcon = stCfg.icon;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-3 font-mono text-xs text-gray-500">{p.numero || p.id.slice(0, 8)}</td>
                          <td className="p-3 font-medium text-gray-900">{p.obra_nome || (p.consolidado ? 'Multi-obra' : '—')}</td>
                          <td className="p-3 text-gray-600">{p.fornecedor_nome || '—'}</td>
                          <td className="p-3"><Badge className={`gap-1 border-0 ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge></td>
                          <td className="p-3 text-right font-medium text-gray-700 tabular-nums">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</td>
                          <td className="p-3 text-gray-400 text-xs">{p.previsao_entrega ? format(new Date(p.previsao_entrega), 'dd/MM/yy', { locale: ptBR }) : '—'}</td>
                          <td className="p-3 text-center">
                            <BotaoAnexarNFGasto referencia_tipo="PEDIDO_COMPRA" referencia_id={p.id} referencia_nome={p.numero || `PC-${p.id.slice(0, 8)}`} obra_id={p.obra_id} podeEditar={true} onSuccess={() => qc.invalidateQueries({ queryKey: ['pedidos-compra'] })} />
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {/* Rascunho ainda é montado (fornecedor/preços) → "Editar";
                                  depois de enviado, é só consulta → "Ver". Abrem o mesmo modal. */}
                              {['RASCUNHO'].includes(p.status) ? (
                                <Button variant="outline" size="sm" className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setModal({ open: true, pc: p })}><Pencil className="w-3.5 h-3.5" /> Editar</Button>
                              ) : (
                                <Button variant="outline" size="sm" className="gap-1 border-gray-300 text-gray-600" onClick={() => setModal({ open: true, pc: p })}><Eye className="w-3.5 h-3.5" /> Ver</Button>
                              )}
                              {['ENVIADO', 'PARCIAL'].includes(p.status) && (
                                <Button variant="outline" size="sm" className="gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => setRecvModal({ open: true, pc: p })}><PackageCheck className="w-3 h-3" /> Confirmar compra</Button>
                              )}
                              {['RASCUNHO', 'ENVIADO'].includes(p.status) && (
                                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={async () => { if (await confirmar({ titulo: 'Cancelar pedido', descricao: 'Cancelar este pedido de compra?', destrutivo: true, confirmar: 'Cancelar pedido', cancelar: 'Voltar' })) cancelarMutation.mutate(p.id); }}>Cancelar</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {paginatedItems.map((p) => {
                  const stCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.RASCUNHO;
                  const StatusIcon = stCfg.icon;
                  return (
                    <div key={p.id} className="p-3 rounded-lg border border-gray-200 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 break-words">{p.obra_nome || (p.consolidado ? 'Multi-obra' : '—')}</p>
                          <p className="text-xs text-gray-500 break-words">{p.fornecedor_nome || '—'}</p>
                          <p className="font-mono text-xs text-gray-400 mt-0.5 break-words">{p.numero || p.id.slice(0, 8)}</p>
                        </div>
                        <Badge className={`gap-1 border-0 shrink-0 ${stCfg.cls}`}><StatusIcon className="w-3 h-3" /> {stCfg.label}</Badge>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-gray-700 tabular-nums break-words">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</p>
                          <p className="text-xs text-gray-400">Prev.: {p.previsao_entrega ? format(new Date(p.previsao_entrega), 'dd/MM/yy', { locale: ptBR }) : '—'}</p>
                        </div>
                        <div className="shrink-0">
                          <BotaoAnexarNFGasto referencia_tipo="PEDIDO_COMPRA" referencia_id={p.id} referencia_nome={p.numero || `PC-${p.id.slice(0, 8)}`} obra_id={p.obra_id} podeEditar={true} onSuccess={() => qc.invalidateQueries({ queryKey: ['pedidos-compra'] })} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {p.status === 'RASCUNHO' ? (
                          <Button variant="outline" size="sm" className="gap-1 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setModal({ open: true, pc: p })}><Pencil className="w-4 h-4" /> Editar</Button>
                        ) : (
                          <Button variant="outline" size="sm" className="gap-1 border-gray-300 text-gray-700" onClick={() => setModal({ open: true, pc: p })}><Eye className="w-4 h-4" /> Ver</Button>
                        )}
                        {['ENVIADO', 'PARCIAL'].includes(p.status) && (
                          <Button variant="outline" size="sm" className="gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => setRecvModal({ open: true, pc: p })}><PackageCheck className="w-3 h-3" /> Confirmar compra</Button>
                        )}
                        {['RASCUNHO', 'ENVIADO'].includes(p.status) && (
                          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600" onClick={async () => { if (await confirmar({ titulo: 'Cancelar pedido', descricao: 'Cancelar este pedido de compra?', destrutivo: true, confirmar: 'Cancelar pedido', cancelar: 'Voltar' })) cancelarMutation.mutate(p.id); }}>Cancelar</Button>
                        )}
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

      <PCModal open={modal.open} onClose={() => setModal({ open: false, pc: null })} pc={modal.pc} />
      <PCRecebimentoModal open={recvModal.open} onClose={() => setRecvModal({ open: false, pc: null })} pc={recvModal.pc} />
    </div>
  );
}
