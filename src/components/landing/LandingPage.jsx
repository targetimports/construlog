import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Calculator, Ruler, Wallet, Boxes, MessageCircle, Mail, X, CheckCircle2, Play } from 'lucide-react';
import Carrossel from './Carrossel';
import NavbarPublica from './NavbarPublica';

// Ajuste estes contatos conforme os dados reais da Germanos.
const WHATSAPP_NUMERO = '5571999999999'; // formato internacional, só dígitos
const EMAIL_CONTATO = 'contato@grupogermanos.com.br';

// Número que conta de 0 até o valor quando `ativo` vira true (ao entrar em tela).
function NumeroAnimado({ valor, formato, ativo, duracao = 1300 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ativo) { setN(0); return; }
    let raf;
    const inicio = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - inicio) / duracao);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(valor * eased);
      if (p < 1) raf = requestAnimationFrame(passo);
      else setN(valor);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [ativo, valor, duracao]);
  return <>{formato(n)}</>;
}

// Landing pública (rota "/"). Design minimalista, sem o Layout/sidebar do app.
// CTA "Acessar o sistema" leva a /Dashboard (rota protegida → login → Dashboard).
export default function LandingPage() {
  const [stats, setStats] = useState(null);
  // Contatos vêm do cadastro da empresa (/ConfiguracoesEmpresa) via branding
  // público. Enquanto não carrega — ou se o admin não preencheu — cai nas
  // constantes abaixo, para o botão nunca ficar quebrado.
  const [contato, setContato] = useState({ whatsapp: WHATSAPP_NUMERO, email: EMAIL_CONTATO });
  const numerosRef = useRef(null);
  const [numerosInView, setNumerosInView] = useState(false);

  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.clientes === 'number') setStats(d); })
      .catch(() => { /* ignora */ });
  }, []);

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setContato((c) => ({
        whatsapp: d?.whatsapp || c.whatsapp,
        email: d?.email_contato || c.email,
      })))
      .catch(() => { /* mantém o fallback */ });
  }, []);

  // Dispara o count-up quando a faixa de números entra na tela.
  useEffect(() => {
    const el = numerosRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setNumerosInView(true); obs.disconnect(); } },
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [stats]);

  // Escala (mi/mil) travada pelo total final: o count-up anima sempre na mesma
  // unidade, então o texto não troca de formato nem "pula" de largura a cada frame.
  const escalaValor = (final) => {
    const f = Number(final) || 0;
    if (f >= 1_000_000) return { div: 1_000_000, sufixo: 'mi', casas: 1 };
    if (f >= 1_000) return { div: 1_000, sufixo: 'mil', casas: 0 };
    return { div: 1, sufixo: '', casas: 0 };
  };
  const [contatoOpen, setContatoOpen] = useState(false);
  const [view, setView] = useState('opcoes'); // 'opcoes' | 'form'
  const [form, setForm] = useState({ nome: '', email: '', mensagem: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  const fecharContato = () => {
    setContatoOpen(false);
    setView('opcoes');
    setEnviado(false);
    setErro('');
  };

  // Fecha o modal de contato com Esc.
  useEffect(() => {
    if (!contatoOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') fecharContato(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contatoOpen]);

  const enviarContato = async (e) => {
    e.preventDefault();
    setErro('');
    const nome = form.nome.trim();
    const email = form.email.trim();
    const mensagem = form.mensagem.trim();
    if (!nome || !email || !mensagem) { setErro('Preencha todos os campos.'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setErro('E-mail inválido.'); return; }
    setEnviando(true);
    try {
      const res = await fetch('/api/public/contato', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, mensagem }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setEnviado(true);
        setForm({ nome: '', email: '', mensagem: '' });
      } else {
        setErro('Não foi possível enviar agora. Tente novamente.');
      }
    } catch {
      setErro('Falha de conexão. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };


  const features = [
    { icon: Calculator, titulo: 'Orçamentos precisos', texto: 'Importe do OrçaFascio e tenha o orçamento completo da obra pronto em minutos.' },
    { icon: Ruler, titulo: 'Medições no controle', texto: 'Boletins de medição com saldo, acumulado e geração financeira automática.' },
    { icon: Wallet, titulo: 'Visão financeira', texto: 'Custos, recebimentos e DRE por obra — em tempo real, do canteiro ao escritório.' },
    { icon: Boxes, titulo: 'Suprimentos e estoque', texto: 'Compras, recebimentos e movimentações de estoque integrados a cada obra.' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased selection:bg-blue-600/10">
      {/* ───── Navbar (compartilhada com a Central de Ajuda pública) ───── */}
      <NavbarPublica />

      {/* ───── Hero ───── */}
      <section className="relative overflow-hidden">
        {/* brilho suave de fundo */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-gradient-to-b from-blue-100/60 via-blue-50/40 to-transparent blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-24 pb-16 sm:pt-28 sm:pb-24 text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 mb-6">
            Gestão de obras
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.07] sm:leading-[1.05] text-gray-900">
            Sua obra,
            <br />
            sob controle.
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Do orçamento à medição, dos suprimentos ao financeiro. Uma plataforma única
            para gerir suas obras com clareza — do canteiro ao escritório.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setContatoOpen(true)}
              className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white text-[15px] font-medium rounded-full px-7 py-3.5"
            >
              Fale conosco
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <a
              href="#recursos"
              className="inline-flex items-center text-[15px] font-medium text-gray-700 hover:text-gray-900 transition-colors rounded-full px-6 py-3.5"
            >
              Conhecer
            </a>
          </div>
        </div>

        {/* Carrossel de imagens (placeholders de cor sólida por enquanto) */}
        <div className="max-w-5xl mx-auto px-6 pb-16 sm:pb-24">
          <Carrossel />
        </div>
      </section>

      {/* ───── Recursos ───── */}
      <section id="recursos" className="scroll-mt-20 border-t border-gray-100 bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
              Tudo o que a obra precisa.
            </h2>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              Módulos integrados que conversam entre si — sem planilhas soltas, sem retrabalho.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="group rounded-2xl bg-white border border-gray-100 p-6 hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.25)] transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Números ───── */}
      {stats && (
        <section className="border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24 lg:py-28">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900">
                A confiança de quem constrói.
              </h2>
              <p className="mt-4 text-lg text-gray-500">Resultados reais, obra após obra.</p>
            </div>

            <div className="relative" ref={numerosRef}>
              {/* Glow ambiente sutil atrás dos números */}
              <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
                <div className="w-[680px] max-w-full h-[240px] rounded-full bg-gradient-to-r from-blue-100/40 via-indigo-100/30 to-emerald-100/30 blur-3xl opacity-70" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-12 sm:gap-6 text-center">
                <div>
                  <p className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 tabular-nums">
                    <NumeroAnimado valor={stats.clientes} ativo={numerosInView} formato={(x) => `+${Math.round(x)}`} />
                  </p>
                  <p className="mt-2 text-sm text-gray-500">{stats.clientes === 1 ? 'Cliente atendido' : 'Clientes atendidos'}</p>
                </div>
                <div>
                  <p className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 tabular-nums">
                    <NumeroAnimado valor={stats.obras} ativo={numerosInView} formato={(x) => `+${Math.round(x)}`} />
                  </p>
                  <p className="mt-2 text-sm text-gray-500">{stats.obras === 1 ? 'Obra gerenciada' : 'Obras gerenciadas'}</p>
                </div>
                <div>
                  {(() => {
                    const esc = escalaValor(stats.valorObras);
                    return (
                      <p className="text-5xl sm:text-6xl font-semibold tracking-tight text-gray-900 tabular-nums whitespace-nowrap">
                        <span className="mr-1 align-baseline text-2xl sm:text-3xl text-gray-400">+R$</span>
                        <NumeroAnimado
                          valor={stats.valorObras / esc.div}
                          ativo={numerosInView}
                          formato={(x) => x.toLocaleString('pt-BR', { minimumFractionDigits: esc.casas, maximumFractionDigits: esc.casas })}
                        />
                        {esc.sufixo && (
                          <span className="ml-1.5 align-baseline text-2xl sm:text-3xl text-gray-400">{esc.sufixo}</span>
                        )}
                      </p>
                    );
                  })()}
                  <p className="mt-2 text-sm text-gray-500">Gerenciados em obras</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───── Contato ───── */}
      <section id="contato" className="scroll-mt-20 border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-20 sm:py-28 text-center">
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-gray-900">
            Vamos construir juntos.
          </h2>
          <p className="mt-5 text-lg text-gray-500">
            Conte com a Germanos do projeto à entrega da sua obra.
          </p>
          <button
            type="button"
            onClick={() => setContatoOpen(true)}
            className="mt-9 inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 transition-colors text-white text-[15px] font-medium rounded-full px-7 py-3.5"
          >
            Fale conosco
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ───── Conheça o sistema (leva à Central de Ajuda pública) ─────
          Duas colunas com um mock de interface à direita, no mesmo fundo claro do
          resto da página. A promessa é o passeio pelo sistema — o formato (vídeo)
          é detalhe e não precisa aparecer aqui. */}
      <section className="scroll-mt-20 border-t border-gray-100 bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6 py-14 sm:py-24 lg:py-28">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 mb-4 sm:mb-6">
                Conheça o sistema
              </span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-gray-900 leading-[1.1]">
                Veja como funciona,
                <br className="hidden sm:block" /> na prática.
              </h2>
              {/* No celular o parágrafo longo virava quatro linhas e empurrava o
                  botão para fora da dobra — lá basta a promessa em uma frase. */}
              <p className="mt-4 sm:mt-5 text-base sm:text-lg text-gray-500 leading-relaxed">
                <span className="sm:hidden">
                  Uma volta guiada pelo Construlog, do orçamento ao financeiro.
                </span>
                <span className="hidden sm:inline">
                  Uma volta guiada pelo Construlog: como uma obra nasce do orçamento,
                  caminha pelas medições e fecha no financeiro. Do jeito que sua equipe
                  vai usar, no dia a dia.
                </span>
              </p>
              <Link
                to="/Ajuda"
                className="group mt-6 sm:mt-9 w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 transition-colors text-white text-[15px] font-medium rounded-full px-7 h-12"
              >
                Conhecer o sistema
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-3 sm:mt-5 text-sm text-gray-400 text-center sm:text-left">
                Acesso livre, sem cadastro.
              </p>
            </div>

            {/* Mock abstrato de interface — sugere o sistema sem fingir ser um
                print real (que envelheceria a cada mudança de tela). */}
            <Link to="/Ajuda" aria-label="Conhecer o sistema" className="group block">
              <div className="relative rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden transition-shadow group-hover:shadow-md">
                <div className="flex items-center gap-1.5 px-4 h-9 border-b border-gray-100 bg-gray-50/80">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-200" />
                </div>
                {/* 16/9 no celular (mais baixo, cabe na tela) e 16/10 no desktop,
                    onde há altura sobrando ao lado do texto. */}
                <div className="relative aspect-video md:aspect-[16/10] bg-gradient-to-br from-slate-50 to-blue-50/60">
                  <div className="absolute inset-0 p-4 sm:p-7 space-y-2.5 sm:space-y-3" aria-hidden="true">
                    <div className="h-2.5 w-1/3 rounded-full bg-gray-200" />
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1">
                      <div className="h-10 sm:h-12 rounded-lg bg-white border border-gray-100" />
                      <div className="h-10 sm:h-12 rounded-lg bg-white border border-gray-100" />
                      <div className="h-10 sm:h-12 rounded-lg bg-white border border-gray-100" />
                    </div>
                    <div className="h-2 w-2/3 rounded-full bg-gray-200/80" />
                    {/* As duas últimas linhas só no desktop: no celular virariam
                        ruído atrás do botão de play. */}
                    <div className="hidden sm:block h-2 w-1/2 rounded-full bg-gray-200/60" />
                    <div className="hidden sm:block h-2 w-3/5 rounded-full bg-gray-200/40" />
                  </div>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-105">
                      <Play className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 ml-0.5 sm:ml-1" fill="currentColor" />
                    </span>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-700">Construlog</span>
            <span className="text-sm text-gray-400">· Grupo Germanos</span>
          </div>
          <p className="text-xs text-gray-400">© 2026 Grupo Germanos. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* ───── Modal de contato ───── */}
      {contatoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm" onClick={fecharContato} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white border border-gray-100 shadow-2xl p-6">
            <button
              type="button"
              onClick={fecharContato}
              aria-label="Fechar"
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Tela 1 — escolha do canal */}
            {view === 'opcoes' && (
              <>
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">Fale conosco</h3>
                <p className="mt-1 text-sm text-gray-500">Como você prefere falar com a Germanos?</p>
                <div className="mt-5 space-y-3">
                  <a
                    href={`https://wa.me/${contato.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-xl border border-gray-100 p-3.5 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">WhatsApp</p>
                      <p className="text-xs text-gray-500">Resposta rápida</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-600 transition-colors flex-shrink-0" />
                  </a>

                  <button
                    type="button"
                    onClick={() => { setErro(''); setView('form'); }}
                    className="group w-full flex items-center gap-3 rounded-xl border border-gray-100 p-3.5 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-sm font-semibold text-gray-900">E-mail</p>
                      <p className="text-xs text-gray-500">Envie uma mensagem</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-blue-600 transition-colors flex-shrink-0" />
                  </button>
                </div>
              </>
            )}

            {/* Tela 2 — formulário de e-mail */}
            {view === 'form' && !enviado && (
              <>
                <div className="flex items-center gap-2 pr-6">
                  <button type="button" onClick={() => setView('opcoes')} aria-label="Voltar" className="text-gray-400 hover:text-gray-700 transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h3 className="text-xl font-semibold tracking-tight text-gray-900">Enviar mensagem</h3>
                </div>
                <form onSubmit={enviarContato} className="mt-5 space-y-3">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                  />
                  <input
                    type="email"
                    placeholder="Seu e-mail"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition"
                  />
                  <textarea
                    placeholder="Sua mensagem"
                    rows={4}
                    value={form.mensagem}
                    onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition resize-none"
                  />
                  {erro && <p className="text-xs text-red-600">{erro}</p>}
                  <button
                    type="submit"
                    disabled={enviando}
                    className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors text-white text-sm font-medium rounded-full px-6 py-3"
                  >
                    {enviando ? 'Enviando…' : <>Enviar <ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </>
            )}

            {/* Tela 3 — confirmação */}
            {view === 'form' && enviado && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold tracking-tight text-gray-900">Mensagem enviada!</h3>
                <p className="mt-1.5 text-sm text-gray-500">Em breve a equipe Germanos entra em contato.</p>
                <button
                  type="button"
                  onClick={fecharContato}
                  className="mt-6 inline-flex items-center justify-center bg-gray-900 hover:bg-gray-800 transition-colors text-white text-sm font-medium rounded-full px-6 py-2.5"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
