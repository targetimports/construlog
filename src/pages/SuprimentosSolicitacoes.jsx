import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Plus, Search, Eye, CheckCircle, Clock, XCircle, Ban, ArrowRight, ShoppingCart, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
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
import SCModal from '@/components/suprimentos/SCModal';
import SCAprovacaoModal from '@/components/suprimentos/SCAprovacaoModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_CONFIG = {
  RASCUNHO:   { label: 'Rascunho',   icon: Clock,       cls: 'bg-gray-100 text-gray-600' },
  ENVIADA:    { label: 'Enviada',     icon: ArrowRight,  cls: 'bg-blue-100 text-blue-700' },
  APROVADA:   { label: 'Aprovada',    icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
  REPROVADA:  { label: 'Reprovada',   icon: XCircle,     cls: 'bg-red-100 text-red-700' },
  CONVERTIDA: { label: 'Convertida',  icon: CheckCircle, cls: 'bg-purple-100 text-purple-700' },
  CANCELADA:  { label: 'Cancelada',   icon: Ban,         cls: 'bg-gray-100 text-gray-400' },
};

const PRIORIDADE_CONFIG = {
  BAIXA:   { label: 'Baixa',   cls: 'bg-gray-100 text-gray-500' },
  MEDIA:   { label: 'Média',   cls: 'bg-blue-100 text-blue-600' },
  ALTA:    { label: 'Alta',    cls: 'bg-orange-100 text-orange-600' },
  URGENTE: { label: 'Urgente', cls: 'bg-red-100 text-red-600' },
};

// Quem aprova solicitação de compra e gera pedido. Inclui 'programador' (o TI, que
// no resto do sistema é super junto com admin — ver lib/obraAccess) e 'financeiro'
// (aprova o gasto). Faltar o TI aqui é o que escondia o botão Aprovar de quem tem
// acesso a tudo. acesso_global (Matriz) também aprova.
const ROLES_APROVADORES = ['admin', 'programador', 'financeiro', 'supervisor', 'engenharia', 'gestor'];
const ehAprovador = (user) => !!user && (
  ROLES_APROVADORES.includes(user.role) ||
  ROLES_APROVADORES.includes(user.perfil_acesso) ||
  user.acesso_global === true
);

