import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, DollarSign, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import PageHeader from '../components/ui/PageHeader';
import { TableSkeleton } from '@/components/shared/Skeletons';

const POR_PAGINA = 20;
const VAZIO = { colaborador_id: '', vigencia_inicio: '', vigencia_fim: '', custo_hora: '', custo_hora_extra: '' };
const fmtBRL = (v) => (v == null ? null : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);

export default function CustoHoraColaboradores() {
  const [showModal, setShowModal] = useState(false);
  const [errors, setErrors] = useState({});
  const [editando, setEditando] = useState(null);
  const [regExcluir, setRegExcluir] = useState(null);
  const [formData, setFormData] = useState(VAZIO);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');
  const queryClient = useQueryClient();

  const { data: custos = [], isLoading } = useQuery({
    queryKey: ['custos-hora'],
    queryFn: () => base44.entities.CustoHoraColaborador.list('-vigencia_inicio', 500),
  });

  // Todos (para resolver nome mesmo de colaborador inativo) + ativos (para o seletor).
  const { data: todosColabs = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
  });
  const colabMap = useMemo(() => Object.fromEntries((todosColabs || []).map((c) => [c.id, c.nome])), [todosColabs]);
  const ativos = useMemo(() => todosColabs.filter((c) => (c.status || 'ativo') !== 'inativo' && c.status !== 'demitido'), [todosColabs]);

  const salvarMutation = useMutation({
    mutationFn: (dados) => base44.functions.invoke('salvarCustoHoraColaborador', dados),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-hora'] });
      toast.success('Custo/hora salvo!');
      setShowModal(false);
      setFormData(VAZIO);
    },
    onError: (e) => toast.error('Erro ao salvar: ' + (e?.response?.data?.error || e.message)),
  });

  // Edição/exclusão direta (correções) via CRUD genérico da entidade.
  const editarMutation = useMutation({
    mutationFn: ({ id, dados }) => base44.entities.CustoHoraColaborador.update(id, {
      vigencia_inicio: dados.vigencia_inicio,
      vigencia_fim: dados.vigencia_fim || null,
      custo_hora: Number(dados.custo_hora) || 0,
      custo_hora_extra: dados.custo_hora_extra !== '' && dados.custo_hora_extra != null ? Number(dados.custo_hora_extra) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-hora'] });
      toast.success('Custo/hora atualizado!');
      setShowModal(false); setEditando(null); setFormData(VAZIO);
    },
    onError: (e) => toast.error('Erro ao atualizar: ' + e.message),
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.CustoHoraColaborador.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['custos-hora'] }); toast.success('Custo/hora excluído!'); setRegExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setRegExcluir(null); },
  });

  const set = (k, v) => {
    setFormData((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const abrirNovo = () => { setEditando(null); setFormData(VAZIO); setErrors({}); setShowModal(true); };
  const abrirEditar = (c) => {
    setEditando(c);
    setErrors({});
    setFormData({
      colaborador_id: c.colaborador_id || '',
      vigencia_inicio: c.vigencia_inicio || '',
      vigencia_fim: c.vigencia_fim || '',
      custo_hora: c.custo_hora ?? '',
      custo_hora_extra: c.custo_hora_extra ?? '',
    });
    setShowModal(true);
  };

  const validar = () => {
    const e = {};
    if (!formData.colaborador_id) e.colaborador_id = 'Selecione o colaborador';
    if (!formData.vigencia_inicio) e.vigencia_inicio = 'Informe o início da vigência';

    if (formData.vigencia_fim && formData.vigencia_inicio && formData.vigencia_fim < formData.vigencia_inicio) {
      e.vigencia_fim = 'O fim não pode ser anterior ao início';
    }

    // Custo/hora é a base do custo de mão de obra na DRE: zero zera o custo da obra.
    if (formData.custo_hora === '' || !(Number(formData.custo_hora) > 0)) {
      e.custo_hora = 'Informe um custo/hora maior que zero';
    }
    if (formData.custo_hora_extra !== '' && Number(formData.custo_hora_extra) < 0) {
      e.custo_hora_extra = 'Valor não pode ser negativo';
    }

    // Duas faixas abertas para a mesma pessoa fazem o cálculo pegar a errada.
    const conflito = custos.some((c) =>
      c.id !== editando?.id &&
      c.colaborador_id === formData.colaborador_id &&
      String(c.vigencia_inicio || '') === String(formData.vigencia_inicio || ''));
    if (conflito) e.vigencia_inicio = 'Já existe um custo com essa vigência para este colaborador';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    if (editando) editarMutation.mutate({ id: editando.id, dados: formData });
    else salvarMutation.mutate(formData);
  };

  // Vigentes (ativo) primeiro; dentro de cada grupo, vigência mais recente no topo.
  const custosOrdenados = useMemo(() => {
    return [...custos].sort((a, b) => {
      const av = a.ativo ? 1 : 0;
      const bv = b.ativo ? 1 : 0;
      if (av !== bv) return bv - av;
      return String(b.vigencia_inicio || '').localeCompare(String(a.vigencia_inicio || ''));
    });
  }, [custos]);

  const custosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return custosOrdenados.filter((c) => {
      const nome = (colabMap[c.colaborador_id] || '').toLowerCase();
      const matchBusca = !q || nome.includes(q);
      const matchStatus = statusFiltro === 'todos' || (statusFiltro === 'vigente' ? c.ativo : !c.ativo);
      return matchBusca && matchStatus;
    });
  }, [custosOrdenados, busca, statusFiltro, colabMap]);

  const {
    paginatedItems: pageItens,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(custosFiltrados, POR_PAGINA);
  const qtdFiltros = (busca ? 1 : 0) + (statusFiltro !== 'todos' ? 1 : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custo Hora - Colaboradores"
        subtitle="Valor da hora (normal e extra) por colaborador, com vigência"
        action={abrirNovo}
        actionLabel="Novo Custo"
        actionIcon={Plus}
      />

      <FiltrosColapsaveis
        ativos={qtdFiltros}
        onLimpar={() => { setBusca(''); setStatusFiltro('todos'); goToPage(1); }}
        rodape={<span className="text-xs text-gray-500">{custosFiltrados.length} registro(s)</span>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar colaborador</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Nome do colaborador..." value={busca} onChange={(e) => { setBusca(e.target.value); goToPage(1); }} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todos' }, { value: 'vigente', label: 'Vigente' }, { value: 'encerrado', label: 'Encerrado' }]}
              value={statusFiltro}
              onSelect={(v) => { setStatusFiltro(v || 'todos'); goToPage(1); }}
              placeholder="Todos"
              searchPlaceholder="Buscar..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={7} />
          ) : custosFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">{custos.length === 0 ? 'Nenhum custo/hora cadastrado' : 'Nenhum resultado'}</h3>
              <p className="text-sm text-gray-500 mb-5">{custos.length === 0 ? 'Cadastre o custo/hora para o apontamento calcular os valores' : 'Ajuste os filtros para ver os registros.'}</p>
              {custos.length === 0 && <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Novo Custo</Button>}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Vigência Início</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Vigência Fim</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Custo Hora</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Custo Extra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{colabMap[c.colaborador_id] || c.colaborador_id}</td>
                        <td className="p-3 text-gray-600">{dataBR(c.vigencia_inicio) || '—'}</td>
                        <td className="p-3 text-gray-600">{dataBR(c.vigencia_fim) || <span className="text-gray-400">Indeterminada</span>}</td>
                        <td className="p-3 text-right text-gray-700">{fmtBRL(c.custo_hora) || '—'}</td>
                        <td className="p-3 text-right text-gray-600">{fmtBRL(c.custo_hora_extra) || <span className="text-gray-400">—</span>}</td>
                        <td className="p-3">
                          {c.ativo
                            ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Vigente</Badge>
                            : <Badge className="bg-gray-100 text-gray-500 border-0">Encerrado</Badge>}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" title="Editar" onClick={() => abrirEditar(c)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                            <Button size="icon" variant="ghost" title="Excluir" onClick={() => setRegExcluir(c)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 break-words min-w-0">{colabMap[c.colaborador_id] || c.colaborador_id}</p>
                      {c.ativo
                        ? <Badge className="bg-emerald-100 text-emerald-700 border-0 shrink-0">Vigente</Badge>
                        : <Badge className="bg-gray-100 text-gray-500 border-0 shrink-0">Encerrado</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-gray-500">Custo Hora</span><p className="font-medium text-gray-700 tabular-nums">{fmtBRL(c.custo_hora) || '—'}</p></div>
                      <div><span className="text-gray-500">Custo Extra</span><p className="font-medium text-gray-700 tabular-nums">{fmtBRL(c.custo_hora_extra) || '—'}</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">{dataBR(c.vigencia_inicio) || '—'} → {dataBR(c.vigencia_fim) || 'Indeterminada'}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => abrirEditar(c)}><Pencil className="w-3.5 h-3.5 text-gray-400" /> Editar</Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => setRegExcluir(c)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
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

      <Dialog open={showModal} onOpenChange={(o) => { setShowModal(o); if (!o) setEditando(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Custo/Hora' : 'Novo Custo/Hora'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Colaborador *</Label>
              {editando ? (
                <Input value={colabMap[formData.colaborador_id] || ''} disabled className="h-11 bg-gray-50" />
              ) : (
                <ComboboxBusca
                  options={ativos.map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }))}
                  value={formData.colaborador_id}
                  onSelect={(v) => set('colaborador_id', v)}
                  placeholder="Selecione o colaborador"
                  searchPlaceholder="Buscar colaborador..."
                  emptyMessage="Nenhum colaborador ativo."
                  className={errors.colaborador_id ? 'border-red-400' : ''}
                />
              )}
              {errors.colaborador_id && <p className="text-xs text-red-500 mt-1">{errors.colaborador_id}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Vigência Início *</Label>
                <Input type="date" className={`h-11 ${errors.vigencia_inicio ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.vigencia_inicio} onChange={(e) => { set('vigencia_inicio', e.target.value); setErrors((p) => ({ ...p, vigencia_fim: null })); }} />
                {errors.vigencia_inicio && <p className="text-xs text-red-500 mt-1">{errors.vigencia_inicio}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Vigência Fim</Label>
                <Input type="date" className={`h-11 ${errors.vigencia_fim ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.vigencia_fim} onChange={(e) => set('vigencia_fim', e.target.value)} />
                {errors.vigencia_fim
                  ? <p className="text-xs text-red-500 mt-1">{errors.vigencia_fim}</p>
                  : <p className="text-[11px] text-gray-400 mt-1">Deixe em branco para vigorar por tempo indeterminado.</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo Hora (R$) *</Label>
                <Input type="number" step="0.01" min="0" className={`h-11 ${errors.custo_hora ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0,00" value={formData.custo_hora} onChange={(e) => set('custo_hora', e.target.value)} />
                {errors.custo_hora && <p className="text-xs text-red-500 mt-1">{errors.custo_hora}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo Hora Extra (R$)</Label>
                <Input type="number" step="0.01" min="0" className={`h-11 ${errors.custo_hora_extra ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="padrão: 1,5× normal" value={formData.custo_hora_extra} onChange={(e) => set('custo_hora_extra', e.target.value)} />
                {errors.custo_hora_extra && <p className="text-xs text-red-500 mt-1">{errors.custo_hora_extra}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditando(null); }} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleSave} disabled={salvarMutation.isPending || editarMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
              {(salvarMutation.isPending || editarMutation.isPending) ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!regExcluir} onOpenChange={(o) => { if (!o) setRegExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-600" /> Excluir custo/hora</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Excluir o custo/hora de <span className="font-medium">{regExcluir && (colabMap[regExcluir.colaborador_id] || regExcluir.colaborador_id)}</span>
            {regExcluir?.vigencia_inicio ? ` (vigência ${dataBR(regExcluir.vigencia_inicio)})` : ''}? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => excluirMutation.mutate(regExcluir.id)} disabled={excluirMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{excluirMutation.isPending ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
