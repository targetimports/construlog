import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Wrench, Plus, Clock, CheckCircle, DollarSign, Layers, Pencil, Trash2, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import ManutencaoForm from '../components/frota/ManutencaoForm';
import PermissaoGuard from '../components/shared/PermissaoGuard';
import Pagination from '../components/shared/Pagination';
import { usePagination } from '../components/shared/usePagination';

const ITENS_POR_PAGINA = 15;

const statusConfig = {
  agendada: { label: 'Agendada', color: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' }
};

const tipoConfig = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva'
};

export default function Manutencoes() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('agendada');
  const queryClient = useQueryClient();

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes'],
    queryFn: () => base44.entities.Manutencao.list('-data_entrada', 100)
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['manutencoes'] });

  const concluirMutation = useMutation({
    mutationFn: (m) => base44.entities.Manutencao.update(m.id, {
      status: 'concluida',
      data_saida: m.data_saida || new Date().toISOString().split('T')[0]
    }),
    onSuccess: () => { invalidar(); toast.success('Manutenção concluída!'); },
    onError: (err) => toast.error(err?.message || 'Erro ao concluir manutenção')
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.Manutencao.delete(id),
    onSuccess: () => { invalidar(); toast.success('Manutenção excluída'); setExcluir(null); },
    onError: (err) => toast.error(err?.message || 'Erro ao excluir manutenção')
  });

  const manutencoesFiltradas = useMemo(
    () => (filtroStatus === 'todas'
      ? manutencoes
      : manutencoes.filter(m => m.status === filtroStatus)),
    [manutencoes, filtroStatus]
  );

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(manutencoesFiltradas, ITENS_POR_PAGINA);

  // Volta à primeira página quando o filtro muda
  useEffect(() => { goToPage(1); }, [filtroStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    agendadas: manutencoes.filter(m => m.status === 'agendada').length,
    emAndamento: manutencoes.filter(m => m.status === 'em_andamento').length,
    concluidas: manutencoes.filter(m => m.status === 'concluida').length,
    total: manutencoes.length,
    custoTotal: manutencoes.reduce((sum, m) => sum + (m.valor_total || 0), 0)
  }), [manutencoes]);

  const obterVeiculo = (id) => {
    const v = veiculos.find(v => v.id === id);
    return v ? (v.placa || v.modelo || 'N/A') : 'N/A';
  };

  const formatarMoeda = (valor) =>
    (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutenções de Veículos</h1>
          <p className="text-gray-500 mt-1">Gestão e controle de manutenções da frota</p>
        </div>
        <PermissaoGuard acao="criar" modulo="frota">
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() => { setEditando(null); setShowForm(true); }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Manutenção
          </Button>
        </PermissaoGuard>
      </div>

      <Dialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditando(null); }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Manutenção' : 'Nova Manutenção'}</DialogTitle>
          </DialogHeader>
          {showForm && (
            <ManutencaoForm
              manutencao={editando}
              onClose={() => { setShowForm(false); setEditando(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Agendadas</p>
                <p className="text-2xl font-bold text-blue-600">{stats.agendadas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Em Andamento</p>
                <p className="text-2xl font-bold text-amber-600">{stats.emAndamento}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50">
                <Wrench className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Concluídas</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.concluidas}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
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
              <div className="p-2.5 rounded-xl bg-gray-100">
                <Layers className="w-6 h-6 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Custo Total</p>
                <p className="text-xl font-bold text-purple-600">{formatarMoeda(stats.custoTotal)}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-purple-50">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Manutenções */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <CardTitle className="text-gray-900">Manutenções</CardTitle>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="agendada">Agendadas</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluida">Concluídas</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {manutencoesFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Wrench className="w-10 h-10" />
              <p className="text-sm text-gray-500">Nenhuma manutenção encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Veículo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data Entrada</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Oficina</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">KM</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Valor Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map(manutencao => {
                      const status = statusConfig[manutencao.status];
                      return (
                        <tr key={manutencao.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 font-medium text-gray-900 whitespace-nowrap">
                              <Wrench className="w-4 h-4 text-gray-400" />
                              {obterVeiculo(manutencao.veiculo_id)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <Badge variant="outline" className="capitalize">
                              {tipoConfig[manutencao.tipo] || manutencao.tipo || '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {status
                              ? <Badge className={`border-0 ${status.color}`}>{status.label}</Badge>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {manutencao.data_entrada
                              ? new Date(manutencao.data_entrada).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{manutencao.oficina || 'N/A'}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {manutencao.km != null ? Number(manutencao.km).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{formatarMoeda(manutencao.valor_total)}</td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end gap-1">
                                {manutencao.status !== 'concluida' && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        disabled={concluirMutation.isPending}
                                        onClick={() => concluirMutation.mutate(manutencao)}
                                      >
                                        <CheckCheck className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Concluir</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => { setEditando(manutencao); setShowForm(true); }}
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => setExcluir(manutencao)}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </Tooltip>
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

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir manutenção?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir esta manutenção
            {excluir ? ` do veículo ${obterVeiculo(excluir.veiculo_id)}` : ''}? Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluirMutation.mutate(excluir.id)}
              disabled={excluirMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {excluirMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