export default function SuprimentosSolicitacoes() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [modal, setModal] = useState({ open: false, sc: null });
  const [aprovModal, setAprovModal] = useState({ open: false, sc: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: user } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000,
  });

  const podeAprovar = ehAprovador(user);

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-compra'],
    queryFn: () => base44.entities.SolicitacaoCompra.list('-created_date', 1000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-sc'],
    queryFn: () => base44.entities.Obra.list('-created_date', 1000).catch(() => []),
  });

  const cancelarMutation = useMutation({
    mutationFn: (id) => base44.entities.SolicitacaoCompra.update(id, { status: 'CANCELADA' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['solicitacoes-compra'] }); toast.success('Solicitação cancelada.'); },
  });

  // Gera o Pedido de Compra (Matriz) a partir de uma SC aprovada — conserta o elo SC→PC.
  const gerarPedidoMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('converterSolicitacaoEmPedido', { solicitacao_id: id }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      const numero = res?.pedido?.numero || '';
      toast.success(`Pedido ${numero} gerado! Preencha fornecedor e preços.`);
      navigate(createPageUrl('SuprimentosPedidos'));
    },
    onError: (e) => toast.error('Erro ao gerar pedido: ' + (e?.message || e)),
  });

  const filtered = useMemo(() => solicitacoes.filter((s) => {
    const matchBusca = !busca || s.obra_nome?.toLowerCase().includes(busca.toLowerCase()) || s.solicitante_nome?.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || s.status === filtroStatus;
    const matchObra = !filtroObra || s.obra_id === filtroObra;
    return matchBusca && matchStatus && matchObra;
  }), [solicitacoes, busca, filtroStatus, filtroObra]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const temFiltro = busca || filtroStatus || filtroObra;
  const qtdFiltros = [busca, filtroStatus, filtroObra].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); resetPagina(); };

  const openCreate = () => setModal({ open: true, sc: null });
  const openView = (sc) => setModal({ open: true, sc });
  const openAprovar = (sc) => setAprovModal({ open: true, sc });
  const closeModal = () => setModal({ open: false, sc: null });
  const closeAprovModal = () => setAprovModal({ open: false, sc: null });

  // KPIs
  const totalEnviadas = solicitacoes.filter(s => s.status === 'ENVIADA').length;
  const totalAprovadas = solicitacoes.filter(s => s.status === 'APROVADA').length;
  const totalRascunhos = solicitacoes.filter(s => s.status === 'RASCUNHO').length;

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações de Compra</h1>
          <p className="text-sm text-gray-500">{solicitacoes.length} solicitações no total</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4" /> Nova Solicitação</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{totalEnviadas}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Aguardando Aprovação</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{totalAprovadas}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Aprovadas</p>
        </Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col">
          <p className="text-lg sm:text-2xl font-bold text-gray-500 tabular-nums">{totalRascunhos}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight mt-1">Rascunhos</p>
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
            <span className="text-xs text-gray-500">{filtered.length} solicitação(ões)</span>
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
                    <Input className="pl-9 h-11" placeholder="Obra ou solicitante..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
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
              <p className="text-gray-400">Nenhuma solicitação encontrada.</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={openCreate}>Criar primeira solicitação</Button>
            </div>
          ) : (
            <>
            <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-gray-600">Obra</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Solicitante</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Prioridade</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                  <th className="text-left p-3 font-semibold text-gray-600">Data</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map(s => {
                  const stCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.RASCUNHO;
                  const prCfg = PRIORIDADE_CONFIG[s.prioridade] || PRIORIDADE_CONFIG.MEDIA;
                  const StatusIcon = stCfg.icon;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-900">{s.obra_nome || '—'}</td>
                      <td className="p-3 text-gray-600">{s.solicitante_nome || s.solicitante_user_id || '—'}</td>
                      <td className="p-3">
                        <Badge className={prCfg.cls}>{prCfg.label}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge className={`gap-1 ${stCfg.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {stCfg.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">
                        {s.created_date ? format(new Date(s.created_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" title="Ver / Editar" onClick={() => openView(s)}>
                            <Eye className="w-4 h-4 text-gray-400" />
                          </Button>
                          {s.status === 'ENVIADA' && podeAprovar && (
                            <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => openAprovar(s)}>
                              Analisar
                            </Button>
                          )}
                          {s.status === 'APROVADA' && podeAprovar && (
                            <Button
                              variant="outline" size="sm"
                              className="text-purple-600 border-purple-300 hover:bg-purple-50 gap-1"
                              disabled={gerarPedidoMutation.isPending}
                              onClick={() => gerarPedidoMutation.mutate(s.id)}
                            >
                              <ShoppingCart className="w-3.5 h-3.5" /> Gerar Pedido
                            </Button>
                          )}
                          {(s.status === 'RASCUNHO' || s.status === 'ENVIADA') && (
                            <Button
                              variant="ghost" size="sm"
                              className="text-red-400 hover:text-red-600"
                              onClick={async () => { if (await confirmar({ titulo: 'Cancelar solicitação', descricao: 'Cancelar esta solicitação de compra?', destrutivo: true, confirmar: 'Cancelar solicitação', cancelar: 'Voltar' })) cancelarMutation.mutate(s.id); }}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Cards mobile */}
            <div className="md:hidden flex flex-col gap-y-2 p-2">
              {paginatedItems.map(s => {
                const stCfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.RASCUNHO;
                const prCfg = PRIORIDADE_CONFIG[s.prioridade] || PRIORIDADE_CONFIG.MEDIA;
                const StatusIcon = stCfg.icon;
                return (
                  <div key={s.id} className="p-3 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 break-words">{s.obra_nome || '—'}</p>
                        <p className="text-sm text-gray-600 break-words">{s.solicitante_nome || s.solicitante_user_id || '—'}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {s.created_date ? format(new Date(s.created_date), 'dd/MM/yy', { locale: ptBR }) : '—'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`gap-1 ${stCfg.cls}`}>
                          <StatusIcon className="w-3 h-3" />
                          {stCfg.label}
                        </Badge>
                        <Badge className={prCfg.cls}>{prCfg.label}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1 border-gray-300 text-gray-700" onClick={() => openView(s)}>
                        <Eye className="w-4 h-4 text-gray-400" /> Ver
                      </Button>
                      {s.status === 'ENVIADA' && podeAprovar && (
                        <Button variant="outline" size="sm" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => openAprovar(s)}>
                          Analisar
                        </Button>
                      )}
                      {s.status === 'APROVADA' && podeAprovar && (
                        <Button
                          variant="outline" size="sm"
                          className="text-purple-600 border-purple-300 hover:bg-purple-50 gap-1"
                          disabled={gerarPedidoMutation.isPending}
                          onClick={() => gerarPedidoMutation.mutate(s.id)}
                        >
                          <ShoppingCart className="w-3.5 h-3.5" /> Gerar Pedido
                        </Button>
                      )}
                      {(s.status === 'RASCUNHO' || s.status === 'ENVIADA') && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-red-400 hover:text-red-600"
                          onClick={async () => { if (await confirmar({ titulo: 'Cancelar solicitação', descricao: 'Cancelar esta solicitação de compra?', destrutivo: true, confirmar: 'Cancelar solicitação', cancelar: 'Voltar' })) cancelarMutation.mutate(s.id); }}
                        >
                          Cancelar
                        </Button>
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

      <SCModal open={modal.open} onClose={closeModal} sc={modal.sc} />
      <SCAprovacaoModal open={aprovModal.open} onClose={closeAprovModal} sc={aprovModal.sc} />
    </div>
  );
}