import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Truck, Clock, CheckCircle2, XCircle, AlertCircle, Eye, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import SolicitacaoVeiculoForm from '@/components/logistica/SolicitacaoVeiculoForm';
import SolicitacaoVeiculoModal from '@/components/logistica/SolicitacaoVeiculoModal';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

const statusConfig = {
  rascunho: { color: 'bg-gray-100 text-gray-700', label: 'Rascunho' },
  enviada: { color: 'bg-blue-100 text-blue-700', label: 'Enviada' },
  aprovada: { color: 'bg-emerald-100 text-emerald-700', label: 'Aprovada' },
  rejeitada: { color: 'bg-red-100 text-red-700', label: 'Rejeitada' },
  em_execucao: { color: 'bg-amber-100 text-amber-700', label: 'Em Execução' },
  concluida: { color: 'bg-emerald-100 text-emerald-700', label: 'Concluída' },
  cancelada: { color: 'bg-gray-100 text-gray-700', label: 'Cancelada' }
};

function formatarData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
}

export default function SolicitacoesVeiculos() {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [filtroObra, setFiltroObra] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const queryClient = useQueryClient();

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-veiculos'],
    queryFn: () => base44.entities.SolicitacaoVeiculo.list('-created_date', 500)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ['permissoes-user'],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.PermissaoUsuario.filter({ user_email: user.email });
    },
    enabled: !!user?.email
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['solicitacoes-veiculos'] });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SolicitacaoVeiculo.delete(id),
    onSuccess: () => { invalidar(); toast.success('Solicitação excluída'); setExcluir(null); },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir')
  });

  const obrasMap = useMemo(() => new Map(obras.map(o => [o.id, o.nome || o.nome_obra])), [obras]);
  const obraFiltroOptions = useMemo(
    () => [{ value: 'todas', label: 'Todas as obras' }, ...obras.map(o => ({ value: o.id, label: o.nome || o.nome_obra || o.id }))],
    [obras]
  );

  const filtradas = useMemo(() => solicitacoes.filter(s => {
    if (filtroObra !== 'todas' && s.obra_id !== filtroObra) return false;
    if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false;
    if (filtroTipo !== 'todos' && s.tipo_vinculo !== filtroTipo) return false;
    return true;
  }), [solicitacoes, filtroObra, filtroStatus, filtroTipo]);

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(filtradas, ITENS_POR_PAGINA);

  useEffect(() => { goToPage(1); }, [filtroObra, filtroStatus, filtroTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    enviadas: solicitacoes.filter(s => s.status === 'enviada').length,
    aprovadas: solicitacoes.filter(s => s.status === 'aprovada' || s.status === 'em_execucao' || s.status === 'concluida').length,
    rejeitadas: solicitacoes.filter(s => s.status === 'rejeitada').length,
    total: solicitacoes.length
  }), [solicitacoes]);

  const temPermissaoAprovacao = user?.role === 'admin'
    || permissoes.some(p => ['logistica', 'supervisor', 'gerente'].includes(String(p.cargo || '').toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-blue-600" />
            Solicitações de Veículos
          </h1>
          <p className="text-gray-500 mt-1">Gestão de solicitações de veículos da frota</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aguardando Aprovação</p>
                <p className="text-2xl font-bold text-blue-600">{stats.enviadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50"><AlertCircle className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Aprovadas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.aprovadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejeitadas</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejeitadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50"><XCircle className="w-6 h-6 text-red-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-100"><Truck className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-gray-900">Solicitações</CardTitle>
          <div className="flex flex-wrap gap-2 sm:w-auto w-full">
            <div className="w-full sm:w-[200px]">
              <ComboboxBusca options={obraFiltroOptions} value={filtroObra} onSelect={setFiltroObra} placeholder="Obra" searchPlaceholder="Buscar obra..." />
            </div>
            <div className="w-full sm:w-[160px]">
              <ComboboxBusca
                options={[{ value: 'todos', label: 'Todos status' }, ...Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }))]}
                value={filtroStatus}
                onSelect={setFiltroStatus}
                placeholder="Status"
                searchPlaceholder="Buscar..."
              />
            </div>
            <div className="w-full sm:w-[160px]">
              <ComboboxBusca
                options={[
                  { value: 'todos', label: 'Todos tipos' },
                  { value: 'obra', label: 'Obra' },
                  { value: 'entrega', label: 'Entrega' },
                  { value: 'visita_tecnica', label: 'Visita Técnica' },
                  { value: 'manutencao', label: 'Manutenção' },
                  { value: 'administrativo', label: 'Administrativo' },
                ]}
                value={filtroTipo}
                onSelect={setFiltroTipo}
                placeholder="Tipo"
                searchPlaceholder="Buscar..."
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={9} />
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Truck className="w-10 h-10" />
              <p className="text-sm text-gray-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Finalidade</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Obra</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Urgência</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Saída</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Solicitante</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map(sol => {
                      const status = statusConfig[sol.status] || { label: sol.status || '—', color: 'bg-gray-100 text-gray-700' };
                      const podeExcluir = sol.status === 'rascunho' && sol.solicitante_user_id === user?.email;
                      return (
                        <tr key={sol.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{sol.numero || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-xs truncate" title={sol.finalidade || ''}>{sol.finalidade || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={obrasMap.get(sol.obra_id) || ''}>
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              {sol.tipo_vinculo === 'obra' ? (obrasMap.get(sol.obra_id) || '—') : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{sol.tipo_vinculo?.replace('_', ' ') || '—'}</td>
                          <td className="px-4 py-3 text-center text-gray-600 capitalize">{sol.urgencia || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatarData(sol.data_saida_prevista)}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={sol.solicitante_user_id || ''}>
                            {sol.solicitante_user_id?.split('@')[0] || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`border-0 ${status.color}`}>{status.label}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setSelectedId(sol.id)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>
                                {podeExcluir && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluir(sol)}>
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Excluir rascunho</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Solicitação */}
      {showForm && (
        <SolicitacaoVeiculoForm
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); invalidar(); }}
        />
      )}

      {/* Modal Detalhes */}
      {selectedId && (
        <SolicitacaoVeiculoModal
          id={selectedId}
          onClose={() => setSelectedId(null)}
          temPermissaoAprovacao={temPermissaoAprovacao}
          onSuccess={() => { invalidar(); setSelectedId(null); }}
        />
      )}

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a solicitação {excluir?.numero ? <strong>{excluir.numero}</strong> : 'selecionada'}? Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(excluir.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
