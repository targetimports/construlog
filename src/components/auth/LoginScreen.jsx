import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { lerBrandingCache } from '@/components/shared/useBranding';

export default function LoginScreen() {
  // Tela pré-auth: usa o branding cacheado (de quando o usuário já entrou antes).
  const branding = lerBrandingCache();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'recover'
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmaSenha, setConfirmaSenha] = useState('');
  const [recoverMsg, setRecoverMsg] = useState(null); // { ok, text }

  const handleRecover = async (e) => {
    e.preventDefault();
    if (loading) return;
    setRecoverMsg(null);
    if (novaSenha.length < 6) { setRecoverMsg({ ok: false, text: 'A nova senha precisa ter ao menos 6 caracteres.' }); return; }
    if (novaSenha !== confirmaSenha) { setRecoverMsg({ ok: false, text: 'As senhas não coincidem.' }); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), nova_senha: novaSenha }),
      });
      if (!res.ok) throw new Error('falha');
      setRecoverMsg({ ok: true, text: 'Solicitação enviada! Um administrador vai aprovar a troca por e-mail. Depois de aprovada, entre com a nova senha.' });
      setNovaSenha(''); setConfirmaSenha('');
    } catch {
      setRecoverMsg({ ok: false, text: 'Não foi possível enviar a solicitação. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await base44.auth.login(email.trim(), password);
      // O toast de boas-vindas não pode sair aqui: o reload abaixo o destruiria.
      // Deixamos um sinal para a próxima página exibi-lo já com o usuário carregado.
      sessionStorage.setItem('germanos:bemvindo', '1');
      // Sem rota específica (raiz/landing) → Dashboard; senão recarrega a rota atual.
      const path = window.location.pathname;
      if (path === '/' || path === '') {
        window.location.href = '/Dashboard';
      } else {
        window.location.reload();
      }
    } catch (err) {
      setError(err?.status === 401 ? 'E-mail ou senha inválidos.' : 'Não foi possível entrar. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white">
      {/* ───────── Coluna do formulário (estilo original) ───────── */}
      <div className="flex w-full md:w-[42%] items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Wordmark simples (igual ao da landing) */}
          <div className="mb-10">
            <span className="font-semibold tracking-tight text-lg text-gray-900">Construlog</span>
          </div>

          {mode === 'login' ? (
          <>
          <h1 className="text-2xl font-bold text-stone-900">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-stone-500">Entre na sua conta para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1.5">E-mail</label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-stone-700 mb-1.5">Senha</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 pr-11 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  tabIndex={-1}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setMode('recover'); setError(''); setRecoverMsg(null); }}
            className="mt-4 w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Esqueci minha senha
          </button>
          </>
          ) : (
          <>
          <button
            type="button"
            onClick={() => { setMode('login'); setRecoverMsg(null); }}
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 transition"
            aria-label="Voltar ao login"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-bold text-stone-900">Recuperar senha</h1>
          <p className="mt-1 text-sm text-stone-500">Informe seu e-mail e a nova senha desejada. Um administrador precisa aprovar a troca.</p>

          <form onSubmit={handleRecover} className="mt-8 space-y-4">
            <div>
              <label htmlFor="rec-email" className="block text-sm font-medium text-stone-700 mb-1.5">E-mail</label>
              <input
                id="rec-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="rec-nova" className="block text-sm font-medium text-stone-700 mb-1.5">Nova senha</label>
              <div className="relative">
                <input
                  id="rec-nova"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 pr-11 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  tabIndex={-1}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="rec-conf" className="block text-sm font-medium text-stone-700 mb-1.5">Confirmar nova senha</label>
              <div className="relative">
                <input
                  id="rec-conf"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={confirmaSenha}
                  onChange={(e) => setConfirmaSenha(e.target.value)}
                  placeholder="repita a nova senha"
                  className="w-full rounded-lg border border-stone-300 px-3.5 py-2.5 pr-11 text-sm text-stone-900 placeholder:text-stone-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                  tabIndex={-1}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {recoverMsg && (
              <p className={`text-sm rounded-lg px-3 py-2 border ${recoverMsg.ok ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}>{recoverMsg.text}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Enviando…' : 'Enviar solicitação'}
            </button>
          </form>
          </>
          )}

          <p className="mt-8 text-center text-xs text-stone-400">
            © 2026 {branding.nome} · Acesso restrito
          </p>
        </div>
      </div>

      {/* ───────── Painel da marca — escuro (preto), textos brancos, mesma textura ───────── */}
      <div className="hidden md:flex relative flex-1 overflow-hidden bg-[#0a0a0a] items-center justify-center p-12 lg:p-20 antialiased">
        {/* Textura suave cobrindo a div inteira — brilho difuso no topo + vinheta embaixo */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(130% 100% at 50% -10%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 55%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 45%)',
          }}
        />

        {/* Só os textos — sem card */}
        <div className="relative z-10 max-w-md">
          <span className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-white/50">Gestão de obras</span>
          <h2 className="mt-6 text-5xl lg:text-6xl font-semibold tracking-[-0.02em] text-white leading-[1.05]">
            Sua obra,
            <br />
            sob controle.
          </h2>
          <p className="mt-6 max-w-sm text-lg text-white/60 leading-relaxed">
            Orçamento, medições e financeiro — integrados, do canteiro ao escritório.
          </p>
        </div>
      </div>
    </div>
  );
}
