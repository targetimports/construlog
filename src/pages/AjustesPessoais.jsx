/**
 * MEU PERFIL (PROFILE_EDIT)
 *
 * Acessível por TODOS os usuários autenticados. Permite ao próprio usuário:
 *  - Trocar a foto de perfil (avatar)
 *  - Editar seus dados (nome, e-mail de login, telefone, cargo)
 *  - Alterar a senha
 */

import React, { useEffect, useRef, useState } from 'react';
import { useRBAC } from '../components/shared/RBACContext';
import RouteGuardFinalV2 from '../components/auth/RouteGuardFinalV2';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ROLE_LABEL } from '@/components/shared/roles';
import { toast } from 'sonner';
import { User, Lock, Upload, Trash2, Loader2, Save, LogOut, Camera } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const iniciais = (nome) =>
  (nome || '')
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

export default function AjustesPessoais() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="PROFILE_EDIT">
      <MeuPerfilContent />
    </RouteGuardFinalV2>
  );
}

function MeuPerfilContent() {
  const { refetch } = useRBAC();
  const queryClient = useQueryClient();

  const { data: user, refetch: refetchMe } = useQuery({
    queryKey: ['meu-perfil'],
    queryFn: () => base44.auth.me(),
  });

  const recarregar = async () => {
    await refetchMe();
    try { await refetch?.(); } catch { /* noop */ }
    queryClient.invalidateQueries();
  };

  const roleLabel = ROLE_LABEL[user?.role] || user?.role || '—';

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-10">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-sm text-gray-500 mt-1">Gerencie sua foto, seus dados e sua senha de acesso.</p>
      </div>

      <CardFoto user={user} onUpdated={recarregar} />
      <CardDados user={user} onUpdated={recarregar} />
      <CardSenha />

      {/* Sair */}
      <Card className="p-5 bg-white border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-900">Sair da conta</h3>
            <p className="text-sm text-gray-500 mt-0.5">Você será desconectado deste dispositivo.</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50" onClick={() => base44.auth.logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>
      </Card>

      <p className="text-center text-xs text-gray-400">
        Perfil de acesso: <span className="font-medium text-gray-500">{roleLabel}</span>
      </p>
    </div>
  );
}

