import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Package, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

const UNIDADES = ['UN', 'KG', 'M', 'M2', 'M3', 'L', 'SC', 'CX', 'T', 'PC', 'GL', 'ROL', 'OUTRO'];

const CATEGORIAS = [
  'Cimento e Argamassa',
  'Ferragem e Aço',
  'Madeira e Compensado',
  'Elétrica',
  'Hidráulica',
  'Alvenaria e Blocos',
  'Impermeabilização',
  'Pintura',
  'Revestimento',
  'Vidros e Esquadrias',
  'EPI e Segurança',
  'Ferramentas',
  'Outros',
];

const EMPTY_FORM = { codigo: '', nome: '', categoria: '', unidade: 'UN', ativo: true };

function MaterialModal({ open, onClose, material }) {
  const qc = useQueryClient();
  const isEdit = !!material?.id;
  const [form, setForm] = useState(isEdit ? { ...material } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setForm(isEdit ? { ...material } : { ...EMPTY_FORM });
      setErrors({});
    }
  }, [open, material?.id]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.nome?.trim()) e.nome = 'Nome é obrigatório';
    if (!form.unidade) e.unidade = 'Unidade é obrigatória';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.Material.update(material.id, data)
      : base44.entities.Material.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materiais'] });
      toast.success(isEdit ? 'Material atualizado!' : 'Material criado!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSave = () => {
    if (!validate()) return;
    mutation.mutate({ ...form, nome: form.nome.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Material' : 'Novo Material'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Código / SKU <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input value={form.codigo || ''} onChange={e => set('codigo', e.target.value)} placeholder="Ex: CIM-001" />
          </div>
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.nome || ''}
              onChange={e => set('nome', e.target.value)}
              placeholder="Ex: Cimento CP-II 50kg"
              className={errors.nome ? 'border-red-400' : ''}
            />
            {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade} onValueChange={v => set('unidade', v)}>
                <SelectTrigger className={errors.unidade ? 'border-red-400' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.unidade && <p className="text-xs text-red-500 mt-1">{errors.unidade}</p>}
            </div>
            <div>
              <Label>Categoria <span className="text-gray-400 font-normal">(opcional)</span></Label>
              <Select value={form.categoria || '__none'} onValueChange={v => set('categoria', v === '__none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Sem categoria —</SelectItem>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => set('ativo', !form.ativo)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700"
            >
              {form.ativo
                ? <ToggleRight className="w-6 h-6 text-green-500" />
                : <ToggleLeft className="w-6 h-6 text-gray-400" />}
              {form.ativo ? 'Ativo' : 'Inativo'}
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" disabled={mutation.isPending} onClick={handleSave}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const POR_PAGINA = 15;

export default function SuprimentosMateriais() {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('todos');
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState({ open: false, material: null });

  const { data: materiais = [], isLoading } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list('nome', 5000),
  });

  const resetPagina = () => setPagina(1);

  const filtered = useMemo(() => materiais.filter((m) => {
    const matchBusca = !busca || m.nome?.toLowerCase().includes(busca.toLowerCase()) || m.codigo?.toLowerCase().includes(busca.toLowerCase());
    const matchCat = !filtroCategoria || m.categoria === filtroCategoria;
    const matchAtivo = filtroAtivo === 'todos' || (filtroAtivo === 'ativos' ? m.ativo !== false : m.ativo === false);
    return matchBusca && matchCat && matchAtivo;
  }), [materiais, busca, filtroCategoria, filtroAtivo]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const pageItens = filtered.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);

  const temFiltro = busca || filtroCategoria || filtroAtivo !== 'todos';
  const limpar = () => { setBusca(''); setFiltroCategoria(''); setFiltroAtivo('todos'); resetPagina(); };

  const openCreate = () => setModal({ open: true, material: null });
  const openEdit = (m) => setModal({ open: true, material: m });
  const closeModal = () => setModal({ open: false, material: null });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materiais</h1>
          <p className="text-sm text-gray-500">{materiais.length} materiais cadastrados</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4" /> Novo Material</Button>
      </div>

      {/* Filtros */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-9 h-11" placeholder="Nome ou código..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Categoria</Label>
              <Select value={filtroCategoria || '__all'} onValueChange={(v) => { setFiltroCategoria(v === '__all' ? '' : v); resetPagina(); }}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Todas categorias" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">Todas categorias</SelectItem>
                  {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <Select value={filtroAtivo} onValueChange={(v) => { setFiltroAtivo(v); resetPagina(); }}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                  <SelectItem value="inativos">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{filtered.length} material(is)</span>
            {temFiltro && <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-500 hover:text-gray-700" onClick={limpar}>Limpar filtros</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum material encontrado</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={openCreate}>Cadastrar primeiro material</Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Código</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Nome</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Categoria</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Unidade</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((m) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-400 font-mono text-xs">{m.codigo || '—'}</td>
                        <td className="p-3 font-medium text-gray-900">{m.nome}</td>
                        <td className="p-3 text-gray-500">{m.categoria || '—'}</td>
                        <td className="p-3"><Badge variant="outline" className="border-gray-300 text-gray-600">{m.unidade}</Badge></td>
                        <td className="p-3">
                          <Badge className={`border-0 ${m.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {m.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Paginação */}
              <div className="flex items-center justify-between gap-3 p-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">Mostrando {(pagAtual - 1) * POR_PAGINA + 1}–{Math.min(pagAtual * POR_PAGINA, filtered.length)} de {filtered.length}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                  <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
                  <Button variant="outline" size="sm" disabled={pagAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <MaterialModal open={modal.open} onClose={closeModal} material={modal.material} />
    </div>
  );
}