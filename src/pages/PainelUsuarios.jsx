import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { Users, Plus, Pencil, KeyRound, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, fmtData,
} from '@/components/painel/ui';

// USUÁRIOS DO BACK-OFFICE — quem tem acesso a este painel.
//
// Não são os usuários dos clientes (esses vivem na instância de cada um): aqui
// é a sua equipe. Por isso os perfis são poucos e diretos.

const PERFIS = [
  { value: 'admin', label: 'Administrador', descricao: 'Acesso total, inclusive usuários e API' },
  { value: 'financeiro', label: 'Financeiro', descricao: 'Clientes, pagamentos e cobranças' },
  { value: 'suporte', label: 'Suporte', descricao: 'Consulta clientes e integrações' },
];

const rotuloPerfil = (r) => PERFIS.find((p) => p.value === r)?.label || r || '—';

const VAZIO = { full_name: '', email: '', role: 'suporte', password: '', status: 'ativo' };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PainelUsuarios() {
  const qc = useQueryClient();
  const { user: eu } = useAuth();
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [errors, setErrors] = useState({});

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['usuarios-painel'],
    queryFn: () => base44.entities.User.list('-created_date', 2000).catch(() => []),
  });

  // A tabela de usuários é compartilhada com o ERP, que tem os funcionários das
  // construtoras. Aqui só interessa a equipe do back-office: quem foi criado por
  // esta tela (escopo_painel) e quem está logado agora — senão o próprio admin
  // sumiria da lista e ninguém conseguiria gerir mais nada.
  const usuarios = useMemo(
    () => todos.filter((u) => u.escopo_painel === true || u.id === eu?.id),
    [todos, eu?.id],
  );

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const abrirNovo = () => { setEditando(null); setForm(VAZIO); setErrors({}); setModal(true); };
  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ full_name: u.full_name || '', email: u.email || '', role: u.role || 'suporte', password: '', status: u.status || 'ativo' });
    setErrors({});
    setModal(true);
  };

  const salvar = useMutation({
    mutationFn: (d) => (editando ? base44.entities.User.update(editando.id, d) : base44.entities.User.create(d)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios-painel'] });
      toast.success(editando ? 'Usuário atualizado!' : 'Usuário criado!');
      setModal(false);
    },
    onError: (e) => {
      const msg = String(e?.detail?.error || e?.message || '');
      if (/email/i.test(msg) && /uso|exist|duplic/i.test(msg)) {
        setErrors((p) => ({ ...p, email: 'Este e-mail já está em uso.' }));
        toast.error('Este e-mail já está em uso.');
      } else toast.error('Erro: ' + msg);
    },
  });

  const validar = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Informe o nome';
    if (!editando) {
      if (!EMAIL_RE.test(form.email)) e.email = 'E-mail válido é obrigatório';
    }
    // Senha: obrigatória ao criar; na edição só valida se foi preenchida.
    if (!editando || form.password) {
      if ((form.password || '').length < 6) e.password = 'Mínimo de 6 caracteres';
    }
    if (!form.role) e.role = 'Selecione o perfil';

    // Rebaixar a si mesmo tira o próprio acesso a esta tela — e não há como voltar.
    if (editando && editando.id === eu?.id && form.role !== 'admin' && eu?.role === 'admin') {
      e.role = 'Você não pode remover seu próprio acesso de administrador';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    const patch = {
      full_name: form.full_name.trim(),
      role: form.role,
      status: form.status,
      // O painel é global: nada de amarrar a uma empresa do ERP.
      acesso_global: true,
      // Marca que este usuário pertence ao back-office (e não a uma construtora).
      escopo_painel: true,
    };
    if (form.password) patch.password = form.password;
    if (!editando) patch.email = form.email.toLowerCase().trim();
    salvar.mutate(patch);
  };

  const totais = useMemo(() => ({
    total: usuarios.length,
    ativos: usuarios.filter((u) => (u.status || 'ativo') === 'ativo').length,
    admins: usuarios.filter((u) => u.role === 'admin').length,
  }), [usuarios]);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Quem acessa este painel">
        <Button onClick={abrirNovo} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo usuário
        </Button>
      </CabecalhoPagina>

      <GradeNumeros>
        <CardNumero rotulo="Usuários" valor={totais.total} icone={Users} />
        <CardNumero rotulo="Ativos" valor={totais.ativos} tom="positivo" />
        <CardNumero rotulo="Administradores" valor={totais.admins} icone={ShieldCheck} />
        <CardNumero rotulo="Inativos" valor={totais.total - totais.ativos} tom={totais.total - totais.ativos ? 'alerta' : 'neutro'} />
      </GradeNumeros>

      <Painel semPadding>
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={4} /></div>
        ) : usuarios.length === 0 ? (
          <Vazio icone={Users} titulo="Nenhum usuário" acao="Criar usuário" onAcao={abrirNovo} />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Nome' }, { titulo: 'E-mail' }, { titulo: 'Perfil' },
                  { titulo: 'Situação' }, { titulo: 'Criado em' }, { titulo: '', largura: 'w-14' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="p-3">
                        <span className="font-medium text-gray-900">{u.full_name || '—'}</span>
                        {u.id === eu?.id && <span className="ml-2 text-xs text-gray-400">(você)</span>}
                      </td>
                      <td className="p-3 text-gray-600">{u.email}</td>
                      <td className="p-3 text-gray-600">{rotuloPerfil(u.role)}</td>
                      <td className="p-3">
                        <Etiqueta tom={(u.status || 'ativo') === 'ativo' ? 'positivo' : 'neutro'}>
                          {(u.status || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Etiqueta>
                      </td>
                      <td className="p-3 text-gray-500">{fmtData(u.created_date)}</td>
                      <td className="p-3">
                        <Button variant="ghost" size="icon" onClick={() => abrirEditar(u)} title="Editar">
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {usuarios.map((u) => (
                <div key={u.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 break-words">{u.full_name}</p>
                      <p className="text-xs text-gray-500 break-all">{u.email}</p>
                    </div>
                    <Etiqueta tom={(u.status || 'ativo') === 'ativo' ? 'positivo' : 'neutro'}>
                      {(u.status || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}
                    </Etiqueta>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{rotuloPerfil(u.role)}</span>
                    <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)} className="text-blue-700">Editar</Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Painel>

      <Dialog open={modal} onOpenChange={(o) => { if (!o) setModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Nome completo *</Label>
              <Input
                className={`h-11 mt-1 ${errors.full_name ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">E-mail (login) *</Label>
              <Input
                type="email" disabled={!!editando}
                className={`h-11 mt-1 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''} ${editando ? 'bg-gray-50' : ''}`}
                value={form.email} onChange={(e) => set('email', e.target.value)}
                placeholder="pessoa@construlog.com.br"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              {editando && <p className="text-[11px] text-gray-400 mt-1">O e-mail de login não pode ser alterado.</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">Perfil *</Label>
              <Select value={form.role} onValueChange={(v) => set('role', v)}>
                <SelectTrigger className={`h-11 mt-1 ${errors.role ? 'border-red-400' : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERFIS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.role
                ? <p className="text-xs text-red-500 mt-1">{errors.role}</p>
                : <p className="text-[11px] text-gray-400 mt-1">{PERFIS.find((p) => p.value === form.role)?.descricao}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600 flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> {editando ? 'Nova senha (opcional)' : 'Senha inicial *'}
              </Label>
              <Input
                type="text"
                className={`h-11 mt-1 ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.password} onChange={(e) => set('password', e.target.value)}
                placeholder={editando ? 'Deixe em branco para manter' : 'Mínimo de 6 caracteres'}
              />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
            </div>

            {editando && (
              <div>
                <Label className="text-xs text-gray-600">Situação</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo (bloqueia o login)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