/* ───────────────────────── Foto de perfil ───────────────────────── */
function CardFoto({ user, onUpdated }) {
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);

  const selecionar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Use uma imagem JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 2MB).');
      return;
    }
    setEnviando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.auth.updateMe({ avatar_url: file_url });
      toast.success('Foto de perfil atualizada.');
      await onUpdated();
    } catch (err) {
      toast.error('Não foi possível atualizar a foto.');
      console.error(err);
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remover = async () => {
    setRemovendo(true);
    try {
      await base44.auth.updateMe({ avatar_url: null });
      toast.success('Foto removida.');
      await onUpdated();
    } catch (err) {
      toast.error('Não foi possível remover a foto.');
      console.error(err);
    } finally {
      setRemovendo(false);
    }
  };

  return (
    <Card className="p-5 bg-white border border-gray-200">
      <h3 className="font-semibold text-gray-900 mb-4">Foto de perfil</h3>
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative">
          {user?.avatar_url ? (
            <img
              src={`${user.avatar_url}?v=${Date.now()}`}
              alt="Avatar"
              className="w-20 h-20 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <span className="text-xl font-bold text-blue-600">{iniciais(user?.full_name)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-[200px]">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={selecionar} className="hidden" />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={enviando || removendo}>
              {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Camera className="w-4 h-4 mr-2" />}
              {enviando ? 'Enviando...' : (user?.avatar_url ? 'Trocar foto' : 'Adicionar foto')}
            </Button>
            {user?.avatar_url && (
              <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={remover} disabled={enviando || removendo}>
                {removendo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Remover
              </Button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">JPG, PNG ou WebP • máx. 2MB</p>
        </div>
      </div>
    </Card>
  );
}

/* ───────────────────────── Dados pessoais ───────────────────────── */
function CardDados({ user, onUpdated }) {
  const [form, setForm] = useState({ full_name: '', email: '', telefone: '' });
  const [salvando, setSalvando] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  useEffect(() => {
    if (user) setForm({ full_name: user.full_name || '', email: user.email || '', telefone: user.telefone || '' });
  }, [user]);

  const salvar = async () => {
    const full_name = form.full_name.trim();
    const email = form.email.toLowerCase().trim();

    const e = {};
    if (!full_name) e.full_name = 'Informe seu nome completo.';
    // É o e-mail de LOGIN: inválido aqui, o usuário perde o acesso ao sistema.
    if (!email) e.email = 'Informe o e-mail de acesso.';
    else if (!EMAIL_RE.test(email)) e.email = 'E-mail inválido.';

    const tel = String(form.telefone || '').replace(/\D/g, '');
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto.';

    setErrors(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }

    const emailAntigo = (user?.email || '').toLowerCase().trim();
    const emailMudou = email !== emailAntigo;

    setSalvando(true);
    try {
      await base44.auth.updateMe({ full_name, email, telefone: form.telefone.trim() });

      // Mantém o vínculo do Colaborador (user_email) em sincronia com o novo login.
      if (emailMudou) {
        try {
          const cols = await base44.entities.Colaborador.filter({ user_email: emailAntigo });
          for (const c of cols || []) await base44.entities.Colaborador.update(c.id, { user_email: email });
        } catch { /* vínculo opcional — não bloqueia */ }
      }

      toast.success(emailMudou ? 'Dados salvos. Seu e-mail de login também foi atualizado.' : 'Dados salvos.');
      await onUpdated();
    } catch (err) {
      const code = err?.detail?.error || err?.message;
      // Erro do servidor sobre o e-mail volta para o próprio campo, não só num toast.
      if (code === 'email_em_uso') {
        setErrors({ email: 'Esse e-mail já está em uso por outro usuário.' });
        toast.error('Esse e-mail já está em uso por outro usuário.');
      } else if (code === 'email_invalido') {
        setErrors({ email: 'E-mail inválido.' });
        toast.error('E-mail inválido.');
      } else toast.error('Não foi possível salvar os dados.');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="p-5 bg-white border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <User className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Dados pessoais</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
          <Input value={form.full_name} onChange={(e) => set('full_name', e.target.value)} className={`h-11 ${errors.full_name ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">E-mail de acesso (login) *</label>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={`h-11 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
          <Input mask="telefone" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000" className={`h-11 ${errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
        </div>
      </div>

      <div className="flex sm:justify-end mt-5">
        <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar alterações
        </Button>
      </div>
    </Card>
  );
}

/* ───────────────────────── Senha ───────────────────────── */
function CardSenha() {
  const [form, setForm] = useState({ atual: '', nova: '', confirma: '' });
  const [salvando, setSalvando] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const salvar = async () => {
    const e = {};
    if (!form.atual) e.atual = 'Informe sua senha atual.';
    if (!form.nova) e.nova = 'Informe a nova senha.';
    else if (form.nova.length < 6) e.nova = 'A nova senha deve ter ao menos 6 caracteres.';
    else if (form.nova === form.atual) e.nova = 'A nova senha deve ser diferente da atual.';

    if (!form.confirma) e.confirma = 'Repita a nova senha.';
    else if (form.nova && form.nova !== form.confirma) e.confirma = 'A confirmação não confere.';

    setErrors(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }

    setSalvando(true);
    try {
      await base44.auth.changePassword(form.atual, form.nova);
      toast.success('Senha alterada com sucesso.');
      setForm({ atual: '', nova: '', confirma: '' });
      setErrors({});
    } catch (err) {
      const code = err?.detail?.error || err?.message;
      // O servidor é quem sabe se a senha atual bate — o erro volta para o campo dela.
      if (code === 'senha_atual_incorreta') {
        setErrors({ atual: 'A senha atual está incorreta.' });
        toast.error('A senha atual está incorreta.');
      } else if (code === 'senha_curta') {
        setErrors({ nova: 'A nova senha deve ter ao menos 6 caracteres.' });
        toast.error('A nova senha deve ter ao menos 6 caracteres.');
      } else toast.error('Não foi possível alterar a senha.');
      console.error(err);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card className="p-5 bg-white border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <Lock className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900">Alterar senha</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual *</label>
          <Input type="password" autoComplete="current-password" value={form.atual} onChange={(e) => set('atual', e.target.value)} className={`h-11 ${errors.atual ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.atual && <p className="text-xs text-red-500 mt-1">{errors.atual}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha *</label>
          <Input type="password" autoComplete="new-password" value={form.nova} onChange={(e) => { set('nova', e.target.value); setErrors((p) => ({ ...p, confirma: null })); }} className={`h-11 ${errors.nova ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.nova
            ? <p className="text-xs text-red-500 mt-1">{errors.nova}</p>
            : <p className="text-xs text-gray-400 mt-1">Mínimo de 6 caracteres.</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha *</label>
          <Input type="password" autoComplete="new-password" value={form.confirma} onChange={(e) => set('confirma', e.target.value)} className={`h-11 ${errors.confirma ? 'border-red-400 focus-visible:ring-red-400' : ''}`} />
          {errors.confirma && <p className="text-xs text-red-500 mt-1">{errors.confirma}</p>}
        </div>
      </div>

      <div className="flex sm:justify-end mt-5">
        <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
          {salvando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
          Alterar senha
        </Button>
      </div>
    </Card>
  );
}
