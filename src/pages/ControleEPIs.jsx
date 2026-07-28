import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Shield, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : null);

const tipoEPIConfig = {
  capacete: 'Capacete', oculos: 'Óculos de Proteção', protetor_auricular: 'Protetor Auricular',
  mascara: 'Máscara', luvas: 'Luvas', botinas: 'Botinas', cinto_seguranca: 'Cinto de Segurança',
  colete: 'Colete', uniforme: 'Uniforme', outros: 'Outros',
};

const statusConfig = {
  em_uso: { label: 'Em uso', color: 'bg-emerald-100 text-emerald-700' },
  devolvido: { label: 'Devolvido', color: 'bg-gray-100 text-gray-600' },
  vencido: { label: 'Vencido', color: 'bg-red-100 text-red-700' },
  extraviado: { label: 'Extraviado', color: 'bg-amber-100 text-amber-700' },
};

const VAZIO = {
  colaborador_id: '', obra_id: '', tipo_epi: 'capacete', descricao: '',
  data_entrega: new Date().toISOString().split('T')[0], data_validade: '',
  numero_ca: '', quantidade: 1, valor_unitario: '', status: 'em_uso', observacoes: '',
};

export default function ControleEPIs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [editando, setEditando] = useState(null);
  const [regExcluir, setRegExcluir] = useState(null);
  const [formData, setFormData] = useState(VAZIO);
  const queryClient = useQueryClient();

  const { data: epis = [], isLoading } = useQuery({ queryKey: ['epis'], queryFn: () => base44.entities.ControleEPI.list('-data_entrega', 500) });
  const { data: colaboradores = [] } = useQuery({ queryKey: ['colaboradores'], queryFn: () => base44.entities.Colaborador.list('-created_date', 5000) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });

  const nomeColab = useMemo(() => Object.fromEntries(colaboradores.map((c) => [c.id, c.nome])), [colaboradores]);
  const nomeObra = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  const payload = (data) => ({
    ...data,
    quantidade: Number(data.quantidade) || 1,
    valor_unitario: data.valor_unitario !== '' && data.valor_unitario != null ? Number(data.valor_unitario) : null,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ControleEPI.create(payload(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['epis'] }); toast.success('EPI registrado!'); fechar(); },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ControleEPI.update(id, payload(data)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['epis'] }); toast.success('EPI atualizado!'); fechar(); },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ControleEPI.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['epis'] }); toast.success('EPI excluído!'); setRegExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setRegExcluir(null); },
  });

  const set = (k, v) => {
    setFormData((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const fechar = () => { setDialogOpen(false); setEditando(null); setFormData(VAZIO); setErrors({}); };
  const abrirNovo = () => { setEditando(null); setFormData(VAZIO); setErrors({}); setDialogOpen(true); };
  const abrirEditar = (epi) => {
    setEditando(epi);
    setFormData({ ...VAZIO, ...epi, valor_unitario: epi.valor_unitario ?? '', quantidade: epi.quantidade ?? 1 });
    setErrors({});
    setDialogOpen(true);
  };

  const validar = () => {
    const e = {};
    if (!formData.colaborador_id) e.colaborador_id = 'Selecione o colaborador';
    if (!formData.tipo_epi) e.tipo_epi = 'Selecione o tipo de EPI';

    if (!formData.data_entrega) e.data_entrega = 'Informe a data de entrega';
    else if (formData.data_entrega > new Date().toISOString().split('T')[0]) e.data_entrega = 'A entrega não pode ser futura';

    // Validade antes da entrega deixaria o EPI nascer vencido no alerta dos 30 dias.
    if (formData.data_validade && formData.data_entrega && formData.data_validade < formData.data_entrega) {
      e.data_validade = 'A validade não pode ser anterior à entrega';
    }

    if (!(Number(formData.quantidade) > 0)) e.quantidade = 'Quantidade deve ser maior que zero';
    if (formData.valor_unitario !== '' && Number(formData.valor_unitario) < 0) e.valor_unitario = 'Valor não pode ser negativo';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    if (editando) updateMutation.mutate({ id: editando.id, data: formData });
    else createMutation.mutate(formData);
  };

  const trintaDias = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; }, []);
  const episVencendo = epis.filter((e) => e.status === 'em_uso' && e.data_validade && new Date(e.data_validade) <= trintaDias);
  const emUso = epis.filter((e) => e.status === 'em_uso').length;
  const totalValor = epis.reduce((acc, e) => acc + ((e.valor_unitario || 0) * (e.quantidade || 1)), 0);

  const filtrados = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return epis.filter((e) => {
      const matchBusca = !q || (nomeColab[e.colaborador_id] || '').toLowerCase().includes(q) || (tipoEPIConfig[e.tipo_epi] || '').toLowerCase().includes(q);
      const matchStatus = statusFilter === 'todos' || e.status === statusFilter;
      return matchBusca && matchStatus;
    });
  }, [epis, searchTerm, statusFilter, nomeColab]);

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtrados, 20);
  const temFiltro = searchTerm || statusFilter !== 'todos';
  const ativos = (searchTerm ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0);
  const limparFiltros = () => { setSearchTerm(''); setStatusFilter('todos'); };

  return (
    <div className="space-y-6">
      <PageHeader title="Controle de EPIs" subtitle="Gestão de equipamentos de proteção" action={abrirNovo} actionLabel="Registrar EPI" actionIcon={Plus} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Total EPIs</div><div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{epis.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Em Uso</div><div className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums">{emUso}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Vencendo em 30 dias</div><div className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums">{episVencendo.length}</div></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Valor Total</div><div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(totalValor)}>{fmtCompactBRL(totalValor)}</div></CardContent></Card>
      </div>

      {/* Alerta de vencimento */}
      {episVencendo.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">{episVencendo.length} EPI(s) vencendo nos próximos 30 dias</p>
              {episVencendo.slice(0, 5).map((e) => (
                <p key={e.id} className="text-amber-700">• {nomeColab[e.colaborador_id]} — {tipoEPIConfig[e.tipo_epi]} — vence {dataBR(e.data_validade)}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filtros */}
      <FiltrosColapsaveis ativos={ativos} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{filtrados.length} EPI(s)</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Colaborador ou tipo de EPI..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
            <ComboboxBusca
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'em_uso', label: 'Em uso' },
                { value: 'devolvido', label: 'Devolvido' },
                { value: 'vencido', label: 'Vencido' },
                { value: 'extraviado', label: 'Extraviado' },
              ]}
              value={statusFilter}
              onSelect={(v) => setStatusFilter(v || 'todos')}
              placeholder="Todos"
              searchPlaceholder="Buscar status..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      {/* Lista */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={9} />
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum EPI</h3>
              <p className="text-sm text-gray-500 mb-5">{temFiltro ? 'Ajuste os filtros ou' : 'Registre a primeira entrega de EPI'}</p>
              <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2" />Registrar EPI</Button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((epi) => {
                  const vencido = epi.data_validade && new Date(epi.data_validade) < new Date();
                  const st = statusConfig[epi.status] || statusConfig.em_uso;
                  return (
                    <div key={epi.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{nomeColab[epi.colaborador_id] || '—'}</p>
                          <p className="text-sm text-gray-700">{tipoEPIConfig[epi.tipo_epi] || epi.tipo_epi}</p>
                          {epi.descricao && <p className="text-xs text-gray-500">{epi.descricao}</p>}
                          {epi.numero_ca && <p className="text-xs text-gray-400">CA: {epi.numero_ca}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Badge className={`border-0 ${st.color}`}>{st.label}</Badge>
                          {vencido && epi.status === 'em_uso' && <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        {nomeObra[epi.obra_id] && <div><span className="text-gray-400">Obra: </span>{nomeObra[epi.obra_id]}</div>}
                        <div><span className="text-gray-400">Entrega: </span>{dataBR(epi.data_entrega) || '—'}</div>
                        <div><span className="text-gray-400">Validade: </span><span className={vencido ? 'text-red-600 font-medium' : ''}>{dataBR(epi.data_validade) || '—'}</span></div>
                        <div><span className="text-gray-400">Qtd: </span>{epi.quantidade}</div>
                        <div><span className="text-gray-400">Valor: </span>{epi.valor_unitario ? fmtBRL(epi.valor_unitario * (epi.quantidade || 1)) : '—'}</div>
                      </div>
                      <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => abrirEditar(epi)}><Pencil className="w-4 h-4" /> Editar</Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setRegExcluir(epi)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Colaborador</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">EPI</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Entrega</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Validade</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Qtd</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((epi) => {
                      const vencido = epi.data_validade && new Date(epi.data_validade) < new Date();
                      const st = statusConfig[epi.status] || statusConfig.em_uso;
                      return (
                        <tr key={epi.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{nomeColab[epi.colaborador_id] || '—'}</td>
                          <td className="p-3"><p className="text-gray-800">{tipoEPIConfig[epi.tipo_epi] || epi.tipo_epi}</p>{epi.descricao && <p className="text-xs text-gray-500">{epi.descricao}</p>}{epi.numero_ca && <p className="text-xs text-gray-400">CA: {epi.numero_ca}</p>}</td>
                          <td className="p-3 text-gray-600">{nomeObra[epi.obra_id] || <span className="text-gray-400">—</span>}</td>
                          <td className="p-3 text-gray-600">{dataBR(epi.data_entrega) || '—'}</td>
                          <td className="p-3"><span className={vencido ? 'text-red-600 font-medium' : 'text-gray-600'}>{dataBR(epi.data_validade) || '—'}</span></td>
                          <td className="p-3 text-right text-gray-700">{epi.quantidade}</td>
                          <td className="p-3 text-right text-gray-700">{epi.valor_unitario ? fmtBRL(epi.valor_unitario * (epi.quantidade || 1)) : '—'}</td>
                          <td className="p-3"><div className="flex flex-wrap gap-1"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge>{vencido && epi.status === 'em_uso' && <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>}</div></td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => abrirEditar(epi)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => setRegExcluir(epi)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
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

      {/* Dialog registrar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditando(null); setFormData(VAZIO); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar EPI' : 'Registrar EPI'}</DialogTitle>
          </DialogHeader>
          {/* noValidate: a validação é a do `validar()` (mensagem no campo); sem isto o
              balão nativo do navegador barra o submit antes, fora do padrão do sistema. */}
          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Colaborador *</Label>
                <ComboboxBusca
                  options={colaboradores.filter((c) => (c.status || 'ativo') !== 'inativo').map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }))}
                  value={formData.colaborador_id}
                  onSelect={(v) => set('colaborador_id', v)}
                  placeholder="Selecione o colaborador"
                  searchPlaceholder="Buscar colaborador..."
                  emptyMessage="Nenhum colaborador."
                  className={errors.colaborador_id ? 'border-red-400' : ''}
                />
                {errors.colaborador_id && <p className="text-xs text-red-500 mt-1">{errors.colaborador_id}</p>}
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                <ComboboxBusca
                  options={obras.filter((o) => !['encerrada', 'cancelada'].includes(o.status)).map((o) => ({ value: o.id, label: o.nome }))}
                  value={formData.obra_id}
                  onSelect={(v) => set('obra_id', v)}
                  placeholder="Selecione a obra (opcional)"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra."
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Tipo de EPI *</Label>
                <Select value={formData.tipo_epi} onValueChange={(v) => set('tipo_epi', v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(tipoEPIConfig).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Descrição</Label>
                <Input className="h-11" value={formData.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex: Botina de couro nº 42" />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data Entrega *</Label>
                <Input type="date" className={`h-11 ${errors.data_entrega ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.data_entrega} onChange={(e) => { set('data_entrega', e.target.value); setErrors((p) => ({ ...p, data_validade: null })); }} />
                {errors.data_entrega && <p className="text-xs text-red-500 mt-1">{errors.data_entrega}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data Validade</Label>
                <Input type="date" className={`h-11 ${errors.data_validade ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.data_validade} onChange={(e) => set('data_validade', e.target.value)} />
                {errors.data_validade && <p className="text-xs text-red-500 mt-1">{errors.data_validade}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Número CA</Label>
                <Input className="h-11" value={formData.numero_ca} onChange={(e) => set('numero_ca', e.target.value)} placeholder="Ex: 12345" />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Quantidade *</Label>
                <Input type="number" min="1" className={`h-11 ${errors.quantidade ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.quantidade} onChange={(e) => set('quantidade', e.target.value)} />
                {errors.quantidade && <p className="text-xs text-red-500 mt-1">{errors.quantidade}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Valor Unitário (R$)</Label>
                <Input type="number" step="0.01" min="0" className={`h-11 ${errors.valor_unitario ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={formData.valor_unitario} onChange={(e) => set('valor_unitario', e.target.value)} placeholder="0,00" />
                {errors.valor_unitario && <p className="text-xs text-red-500 mt-1">{errors.valor_unitario}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                <Select value={formData.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_uso">Em uso</SelectItem>
                    <SelectItem value="devolvido">Devolvido</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="extraviado">Extraviado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={fechar} className="border-gray-300 text-gray-700">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : (editando ? 'Salvar' : 'Registrar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!regExcluir} onOpenChange={(o) => { if (!o) setRegExcluir(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Excluir EPI</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Excluir o registro de EPI {regExcluir && `(${tipoEPIConfig[regExcluir.tipo_epi]} — ${nomeColab[regExcluir.colaborador_id] || ''})`}? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => deleteMutation.mutate(regExcluir.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
