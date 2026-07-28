import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Database, Search, Upload, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { createPageUrl } from '@/utils';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const tipoConfig = {
  composicao: { label: 'Composição', color: 'bg-blue-600', text: 'text-blue-600' },
  insumo: { label: 'Insumo', color: 'bg-green-600', text: 'text-green-600' },
  mao_obra: { label: 'Mão de Obra', color: 'bg-amber-600', text: 'text-amber-600' },
  equipamento: { label: 'Equipamento', color: 'bg-purple-600', text: 'text-purple-600' },
};

const VAZIO = { codigo: '', descricao: '', tipo: 'insumo', unidade: '', preco_unitario: '', estado: 'BA', mes_referencia: '', desonerado: true };

export default function TabelaSINAPI() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [editId, setEditId] = useState(null);
  const [excluindo, setExcluindo] = useState(null); // item a confirmar exclusão

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ['tabela-sinapi'],
    queryFn: () => base44.entities.TabelaSINAPI.list('-created_date', 10000),
  });

  const estados = useMemo(() => [...new Set(itens.map((i) => i.estado).filter(Boolean))].sort(), [itens]);

  const itensFiltrados = useMemo(() => {
    const q = busca.toLowerCase();
    return itens.filter((item) => {
      const matchBusca = !q || item.descricao?.toLowerCase().includes(q) || String(item.codigo || '').toLowerCase().includes(q);
      const matchTipo = tipoFiltro === 'todos' || item.tipo === tipoFiltro;
      const matchEstado = !estadoFiltro || item.estado === estadoFiltro;
      return matchBusca && matchTipo && matchEstado;
    });
  }, [itens, busca, tipoFiltro, estadoFiltro]);

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(itensFiltrados, 20);
  const resetPagina = () => goToPage(1);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      if (!form.codigo || !form.descricao) throw new Error('Código e descrição são obrigatórios.');
      const payload = {
        codigo: String(form.codigo).trim(),
        codigo_sinapi: String(form.codigo).trim(),
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        unidade: form.unidade || '',
        preco_unitario: num(form.preco_unitario),
        estado: form.estado || '',
        mes_referencia: form.mes_referencia || '',
        desonerado: !!form.desonerado,
        fonte: 'SINAPI',
      };
      if (editId) return base44.entities.TabelaSINAPI.update(editId, payload);
      return base44.entities.TabelaSINAPI.create(payload);
    },
    onSuccess: () => {
      toast.success(editId ? 'Item atualizado' : 'Item criado');
      queryClient.invalidateQueries({ queryKey: ['tabela-sinapi'] });
      setModalOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.TabelaSINAPI.delete(id),
    onSuccess: () => {
      toast.success('Item excluído');
      queryClient.invalidateQueries({ queryKey: ['tabela-sinapi'] });
      setExcluindo(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const abrirNovo = () => { setForm(VAZIO); setEditId(null); setModalOpen(true); };
  const abrirEdicao = (item) => {
    setForm({
      codigo: item.codigo || '', descricao: item.descricao || '', tipo: item.tipo || 'insumo',
      unidade: item.unidade || '', preco_unitario: item.preco_unitario ?? '', estado: item.estado || '',
      mes_referencia: item.mes_referencia || '', desonerado: item.desonerado ?? true,
    });
    setEditId(item.id);
    setModalOpen(true);
  };

  const limparFiltros = () => { setBusca(''); setTipoFiltro('todos'); setEstadoFiltro(''); resetPagina(); };
  const temFiltro = busca || tipoFiltro !== 'todos' || estadoFiltro;

  return (
    <div className="space-y-6 pb-6">
      <PageHeader
        title="Tabela SINAPI"
        subtitle="Base de preços de referência (insumos e composições) para usar nos orçamentos"
        action={abrirNovo}
        actionLabel="Novo Item"
      />

      {/* Filtros */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="md:col-span-2">
              <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="Código ou descrição..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} className="pl-10" />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
              <ComboboxBusca
                options={[
                  { value: 'composicao', label: 'Composições' },
                  { value: 'insumo', label: 'Insumos' },
                  { value: 'mao_obra', label: 'Mão de Obra' },
                  { value: 'equipamento', label: 'Equipamentos' },
                ]}
                value={tipoFiltro === 'todos' ? '' : tipoFiltro}
                onSelect={(v) => { setTipoFiltro(v || 'todos'); resetPagina(); }}
                placeholder="Todos os tipos"
                searchPlaceholder="Buscar tipo..."
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Estado (UF)</Label>
              <ComboboxBusca
                options={estados.map((e) => ({ value: e, label: e }))}
                value={estadoFiltro}
                onSelect={(v) => { setEstadoFiltro(v); resetPagina(); }}
                placeholder="Todos os estados"
                searchPlaceholder="Buscar UF..."
              />
            </div>
          </div>
          {temFiltro && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-gray-500">{itensFiltrados.length} resultado(s)</span>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-700" onClick={limparFiltros}>Limpar filtros</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas (base completa) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(tipoConfig).map(([tipo, config]) => (
          <Card key={tipo} className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg ${config.color} bg-opacity-10 flex items-center justify-center`}>
                  <Database className={`w-6 h-6 ${config.text}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600">{config.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{itens.filter((i) => i.tipo === tipo).length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : itensFiltrados.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="p-12 text-center">
            <Database className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">{itens.length === 0 ? 'Nenhum item na tabela SINAPI.' : 'Nenhum item para os filtros aplicados.'}</p>
            {itens.length === 0 && (
              <Button variant="outline" className="mt-4 gap-2 border-gray-300 text-gray-700" onClick={() => navigate(createPageUrl('ImportarSINAPI'))}>
                <Upload className="w-4 h-4" /> Importar Base SINAPI
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pageItens.map((item) => (
            <Card key={item.id} className="bg-white border-gray-200 hover:border-gray-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={`${tipoConfig[item.tipo]?.color || 'bg-gray-600'} text-white border-0`}>{tipoConfig[item.tipo]?.label || item.tipo}</Badge>
                      <span className="text-gray-500 font-mono text-sm">{item.codigo}</span>
                      {item.estado && <Badge variant="outline" className="border-gray-300 text-gray-600">{item.estado}</Badge>}
                      {item.desonerado && <Badge className="bg-green-100 text-green-700 border-0">Desonerado</Badge>}
                    </div>
                    <p className="text-gray-900 font-medium mb-1">{item.descricao}</p>
                    {item.mes_referencia && <p className="text-gray-500 text-sm">Referência: {item.mes_referencia}</p>}
                  </div>
                  <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:text-right shrink-0">
                    <div className="sm:text-right">
                      <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums break-words">{fmtBRL(item.preco_unitario)}</p>
                      <p className="text-gray-500 text-sm">por {item.unidade || '—'}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-600" onClick={() => abrirEdicao(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-600" onClick={() => setExcluindo(item)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Paginação */}
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
        </div>
      )}

      {/* Modal CRUD */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Editar Item SINAPI' : 'Novo Item SINAPI'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600">Código</Label>
              <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="composicao">Composição</SelectItem>
                  <SelectItem value="insumo">Insumo</SelectItem>
                  <SelectItem value="mao_obra">Mão de Obra</SelectItem>
                  <SelectItem value="equipamento">Equipamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs text-gray-600">Descrição</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Unidade</Label>
              <Input value={form.unidade} onChange={(e) => setForm({ ...form, unidade: e.target.value })} className="mt-1" placeholder="UN, M², H..." />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Preço Unitário (R$)</Label>
              <Input type="number" step="0.01" value={form.preco_unitario} onChange={(e) => setForm({ ...form, preco_unitario: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Estado (UF)</Label>
              <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase().slice(0, 2) })} className="mt-1" maxLength={2} />
            </div>
            <div>
              <Label className="text-xs text-gray-600">Mês de Referência</Label>
              <Input value={form.mes_referencia} onChange={(e) => setForm({ ...form, mes_referencia: e.target.value })} className="mt-1" placeholder="12/2024" />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
              <Button type="button" variant={form.desonerado ? 'default' : 'outline'} size="sm" className={form.desonerado ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700'} onClick={() => setForm({ ...form, desonerado: true })}>Desonerado</Button>
              <Button type="button" variant={!form.desonerado ? 'default' : 'outline'} size="sm" className={!form.desonerado ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-300 text-gray-700'} onClick={() => setForm({ ...form, desonerado: false })}>Não Desonerado</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {salvarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!excluindo} onOpenChange={() => setExcluindo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir item</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">Tem certeza que deseja excluir <strong>{excluindo?.codigo}</strong> — {excluindo?.descricao}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluindo(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={() => excluirMutation.mutate(excluindo.id)} disabled={excluirMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2">
              {excluirMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
