import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Search, Pencil, ShieldCheck, ShieldOff, Loader2, KeyRound, Globe } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ROLES, ROLE_BY_VALUE } from '@/components/shared/roles';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VAZIO = { full_name: '', email: '', role: 'operacional', password: '', status: 'ativo', empresa_id: '', acesso_global: false };

function UsuarioModal({ open, onClose, usuario }) {
  const qc = useQueryClient();
  const isEdit = !!usuario?.id;
  const [form, setForm] = useState(VAZIO);
  const [errors, setErrors] = useState({});

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    setForm(isEdit
      ? { full_name: usuario.full_name || '', email: usuario.email || '', role: usuario.role || 'operacional', password: '', status: usuario.status || 'ativo', empresa_id: usuario.empresa_id || '', acesso_global: usuario.acesso_global === true }
      : VAZIO);
    setErrors({});
  }, [open, usuario?.id]);

  const set = (k, v) => { setForm((p) => ({ ...p, [k]: v })); if (errors[k]) setErrors((p) => ({ ...p, [k]: null })); };

  const validar = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Nome é obrigatório';
    if (!isEdit && !EMAIL_RE.test(form.email)) e.email = 'E-mail válido é obrigatório';

    // Senha: obrigatória no cadastro; na edição só é validada se o campo foi preenchido
    // (em branco = manter a atual). Mesmo mínimo do "Alterar senha" do perfil.
    if (!isEdit || form.password) {
      if ((form.password || '').length < 6) e.password = 'Senha mínima de 6 caracteres';
    }

    if (!form.role) e.role = 'Selecione o perfil de acesso';

    // Acesso global já dá acesso a tudo: prender a uma empresa é contraditório e
    // confunde quem lê o cadastro depois.
    if (form.acesso_global && form.empresa_id) {
      e.empresa_id = 'Com acesso global, deixe a empresa como "Nenhuma".';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const patch = { full_name: form.full_name.trim(), role: form.role, status: form.status, empresa_id: form.empresa_id || null, acesso_global: form.acesso_global === true };
        if (form.password) patch.password = form.password;
        return base44.entities.User.update(usuario.id, patch);
      }
      return base44.entities.User.create({
        email: form.email.toLowerCase().trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        status: 'ativo',
        empresa_id: form.empresa_id || null,
        acesso_global: form.acesso_global === true,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success(isEdit ? 'Usuário atualizado!' : 'Usuário criado!'); onClose(); },
    onError: (err) => {
      const msg = String(err?.detail?.error || err?.message || '');
      // E-mail repetido é erro de campo: destaca o input em vez de só avisar no canto.
      if (/email/i.test(msg) && /uso|exist|duplic/i.test(msg)) {
        setErrors((p) => ({ ...p, email: 'Este e-mail já está em uso.' }));
        toast.error('Este e-mail já está em uso.');
        return;
      }
      toast.error('Erro: ' + msg);
    },
  });

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600">Nome completo *</Label>
            <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={`mt-1 ${errors.full_name ? 'border-red-400' : ''}`} />
            {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-600">E-mail (login) *</Label>
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} disabled={isEdit} className={`mt-1 ${errors.email ? 'border-red-400' : ''} ${isEdit ? 'bg-gray-50' : ''}`} placeholder="usuario@empresa.com" />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            {isEdit && <p className="text-[11px] text-gray-400 mt-1">O e-mail (login) não pode ser alterado.</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-600">Perfil de acesso *</Label>
            <div className="mt-1">
              <ComboboxBusca
                options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                value={form.role}
                onSelect={(v) => set('role', v || 'operacional')}
                placeholder="Selecione o perfil"
                searchPlaceholder="Buscar perfil..."
                className={errors.role ? 'border-red-400' : ''}
              />
            </div>
            {errors.role
              ? <p className="text-xs text-red-500 mt-1">{errors.role}</p>
              : <p className="text-[11px] text-gray-400 mt-1">{ROLE_BY_VALUE[form.role]?.descricao}</p>}
          </div>
          <div>
            <Label className="text-xs text-gray-600">Empresa</Label>
            <div className="mt-1">
              <ComboboxBusca
                options={[{ value: '__none', label: '— Nenhuma (Matriz / Global) —' }, ...empresas.filter((e) => e.nome || e.nome_fantasia || e.razao_social).map((e) => ({ value: e.id, label: e.nome || e.nome_fantasia || e.razao_social }))]}
                value={form.empresa_id || '__none'}
                onSelect={(v) => set('empresa_id', v === '__none' ? '' : v)}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
                className={errors.empresa_id ? 'border-red-400' : ''}
              />
            </div>
            {errors.empresa_id
              ? <p className="text-xs text-red-500 mt-1">{errors.empresa_id}</p>
              : <p className="text-[11px] text-gray-400 mt-1">Empresa do grupo em que o usuário trabalha. Deixe "Nenhuma" para acesso global/matriz.</p>}
          </div>

          {/* ACESSO GLOBAL — vê os dados de TODAS as empresas do grupo.
              O privilégio fica na PESSOA, não no cargo: um financeiro novo nasce
              restrito à empresa dele até alguém marcar aqui. É o caso do financeiro
              da Central, que responde pelo grupo inteiro. */}
          <div className="rounded-lg border border-gray-200 p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={!!form.acesso_global}
                onCheckedChange={(v) => { set('acesso_global', v === true); setErrors((p) => ({ ...p, empresa_id: null })); }}
                className="mt-0.5"
              />
              <span>
                <span className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  Acesso global (todas as empresas do grupo)
                </span>
                <span className="block text-[11px] text-gray-500 mt-0.5">
                  Enxerga obras, financeiro e relatórios de <strong>todas</strong> as empresas, não só da
                  empresa acima. Use para quem responde pelo grupo (ex.: o financeiro da Central).
                  Sem isto, o usuário fica restrito à própria empresa.
                </span>
              </span>
            </label>
            {form.acesso_global && (
              <p className="text-[11px] text-indigo-700 mt-2 pl-7">
                Passa a ver os dados de todas as empresas. Só marque para quem realmente responde pelo grupo.
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-gray-600 flex items-center gap-1"><KeyRound className="w-3 h-3" /> {isEdit ? 'Nova senha (opcional)' : 'Senha inicial *'}</Label>
            <Input type="text" value={form.password} onChange={(e) => set('password', e.target.value)} className={`mt-1 ${errors.password ? 'border-red-400' : ''}`} placeholder={isEdit ? 'Deixe em branco para manter' : 'Senha de acesso'} />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>
          {isEdit && (
            <div>
              <Label className="text-xs text-gray-600">Situação</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={[
                    { value: 'ativo', label: 'Ativo' },
                    { value: 'inativo', label: 'Inativo (bloqueia login)' },
                  ]}
                  value={form.status}
                  onSelect={(v) => set('status', v || 'ativo')}
                  placeholder="Situação"
                  searchPlaceholder="Buscar..."
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={salvar} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Usuarios() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroRole, setFiltroRole] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos');
  const [modal, setModal] = useState({ open: false, usuario: null });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list('-created_date', 1000),
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => []),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }) => base44.entities.User.update(id, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); toast.success('Situação alterada.'); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return usuarios.filter((u) => {
      const matchBusca = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      const matchRole = filtroRole === 'todos' || u.role === filtroRole;
      const ativo = (u.status || 'ativo') !== 'inativo';
      const matchStatus = filtroStatus === 'todos' || (filtroStatus === 'ativos' ? ativo : !ativo);
      const matchEmpresa = filtroEmpresa === 'todos' ||
                         (filtroEmpresa === '__none' ? !u.empresa_id : u.empresa_id === filtroEmpresa);
      return matchBusca && matchRole && matchStatus && matchEmpresa;
    });
  }, [usuarios, busca, filtroRole, filtroStatus, filtroEmpresa]);

  const empresaNome = (id) => {
    const e = empresas.find((x) => x.id === id);
    return e?.nome || e?.nome_fantasia || e?.razao_social || null;
  };
  const empresaOptions = useMemo(() => {
    const ids = [...new Set(usuarios.map((u) => u.empresa_id).filter(Boolean))];
    const opts = ids.map((id) => ({ value: id, label: empresaNome(id) || 'Empresa' })).sort((a, b) => a.label.localeCompare(b.label));
    const temSemEmpresa = usuarios.some((u) => !u.empresa_id);
    return [
      { value: 'todos', label: 'Todas as empresas' },
      ...opts,
      ...(temSemEmpresa ? [{ value: '__none', label: 'Sem empresa (Matriz / Global)' }] : []),
    ];
  }, [usuarios, empresas]);

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtrados, 20);
  const ativosFiltro = (busca ? 1 : 0) + (filtroRole !== 'todos' ? 1 : 0) + (filtroStatus !== 'todos' ? 1 : 0) + (filtroEmpresa !== 'todos' ? 1 : 0);
  const limparFiltros = () => { setBusca(''); setFiltroRole('todos'); setFiltroStatus('todos'); setFiltroEmpresa('todos'); };

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">{usuarios.length} usuários cadastrados</p>
        </div>
        <Button onClick={() => setModal({ open: true, usuario: null })} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4" /> Novo Usuário</Button>
      </div>

      {/* Filtros */}
      <FiltrosColapsaveis ativos={ativosFiltro} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{filtrados.length} usuário(s)</span>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input className="pl-9 h-11" placeholder="Nome ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Perfil</Label>
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todos os perfis' }, ...ROLES.map((r) => ({ value: r.value, label: r.label }))]}
              value={filtroRole}
              onSelect={(v) => setFiltroRole(v || 'todos')}
              placeholder="Todos os perfis" searchPlaceholder="Buscar perfil..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Empresa</Label>
            <ComboboxBusca
              options={empresaOptions}
              value={filtroEmpresa}
              onSelect={(v) => setFiltroEmpresa(v || 'todos')}
              placeholder="Todas as empresas" searchPlaceholder="Buscar empresa..."
            />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Situação</Label>
            <ComboboxBusca
              options={[
                { value: 'todos', label: 'Todas' },
                { value: 'ativos', label: 'Ativos' },
                { value: 'inativos', label: 'Inativos' },
              ]}
              value={filtroStatus}
              onSelect={(v) => setFiltroStatus(v || 'todos')}
              placeholder="Todas" searchPlaceholder="Buscar..."
            />
          </div>
        </div>
      </FiltrosColapsaveis>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtrados.length === 0 ? (
            <p className="text-center py-12 text-gray-400">Nenhum usuário encontrado.</p>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((u) => {
                  const r = ROLE_BY_VALUE[u.role];
                  const ativo = (u.status || 'ativo') !== 'inativo';
                  return (
                    <div key={u.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{u.full_name || '—'}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                        {ativo ? <Badge className="bg-green-100 text-green-700 border-0 flex-shrink-0">Ativo</Badge> : <Badge className="bg-gray-100 text-gray-500 border-0 flex-shrink-0">Inativo</Badge>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={`border-0 ${r?.color || 'bg-gray-100 text-gray-600'}`}>{r?.label || u.role || '—'}</Badge>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-8 gap-1 text-gray-600" onClick={() => setModal({ open: true, usuario: u })}><Pencil className="w-4 h-4" /> Editar</Button>
                          {ativo ? (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-amber-600" onClick={() => toggleStatus.mutate({ id: u.id, status: 'inativo' })}><ShieldOff className="w-4 h-4" /> Desativar</Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 gap-1 text-green-600" onClick={() => toggleStatus.mutate({ id: u.id, status: 'ativo' })}><ShieldCheck className="w-4 h-4" /> Ativar</Button>
                          )}
                        </div>
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
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Nome</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">E-mail (login)</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Perfil</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Empresa</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Situação</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((u) => {
                      const r = ROLE_BY_VALUE[u.role];
                      const ativo = (u.status || 'ativo') !== 'inativo';
                      return (
                        <tr key={u.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{u.full_name || '—'}</td>
                          <td className="p-3 text-gray-600">{u.email}</td>
                          <td className="p-3"><Badge className={`border-0 ${r?.color || 'bg-gray-100 text-gray-600'}`}>{r?.label || u.role || '—'}</Badge></td>
                          <td className="p-3 text-gray-600">{empresaNome(u.empresa_id) || <span className="text-gray-400">Matriz / Global</span>}</td>
                          <td className="p-3">{ativo ? <Badge className="bg-green-100 text-green-700 border-0">Ativo</Badge> : <Badge className="bg-gray-100 text-gray-500 border-0">Inativo</Badge>}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => setModal({ open: true, usuario: u })}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                              {ativo ? (
                                <Button variant="ghost" size="icon" title="Desativar" onClick={() => toggleStatus.mutate({ id: u.id, status: 'inativo' })} className="text-amber-500 hover:text-amber-600"><ShieldOff className="w-4 h-4" /></Button>
                              ) : (
                                <Button variant="ghost" size="icon" title="Ativar" onClick={() => toggleStatus.mutate({ id: u.id, status: 'ativo' })} className="text-green-600 hover:text-green-700"><ShieldCheck className="w-4 h-4" /></Button>
                              )}
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

      <UsuarioModal open={modal.open} onClose={() => setModal({ open: false, usuario: null })} usuario={modal.usuario} />
    </div>
  );
}
