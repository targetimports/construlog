import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Pencil, Truck, ToggleLeft, ToggleRight, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

const EMPTY_FORM = {
  razao_social: '',
  cnpj: '',
  contato_nome: '',
  contato_tel: '',
  contato_email: '',
  endereco: '',
  ativo: true,
};

function formatCNPJ(v) {
  return v.replace(/\D/g, '')
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .slice(0, 18);
}

function FornecedorModal({ open, onClose, fornecedor }) {
  const qc = useQueryClient();
  const isEdit = !!fornecedor?.id;
  const [form, setForm] = useState(isEdit ? { ...fornecedor } : { ...EMPTY_FORM });
  const [errors, setErrors] = useState({});

  React.useEffect(() => {
    if (open) {
      setForm(isEdit ? { ...fornecedor } : { ...EMPTY_FORM });
      setErrors({});
    }
  }, [open, fornecedor?.id]);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const validate = () => {
    const e = {};
    if (!form.razao_social?.trim()) e.razao_social = 'Razão social é obrigatória';
    if (form.contato_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contato_email)) {
      e.contato_email = 'E-mail inválido';
    }
    // CNPJ é opcional, mas se preenchido tem de ter 14 dígitos.
    const cnpjDigitos = String(form.cnpj || '').replace(/\D/g, '');
    if (cnpjDigitos && cnpjDigitos.length !== 14) e.cnpj = 'CNPJ inválido (14 dígitos).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? base44.entities.Fornecedor.update(fornecedor.id, data)
      : base44.entities.Fornecedor.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fornecedores'] });
      toast.success(isEdit ? 'Fornecedor atualizado!' : 'Fornecedor criado!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const handleSave = () => {
    if (!validate()) { toast.error('Verifique os campos destacados.'); return; }
    mutation.mutate({ ...form, razao_social: form.razao_social.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Dados principais */}
          <div>
            <Label>Razão Social *</Label>
            <Input
              value={form.razao_social || ''}
              onChange={e => set('razao_social', e.target.value)}
              placeholder="Ex: Distribuidora ABC Ltda"
              className={errors.razao_social ? 'border-red-400' : ''}
            />
            {errors.razao_social && <p className="text-xs text-red-500 mt-1">{errors.razao_social}</p>}
          </div>
          <div>
            <Label>CNPJ <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input
              mask="cnpj"
              value={form.cnpj || ''}
              onChange={e => set('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
              maxLength={18}
              className={errors.cnpj ? 'border-red-400' : ''}
            />
            {errors.cnpj && <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>}
          </div>

          {/* Contato */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Contato (opcional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Nome do contato</Label>
              <Input value={form.contato_nome || ''} onChange={e => set('contato_nome', e.target.value)} placeholder="Ex: João Silva" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input mask="telefone" value={form.contato_tel || ''} onChange={e => set('contato_tel', e.target.value)} placeholder="(11) 9 9999-9999" />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              value={form.contato_email || ''}
              onChange={e => set('contato_email', e.target.value)}
              placeholder="contato@fornecedor.com"
              className={errors.contato_email ? 'border-red-400' : ''}
            />
            {errors.contato_email && <p className="text-xs text-red-500 mt-1">{errors.contato_email}</p>}
          </div>

          {/* Endereço */}
          <div>
            <Label>Endereço <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input value={form.endereco || ''} onChange={e => set('endereco', e.target.value)} placeholder="Rua, número, cidade - UF" />
          </div>

          {/* Ativo */}
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

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button className="w-full sm:flex-1" disabled={mutation.isPending} onClick={handleSave}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SuprimentosFornecedores() {
  const [busca, setBusca] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('ativos');
  const [modal, setModal] = useState({ open: false, fornecedor: null });
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => base44.entities.Fornecedor.list('razao_social', 5000),
  });

  const filtered = useMemo(() => fornecedores.filter((f) => {
    const matchBusca = !busca || f.razao_social?.toLowerCase().includes(busca.toLowerCase()) || f.cnpj?.includes(busca);
    const matchAtivo = filtroAtivo === 'todos' || (filtroAtivo === 'ativos' ? f.ativo !== false : f.ativo === false);
    return matchBusca && matchAtivo;
  }), [fornecedores, busca, filtroAtivo]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);
  const resetPagina = () => goToPage(1);

  const temFiltro = busca || filtroAtivo !== 'ativos';
  const qtdFiltros = [busca, filtroAtivo !== 'ativos'].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroAtivo('ativos'); resetPagina(); };

  const openCreate = () => setModal({ open: true, fornecedor: null });
  const openEdit = (f) => setModal({ open: true, fornecedor: f });
  const closeModal = () => setModal({ open: false, fornecedor: null });

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-sm text-gray-500">{fornecedores.length} fornecedores cadastrados</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"><Plus className="w-4 h-4" /> Novo Fornecedor</Button>
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
            <span className="text-xs text-gray-500">{filtered.length} fornecedor(es)</span>
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
                <div className="md:col-span-2">
                  <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className="pl-9 h-11" placeholder="Razão social ou CNPJ..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca
                    options={[{ value: 'todos', label: 'Todos' }, { value: 'ativos', label: 'Ativos' }, { value: 'inativos', label: 'Inativos' }]}
                    value={filtroAtivo}
                    onSelect={(v) => { setFiltroAtivo(v || 'ativos'); resetPagina(); }}
                    placeholder="Status"
                    searchPlaceholder="Buscar..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum fornecedor encontrado</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={openCreate}>Cadastrar primeiro fornecedor</Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Razão Social</th>
                      <th className="text-left p-3 font-semibold text-gray-600">CNPJ</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Contato</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Telefone</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map((f) => (
                      <tr key={f.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium text-gray-900">{f.razao_social}</td>
                        <td className="p-3 text-gray-400 font-mono text-xs">{f.cnpj || '—'}</td>
                        <td className="p-3 text-gray-600">{f.contato_nome || '—'}</td>
                        <td className="p-3 text-gray-500">{f.contato_tel || '—'}</td>
                        <td className="p-3">
                          <Badge className={`border-0 ${f.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {f.ativo !== false ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {paginatedItems.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg border border-gray-200 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 break-words">{f.razao_social}</p>
                      {f.cnpj && <p className="font-mono text-xs text-gray-400 mt-0.5">{f.cnpj}</p>}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500">
                        {(f.contato_nome || f.contato_tel) ? (
                          <>
                            {f.contato_nome && <span className="break-words">{f.contato_nome}</span>}
                            {f.contato_nome && f.contato_tel && <span className="text-gray-300">·</span>}
                            {f.contato_tel && <span>{f.contato_tel}</span>}
                          </>
                        ) : <span className="text-gray-400">Sem contato</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge className={`border-0 whitespace-nowrap ${f.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {f.ativo !== false ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => openEdit(f)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                    </div>
                  </div>
                ))}
              </div>

              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      <FornecedorModal open={modal.open} onClose={closeModal} fornecedor={modal.fornecedor} />
    </div>
  );
}