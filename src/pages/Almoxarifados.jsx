import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Warehouse, Plus, Edit, Eye, Package, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { ListSkeleton } from '@/components/shared/Skeletons';

// Estoque em 3 níveis: Central (Matriz) → Empresa → Obra.
const NIVEL_LABELS = {
  CENTRAL: { label: 'Central (Matriz)', color: 'bg-blue-100 text-blue-700', icon: 'bg-blue-100 text-blue-600' },
  EMPRESA: { label: 'Empresa', color: 'bg-purple-100 text-purple-700', icon: 'bg-purple-100 text-purple-600' },
  OBRA: { label: 'Obra', color: 'bg-green-100 text-green-700', icon: 'bg-green-100 text-green-600' },
};
const nivelDe = (l) => l.nivel || l.tipo || 'OBRA';

// emModal: renderizado dentro de um Dialog (o título vem do DialogTitle).
export default function Almoxarifados({ emModal = false }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nome: '', nivel: 'OBRA', empresa_id: '', obra_id: '', responsavel: '' });
  const [errors, setErrors] = useState({});
  const [busca, setBusca] = useState('');
  const [verInativos, setVerInativos] = useState(false);

  const queryClient = useQueryClient();
  const { membros, acessoGlobal } = useEmpresa();

  const { data: locais = [], isLoading } = useQuery({
    queryKey: ['local-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-almox'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000),
  });

  const obraMap = useMemo(() => {
    const m = {};
    obras.forEach((o) => { m[o.id] = o; });
    return m;
  }, [obras]);

  const empresaMap = useMemo(() => {
    const m = {};
    (membros || []).forEach((e) => { m[e.id] = e; });
    return m;
  }, [membros]);

  const resetForm = () => setForm({ nome: '', nivel: 'OBRA', empresa_id: '', obra_id: '', responsavel: '' });

  const saveMutation = useMutation({
    mutationFn: (data) => editItem
      ? base44.entities.LocalEstoque.update(editItem.id, data)
      : base44.entities.LocalEstoque.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['local-estoque']);
      toast.success(editItem ? 'Almoxarifado atualizado!' : 'Almoxarifado criado!');
      setDialogOpen(false);
      setEditItem(null);
      resetForm();
    },
  });

  const toggleAtivoMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.LocalEstoque.update(id, { ativo }),
    onSuccess: () => queryClient.invalidateQueries(['local-estoque']),
  });

  const locaisAtivos = locais.filter((l) => l.ativo !== false);
  const locaisInativos = locais.filter((l) => l.ativo === false);

  const filtra = (arr) => {
    const q = busca.trim().toLowerCase();
    if (!q) return arr;
    return arr.filter((l) =>
      (l.nome || '').toLowerCase().includes(q) ||
      (l.responsavel || '').toLowerCase().includes(q) ||
      (obraMap[l.obra_id]?.nome || '').toLowerCase().includes(q) ||
      (empresaMap[l.empresa_id]?.nome || '').toLowerCase().includes(q));
  };
  const ativosFiltrados = filtra(locaisAtivos);
  const inativosFiltrados = filtra(locaisInativos);

  const handleOpenDialog = (item = null) => {
    setEditItem(item);
    setForm(item
      ? { nome: item.nome, nivel: nivelDe(item), empresa_id: item.empresa_id || '', obra_id: item.obra_id || '', responsavel: item.responsavel || '' }
      : { nome: '', nivel: 'OBRA', empresa_id: '', obra_id: '', responsavel: '' });
    setErrors({});
    setDialogOpen(true);
  };

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório';
    else {
      // Nome duplicado no mesmo vínculo já causou almoxarifado órfão sumindo material.
      const duplicado = locais.some((l) =>
        l.id !== editItem?.id &&
        String(l.nome || '').trim().toLowerCase() === form.nome.trim().toLowerCase() &&
        (l.obra_id || null) === (form.nivel === 'OBRA' ? form.obra_id : null));
      if (duplicado) e.nome = 'Já existe um almoxarifado com esse nome neste vínculo';
    }
    if (form.nivel === 'OBRA' && !form.obra_id) e.obra_id = 'Selecione uma obra';
    if (form.nivel === 'EMPRESA' && !form.empresa_id) e.empresa_id = 'Selecione a empresa';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    const obraSelecionada = form.obra_id ? obraMap[form.obra_id] : null;
    // empresa_id: EMPRESA→escolhida; OBRA→a da obra; CENTRAL→matriz (deixa o backend/seed).
    const empresaId = form.nivel === 'EMPRESA' ? form.empresa_id
      : form.nivel === 'OBRA' ? (obraSelecionada?.empresa_id || null)
        : null;
    saveMutation.mutate({
      nome: form.nome.trim(),
      nivel: form.nivel,
      tipo: form.nivel, // compat: `tipo` sempre espelha o `nivel` (CENTRAL/EMPRESA/OBRA) p/ filtros do front que usam tipo
      empresa_id: empresaId,
      obra_id: form.nivel === 'OBRA' ? form.obra_id : null,
      obra_nome: obraSelecionada?.nome || null,
      responsavel: form.responsavel || null,
      ativo: true,
    });
  };

  const cont = (nv) => locais.filter((l) => nivelDe(l) === nv).length;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {!emModal && <h1 className="text-2xl font-bold text-gray-900">Almoxarifados</h1>}
          <p className="text-gray-500 text-sm mt-1 hidden sm:block">Locais de estoque em 3 níveis: Central (Matriz) · Empresa · Obra</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {!emModal && <Link to={createPageUrl('SaldoEstoque')}>
            <Button variant="outline" className="gap-2">
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">Ver Saldos</span>
            </Button>
          </Link>}
          <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Almoxarifado</span>
            <span className="sm:hidden">Novo</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <Card><CardContent className="p-3 sm:p-4 flex flex-col"><p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{locais.length}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Total</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 flex flex-col"><p className="text-2xl sm:text-3xl font-bold text-blue-600 tabular-nums">{cont('CENTRAL')}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Central</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 flex flex-col"><p className="text-2xl sm:text-3xl font-bold text-purple-600 tabular-nums">{cont('EMPRESA')}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Empresa</p></CardContent></Card>
        <Card><CardContent className="p-3 sm:p-4 flex flex-col"><p className="text-2xl sm:text-3xl font-bold text-green-600 tabular-nums">{cont('OBRA')}</p><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase leading-tight mt-1">Obra</p></CardContent></Card>
      </div>

      {/* Busca */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, empresa, obra ou responsável..." />
            </div>
            {busca && <Button variant="ghost" size="sm" className="h-9 text-xs text-gray-500 hover:text-gray-700" onClick={() => setBusca('')}>Limpar filtros</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Listagem — lista única. Só aparece a opção de inativos SE existir algum
          (evita confundir com uma "seção" separada quando não há inativos). */}
      <div className="space-y-3">
        {locaisInativos.length > 0 && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => setVerInativos((v) => !v)}>
              {verInativos ? '← Voltar aos ativos' : `Ver inativos (${locaisInativos.length})`}
            </Button>
          </div>
        )}
        {isLoading ? (
          <ListSkeleton rows={6} />
        ) : verInativos ? (
          <ListaPaginada
            itens={inativosFiltrados}
            obraMap={obraMap}
            empresaMap={empresaMap}
            onEdit={handleOpenDialog}
            onToggleAtivo={(id) => toggleAtivoMutation.mutate({ id, ativo: true })}
            inativo
            emptyMsg={busca ? 'Nenhum inativo encontrado para a busca.' : 'Nenhum inativo.'}
          />
        ) : (
          <ListaPaginada
            itens={ativosFiltrados}
            obraMap={obraMap}
            empresaMap={empresaMap}
            onEdit={handleOpenDialog}
            onToggleAtivo={(id) => toggleAtivoMutation.mutate({ id, ativo: false })}
            emptyMsg={busca ? 'Nenhum almoxarifado encontrado para a busca.' : 'Nenhum almoxarifado cadastrado. Clique em "Novo Almoxarifado" para começar.'}
          />
        )}
      </div>

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Editar Almoxarifado' : 'Novo Almoxarifado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nível *</label>
              <Select value={form.nivel} onValueChange={(v) => { setForm((f) => ({ ...f, nivel: v, obra_id: '', empresa_id: '' })); setErrors((p) => ({ ...p, obra_id: null, empresa_id: null })); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {acessoGlobal && <SelectItem value="CENTRAL">Central (Matriz)</SelectItem>}
                  <SelectItem value="EMPRESA">Empresa</SelectItem>
                  <SelectItem value="OBRA">Obra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Nome *</label>
              <Input
                value={form.nome}
                onChange={(e) => set('nome', e.target.value)}
                placeholder="Ex: Almoxarifado Central, Almox Obra 145..."
                className={errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
            </div>

            {form.nivel === 'EMPRESA' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Empresa *</label>
                <ComboboxBusca
                  options={(membros || []).map((e) => ({ value: e.id, label: e.nome }))}
                  value={form.empresa_id}
                  onSelect={(v) => set('empresa_id', v)}
                  placeholder="Selecionar empresa..."
                  searchPlaceholder="Buscar empresa..."
                  emptyMessage="Nenhuma empresa."
                  className={errors.empresa_id ? 'border-red-400' : ''}
                />
                {errors.empresa_id && <p className="text-xs text-red-500 mt-1">{errors.empresa_id}</p>}
              </div>
            )}

            {form.nivel === 'OBRA' && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Obra *</label>
                <ComboboxBusca
                  options={obras.filter((o) => o.status !== 'cancelada').map((o) => ({ value: o.id, label: o.nome }))}
                  value={form.obra_id}
                  onSelect={(v) => set('obra_id', v)}
                  placeholder="Selecionar obra..."
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra."
                  className={errors.obra_id ? 'border-red-400' : ''}
                />
                {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Responsável</label>
              <Input
                value={form.responsavel}
                onChange={(e) => set('responsavel', e.target.value)}
                placeholder="Nome do responsável..."
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {saveMutation.isPending ? 'Salvando...' : (editItem ? 'Atualizar' : 'Criar')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Vínculo textual do almoxarifado (Empresa X / Obra: Y / —).
function vinculoDe(local, obraMap, empresaMap) {
  const nv = nivelDe(local);
  const empresaVinc = local.empresa_id ? empresaMap[local.empresa_id] : null;
  const obraVinc = local.obra_id ? obraMap[local.obra_id] : null;
  if (nv === 'EMPRESA' && empresaVinc) return empresaVinc.nome;
  if (obraVinc) return `Obra: ${obraVinc.nome}`;
  return '—';
}

function ListaPaginada({ itens, obraMap, empresaMap, onEdit, onToggleAtivo, inativo = false, emptyMsg }) {
  const [pagina, setPagina] = useState(1);
  const PER_PAGE = 15;
  React.useEffect(() => { setPagina(1); }, [itens.length]);

  if (itens.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-400">{emptyMsg}</CardContent>
      </Card>
    );
  }

  const totalPaginas = Math.max(1, Math.ceil(itens.length / PER_PAGE));
  const pag = Math.min(pagina, totalPaginas);
  const pageItens = itens.slice((pag - 1) * PER_PAGE, pag * PER_PAGE);

  return (
    <Card className="bg-white border-gray-200">
      <CardContent className="p-0">
        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left p-3 font-semibold text-gray-600">Nome</th>
                <th className="text-left p-3 font-semibold text-gray-600">Nível</th>
                <th className="text-left p-3 font-semibold text-gray-600">Vínculo</th>
                <th className="text-left p-3 font-semibold text-gray-600">Responsável</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageItens.map((local) => {
                const nv = nivelDe(local);
                const cfg = NIVEL_LABELS[nv] || { label: nv, color: 'bg-gray-100 text-gray-700', icon: 'bg-gray-100 text-gray-600' };
                return (
                  <tr key={local.id} className={`hover:bg-gray-50 ${inativo ? 'opacity-60' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.icon}`}><Warehouse className="w-4 h-4" /></div>
                        <span className="font-medium text-gray-900">{local.nome}</span>
                      </div>
                    </td>
                    <td className="p-3"><Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge></td>
                    <td className="p-3 text-gray-600 text-xs">{vinculoDe(local, obraMap, empresaMap)}</td>
                    <td className="p-3 text-gray-600 text-xs">{local.responsavel || '—'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Link to={`${createPageUrl('SaldoEstoque')}?almox_id=${local.id}`}>
                          <Button variant="ghost" size="icon" title="Ver saldos"><Eye className="w-4 h-4 text-gray-500" /></Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => onEdit(local)} title="Editar"><Edit className="w-4 h-4 text-gray-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => onToggleAtivo(local.id)} className={inativo ? 'text-green-600 hover:text-green-700' : 'text-red-500 hover:text-red-600'}>
                          {inativo ? 'Ativar' : 'Desativar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden flex flex-col gap-y-2 p-2">
          {pageItens.map((local) => (
            <AlmoxCard key={local.id} local={local} obraMap={obraMap} empresaMap={empresaMap} onEdit={onEdit} onToggleAtivo={onToggleAtivo} inativo={inativo} />
          ))}
        </div>

        {itens.length > PER_PAGE && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 border-t border-gray-200">
            <span className="text-xs text-gray-500">Mostrando {(pag - 1) * PER_PAGE + 1}–{Math.min(pag * PER_PAGE, itens.length)} de {itens.length}</span>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <Button variant="outline" size="sm" disabled={pag <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
              <span className="text-xs text-gray-600 whitespace-nowrap">Página {pag} de {totalPaginas}</span>
              <Button variant="outline" size="sm" disabled={pag >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Card compacto usado só no mobile (o desktop usa a tabela acima).
function AlmoxCard({ local, obraMap, empresaMap, onEdit, onToggleAtivo, inativo = false }) {
  const nv = nivelDe(local);
  const cfg = NIVEL_LABELS[nv] || { label: nv, color: 'bg-gray-100 text-gray-700', icon: 'bg-gray-100 text-gray-600' };
  const meta = [
    nv === 'EMPRESA' && local.empresa_id ? empresaMap[local.empresa_id]?.nome : null,
    local.obra_id && obraMap[local.obra_id] ? `Obra: ${obraMap[local.obra_id].nome}` : null,
    local.responsavel ? `Resp: ${local.responsavel}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className={`p-3 rounded-lg border border-gray-200 ${inativo ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.icon}`}>
          <Warehouse className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 break-words">{local.nome}</span>
            <Badge className={`${cfg.color} border-0 text-xs`}>{cfg.label}</Badge>
            {inativo && <Badge className="bg-red-100 text-red-700 border-0 text-xs">Inativo</Badge>}
          </div>
          <div className="text-xs text-gray-500 mt-1 break-words">
            {meta || <span className="italic">Sem responsável</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-gray-100">
        <Link to={`${createPageUrl('SaldoEstoque')}?almox_id=${local.id}`}>
          <Button variant="ghost" size="icon" title="Ver saldos"><Eye className="w-4 h-4 text-gray-500" /></Button>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => onEdit(local)}><Edit className="w-4 h-4 text-gray-500" /></Button>
        <Button variant="ghost" size="sm" onClick={() => onToggleAtivo(local.id)} className={inativo ? 'text-green-600 hover:text-green-700' : 'text-red-500 hover:text-red-600'}>
          {inativo ? 'Ativar' : 'Desativar'}
        </Button>
      </div>
    </div>
  );
}
