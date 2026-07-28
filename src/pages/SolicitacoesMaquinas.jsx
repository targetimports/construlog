import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import {
  Plus, Clock, CheckCircle, XCircle, Calculator, AlertTriangle,
  CheckCheck, Pencil, Trash2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

const TIPO_MAQUINA_OPCOES = [
  { value: 'retro', label: 'Retro' },
  { value: 'patrol', label: 'Patrol' },
  { value: 'rolo', label: 'Rolo' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'pe_direito', label: 'Pé Direito' },
  { value: 'betoneira', label: 'Betoneira' },
  { value: 'bomba', label: 'Bomba' },
  { value: 'outro', label: 'Outro' },
];
const tipoMaquinaLabel = (v) => TIPO_MAQUINA_OPCOES.find((o) => o.value === v)?.label || v || '—';

const statusConfig = {
  rascunho: { label: 'Rascunho', color: 'bg-gray-100 text-gray-700' },
  enviada: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  aprovada: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700' },
  recusada: { label: 'Recusada', color: 'bg-red-100 text-red-700' },
  faturada: { label: 'Faturada', color: 'bg-purple-100 text-purple-700' },
};

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moeda = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
function diasAntecedencia(dataInicio) {
  if (!dataInicio) return 0;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ini = new Date(dataInicio); ini.setHours(0, 0, 0, 0);
  return Math.floor((ini - hoje) / (1000 * 60 * 60 * 24));
}
function formatarData(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('pt-BR');
}

export default function SolicitacoesMaquinas() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [filtroObra, setFiltroObra] = useState('todas');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-maquinas'],
    queryFn: () => base44.entities.SolicitacaoMaquina.list('-created_date', 500)
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['solicitacoes-maquinas'] });

  const podeAprovar = useMemo(() => {
    const role = String(currentUser?.role || '').toLowerCase();
    const cargo = String(currentUser?.cargo || '').toLowerCase();
    return role === 'admin' || role === 'programador'
      || ['diretor', 'engenheiro_coordenador', 'engenheiro_obra'].includes(cargo);
  }, [currentUser]);

  const aprovarMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('aprovarSolicitacaoMaquina', { solicitacao_id: id, aprovar: true }),
    onSuccess: () => { toast.success('Solicitação aprovada'); invalidar(); },
    onError: (e) => toast.error('Erro ao aprovar: ' + (e?.response?.data?.error || e.message))
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.SolicitacaoMaquina.delete(id),
    onSuccess: () => { toast.success('Solicitação excluída'); invalidar(); setExcluir(null); },
    onError: (e) => toast.error('Erro ao excluir: ' + e.message)
  });

  const obrasMap = useMemo(() => new Map(obras.map((o) => [o.id, o.nome || o.nome_obra])), [obras]);
  const obraFiltroOptions = useMemo(
    () => [{ value: 'todas', label: 'Todas as obras' }, ...obras.map((o) => ({ value: o.id, label: o.nome || o.nome_obra || o.id }))],
    [obras]
  );

  const filtradas = useMemo(() => solicitacoes.filter((s) => {
    if (filtroObra !== 'todas' && s.obra_id !== filtroObra) return false;
    if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false;
    return true;
  }), [solicitacoes, filtroObra, filtroStatus]);

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(filtradas, ITENS_POR_PAGINA);

  useEffect(() => { goToPage(1); }, [filtroObra, filtroStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    enviadas: solicitacoes.filter((s) => s.status === 'enviada').length,
    aprovadas: solicitacoes.filter((s) => s.status === 'aprovada' || s.status === 'faturada').length,
    recusadas: solicitacoes.filter((s) => s.status === 'recusada').length,
    total: solicitacoes.length
  }), [solicitacoes]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitações de Máquinas</h1>
          <p className="text-gray-500 mt-1">Solicite máquinas com antecedência mínima de 15 dias</p>
        </div>
        <Button onClick={() => { setEditando(null); setShowForm(true); }} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nova Solicitação
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Enviadas</p><p className="text-2xl font-bold text-blue-600">{stats.enviadas}</p></div>
              <div className="p-2.5 rounded-xl bg-blue-50"><Clock className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Aprovadas</p><p className="text-2xl font-bold text-emerald-600">{stats.aprovadas}</p></div>
              <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Recusadas</p><p className="text-2xl font-bold text-red-600">{stats.recusadas}</p></div>
              <div className="p-2.5 rounded-xl bg-red-50"><XCircle className="w-6 h-6 text-red-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
              <div className="p-2.5 rounded-xl bg-gray-100"><Calculator className="w-6 h-6 text-gray-500" /></div>
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
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={9} />
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Calculator className="w-10 h-10" />
              <p className="text-sm text-gray-500">Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Obra</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Solicitante</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Período</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Antec.</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Horas</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((sol) => {
                      const dias = diasAntecedencia(sol.data_inicio);
                      const urgente = dias < 15;
                      const status = statusConfig[sol.status] || { label: sol.status || '—', color: 'bg-gray-100 text-gray-700' };
                      const total = num(sol.horas_previstas) * num(sol.custo_hora_previsto);
                      const podeAprovarEsta = podeAprovar && (sol.status === 'enviada' || sol.status === 'rascunho');
                      return (
                        <tr key={sol.id} className={`hover:bg-gray-50 transition-colors ${urgente ? 'bg-amber-50/60' : ''}`}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{tipoMaquinaLabel(sol.tipo_maquina)}</div>
                            {sol.urgente && (
                              <Badge variant="destructive" className="text-xs mt-1"><AlertTriangle className="w-3 h-3 mr-1" />Urgente</Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate" title={obrasMap.get(sol.obra_id) || ''}>{obrasMap.get(sol.obra_id) || '—'}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={sol.solicitante_email || ''}>{sol.solicitante_nome || sol.solicitante_email || '—'}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatarData(sol.data_inicio)} – {formatarData(sol.data_fim)}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge className={`border-0 ${urgente ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{dias}d</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">{sol.horas_previstas != null ? sol.horas_previstas : '—'}</td>
                          <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{total > 0 ? moeda(total) : '—'}</td>
                          <td className="px-4 py-3 text-center"><Badge className={`border-0 ${status.color}`}>{status.label}</Badge></td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end gap-1">
                                {podeAprovarEsta && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" disabled={aprovarMutation.isPending} onClick={() => aprovarMutation.mutate(sol.id)}>
                                        <CheckCheck className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Aprovar</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setEditando(sol); setShowForm(true); }}>
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluir(sol)}>
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
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Form */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditando(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Solicitação' : 'Nova Solicitação de Máquina'}</DialogTitle>
          </DialogHeader>
          {showForm && (
            <MaquinaForm
              solicitacao={editando}
              obras={obras}
              currentUser={currentUser}
              onClose={() => { setShowForm(false); setEditando(null); }}
              onSaved={() => { invalidar(); setShowForm(false); setEditando(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir a solicitação de <strong>{tipoMaquinaLabel(excluir?.tipo_maquina)}</strong>? Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluirMutation.mutate(excluir.id)} disabled={excluirMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {excluirMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MaquinaForm({ solicitacao, obras, currentUser, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    obra_id: solicitacao?.obra_id || '',
    tipo_maquina: solicitacao?.tipo_maquina || 'retro',
    data_inicio: solicitacao?.data_inicio || new Date().toISOString().split('T')[0],
    data_fim: solicitacao?.data_fim || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    horas_previstas: solicitacao?.horas_previstas ?? 40,
    custo_hora_previsto: solicitacao?.custo_hora_previsto ?? 150,
    justificativa_urgencia: solicitacao?.justificativa_urgencia || '',
    observacoes: solicitacao?.observacoes || ''
  }));

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const obraOptions = useMemo(() => obras.map((o) => ({ value: o.id, label: o.nome || o.nome_obra || o.id })), [obras]);
  const urgente = diasAntecedencia(form.data_inicio) < 15;
  const custoTotal = num(form.horas_previstas) * num(form.custo_hora_previsto);

  const salvar = useMutation({
    mutationFn: async () => {
      const payload = {
        obra_id: form.obra_id,
        tipo_maquina: form.tipo_maquina,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim,
        horas_previstas: num(form.horas_previstas),
        custo_hora_previsto: num(form.custo_hora_previsto),
        justificativa_urgencia: form.justificativa_urgencia,
        observacoes: form.observacoes
      };
      if (solicitacao?.id) {
        return base44.entities.SolicitacaoMaquina.update(solicitacao.id, payload);
      }
      const resp = await base44.functions.invoke('criarSolicitacaoMaquina', {
        ...payload,
        solicitante_email: currentUser?.email,
        solicitante_nome: currentUser?.full_name || currentUser?.email
      });
      // Notificação best-effort (não bloqueia)
      try {
        const obra = obras.find((o) => o.id === form.obra_id);
        await base44.functions.invoke('notificarSolicitacaoMaquina', {
          obraNome: obra?.nome || obra?.nome_obra || form.obra_id,
          tipoMaquina: form.tipo_maquina,
          dataInicio: form.data_inicio,
          dataFim: form.data_fim,
          horasPrevistas: num(form.horas_previstas),
          custoHora: num(form.custo_hora_previsto),
          custoTotal,
          urgente,
          solicitanteNome: currentUser?.full_name || currentUser?.email || '',
          observacoes: form.observacoes
        });
      } catch { /* ignora falha de notificação */ }
      return resp;
    },
    onSuccess: () => { toast.success(solicitacao ? 'Solicitação atualizada' : 'Solicitação criada'); onSaved(); },
    onError: (e) => toast.error('Erro ao salvar: ' + (e?.response?.data?.error || e.message))
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.obra_id) { toast.error('Selecione a obra'); return; }
    if (!form.data_inicio || !form.data_fim) { toast.error('Informe as datas'); return; }
    salvar.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Obra *</Label>
          <ComboboxBusca options={obraOptions} value={form.obra_id} onSelect={(v) => set('obra_id', v)} placeholder="Selecione a obra" searchPlaceholder="Buscar obra..." />
        </div>
        <div>
          <Label className="mb-1 block">Tipo de Máquina *</Label>
          <ComboboxBusca options={TIPO_MAQUINA_OPCOES} value={form.tipo_maquina} onSelect={(v) => set('tipo_maquina', v)} placeholder="Selecione o tipo" searchPlaceholder="Buscar..." />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Data Início *</Label>
          <Input className="h-11" type="date" value={form.data_inicio} onChange={(e) => set('data_inicio', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Data Fim *</Label>
          <Input className="h-11" type="date" value={form.data_fim} onChange={(e) => set('data_fim', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Horas Previstas</Label>
          <Input className="h-11" type="number" min="0" value={form.horas_previstas} onChange={(e) => set('horas_previstas', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Custo/Hora Previsto (R$)</Label>
          <Input className="h-11" type="number" min="0" step="0.01" value={form.custo_hora_previsto} onChange={(e) => set('custo_hora_previsto', e.target.value)} />
        </div>
      </div>

      {/* Custo total */}
      <div className="flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
        <span className="text-sm font-medium text-gray-700">Custo Total Estimado</span>
        <span className="text-lg font-bold text-blue-600">{moeda(custoTotal)}</span>
      </div>

      {urgente && (
        <div>
          <Label className="mb-1 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-600" /> Justificativa para Solicitação Urgente</Label>
          <Textarea value={form.justificativa_urgencia} onChange={(e) => set('justificativa_urgencia', e.target.value)} rows={2} placeholder="Explique por que precisa da máquina em menos de 15 dias" />
        </div>
      )}

      <div>
        <Label className="mb-1 block">Observações</Label>
        <Textarea value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} rows={2} placeholder="Observações adicionais" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
