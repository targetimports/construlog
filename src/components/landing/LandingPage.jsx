import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Calculator, Ruler, Wallet, Boxes, HardHat, Truck,
  Check, Play, Mail, Phone, MapPin,
} from 'lucide-react';
import NavbarPublica from './NavbarPublica';
import ModalContato from './ModalContato';
import BlocoContato from './BlocoContato';
import { MockPainel, MockDiario } from './MockSistema';

// LANDING DO PRODUTO
//
// Vende o SISTEMA (software de gestão de obras), não a construtora. Por isso a
// página fala com quem compra software: dono de construtora, engenheiro, gestor.
//
// Estrutura: promessa → prova (números) → recursos → o sistema por dentro →
// preço → dúvidas → contato.
//
// PREÇOS: os valores abaixo são o único ponto que precisa de decisão comercial.
// Estão isolados nesta constante justamente para serem trocados sem mexer no
// resto da página.
const PLANOS = [
  {
    nome: 'Essencial',
    preco: 'R$ 490',
    periodo: '/mês',
    resumo: 'Para quem toca até 3 obras e quer sair da planilha.',
    itens: [
      'Até 3 obras ativas',
      'Até 10 usuários',
      'Orçamento, medição e diário de obra',
      'Financeiro por obra',
      'Suporte por e-mail',
    ],
    destaque: false,
    cta: 'Começar',
  },
  {
    nome: 'Construtora',
    preco: 'R$ 1.290',
    periodo: '/mês',
    resumo: 'Para quem gerencia várias obras e precisa de visão consolidada.',
    itens: [
      'Obras ilimitadas',
      'Até 40 usuários',
      'Tudo do Essencial',
      'Suprimentos, estoque e frota',
      'Multi-empresa e DRE consolidada',
      'Suporte prioritário no WhatsApp',
    ],
    destaque: true,
    cta: 'Falar com especialista',
  },
  {
    nome: 'Corporativo',
    preco: 'Sob consulta',
    periodo: '',
    resumo: 'Para grupos com várias empresas, integrações e regras próprias.',
    itens: [
      'Usuários ilimitados',
      'Tudo do Construtora',
      'Integrações e importações sob medida',
      'Ambiente dedicado',
      'Treinamento da equipe',
    ],
    destaque: false,
    cta: 'Fale conosco',
  },
];


// Contato exibido no rodapé e no modal. São valores de exemplo: o cadastro da
// empresa (Configurações → Empresa) sobrescreve cada campo que estiver
// preenchido. Ficam aqui para a página nunca aparecer sem contato nenhum.
const CONTATO_PADRAO = {
  email: 'contato@construlog.com.br',
  telefone: '(71) 3000-0000',
  endereco: 'Praça Vigário Martins, Centro — Tucano/BA',
  whatsapp: '',
  empresa: '',
};

const MODULOS = [
  { icon: Calculator, titulo: 'Orçamento', texto: 'Importe do OrçaFácil, ajuste BDI e tenha o orçamento pronto sem redigitar item por item.' },
  { icon: Ruler, titulo: 'Medição', texto: 'Boletins com saldo e acumulado. A medição aprovada vira lançamento financeiro sozinha.' },
  { icon: Wallet, titulo: 'Financeiro', texto: 'Contas a pagar e receber, caixa por empresa e DRE por obra — sem exportar para planilha.' },
  { icon: Boxes, titulo: 'Suprimentos', texto: 'Requisição, cotação, pedido e recebimento. O material entra no estoque da obra certa.' },
  { icon: HardHat, titulo: 'Obra e equipe', texto: 'Diário, ponto, alocação e folha. O que acontece no canteiro chega ao escritório no mesmo dia.' },
  { icon: Truck, titulo: 'Frota e ativos', texto: 'Empréstimo de equipamento com vistoria, abastecimento e manutenção rateados por obra.' },
];


function NumeroAnimado({ valor, formato, ativo, duracao = 1300 }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    let raf; const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min(1, (t - t0) / duracao);
      setV(valor * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [ativo, valor, duracao]);
  return <>{formato(v)}</>;
}

export default function LandingPage() {
  const [stats, setStats] = useState(null);
  const [contato, setContato] = useState(CONTATO_PADRAO);
  const numerosRef = useRef(null);
  const [numerosInView, setNumerosInView] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // Guarda de qual plano veio o clique, só para pré-preencher a mensagem.
  const [planoEscolhido, setPlanoEscolhido] = useState(null);
  const abrirContato = (plano = null) => { setPlanoEscolhido(plano); setModalOpen(true); };


  useEffect(() => {
    fetch('/api/public/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.obras === 'number') setStats(d); })
      .catch(() => { /* a seção some se não vier */ });
  }, []);

  useEffect(() => {
    fetch('/api/public/branding')
      .then((r) => (r.ok ? r.json() : null))
      // Campo vazio no cadastro mantém o valor de exemplo — o rodapé nunca fica
      // sem contato por causa de um cadastro incompleto.
      .then((d) => setContato((atual) => ({
        whatsapp: d?.whatsapp || atual.whatsapp,
        email: d?.email_contato || atual.email,
        empresa: d?.nome_empresa || atual.empresa,
        telefone: d?.telefone || atual.telefone,
        endereco: d?.endereco || atual.endereco,
      })))
      .catch(() => { /* fica com o contato padrão */ });
  }, []);

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

  const escala = (final) => {
    const f = Number(final) || 0;
    if (f >= 1_000_000) return { div: 1_000_000, sufixo: 'mi', casas: 1 };
    if (f >= 1_000) return { div: 1_000, sufixo: 'mil', casas: 0 };
    return { div: 1, sufixo: '', casas: 0 };
  };



  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased selection:bg-blue-600/10">
      {/* O mesmo rótulo faz a mesma coisa em toda a página: abre o modal. */}
      <NavbarPublica
        mostrarEntrar={false}
        cta={{ label: 'Agendar demonstração', onClick: () => abrirContato(null) }}
      />

      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-gradient-to-b from-blue-100/70 via-blue-50/40 to-transparent blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-6 pt-32 pb-12 sm:pt-36 text-center">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.07] sm:leading-[1.05]">
            O ERP que fala
            <br />a língua da obra.
          </h1>

          <p className="mt-7 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            Orçamento, medição, suprimentos e financeiro no mesmo lugar. Do canteiro
            ao escritório, todo mundo olhando para o mesmo número.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => abrirContato(null)}
              className="group inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white text-[15px] font-medium rounded-full px-7 py-3.5"
            >
              Agendar demonstração
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <Link
              to="/Ajuda"
              className="inline-flex items-center gap-2 text-[15px] font-medium text-gray-700 hover:text-gray-900 transition-colors rounded-full px-6 py-3.5"
            >
              <Play className="w-4 h-4" />
              Ver o sistema funcionando
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Sem instalação · Sem cartão para conhecer</p>
        </div>

        <div className="max-w-5xl mx-auto px-6 pb-16 sm:pb-24">
          <MockPainel />
        </div>
      </section>

      {/* ───────────────────────── Números ───────────────────────── */}
      {stats && (
        <section className="border-t border-gray-100 bg-[#fbfbfd]">
          <div className="max-w-5xl mx-auto px-6 py-14 sm:py-20" ref={numerosRef}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 text-center">
              <div>
                <p className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">
                  <NumeroAnimado valor={stats.obras} ativo={numerosInView} formato={(x) => `+${Math.round(x)}`} />
                </p>
                <p className="mt-2 text-sm text-gray-500">Obras gerenciadas na plataforma</p>
              </div>
              <div>
                {(() => {
                  const e = escala(stats.valorObras);
                  return (
                    <p className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums whitespace-nowrap">
                      <span className="mr-1 align-baseline text-xl sm:text-2xl text-gray-400">+R$</span>
                      <NumeroAnimado
                        valor={stats.valorObras / e.div}
                        ativo={numerosInView}
                        formato={(x) => x.toLocaleString('pt-BR', { minimumFractionDigits: e.casas, maximumFractionDigits: e.casas })}
                      />
                      {e.sufixo && <span className="ml-1.5 align-baseline text-xl sm:text-2xl text-gray-400">{e.sufixo}</span>}
                    </p>
                  );
                })()}
                <p className="mt-2 text-sm text-gray-500">Em contratos administrados</p>
              </div>
              <div>
                <p className="text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums">
                  <NumeroAnimado valor={stats.clientes} ativo={numerosInView} formato={(x) => `+${Math.round(x)}`} />
                </p>
                <p className="mt-2 text-sm text-gray-500">Clientes acompanhados</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────── Recursos ───────────────────────── */}
      <section id="recursos" className="scroll-mt-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl mb-10 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Recursos</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
              Um sistema, a obra inteira.
            </h2>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              Os módulos conversam entre si. O orçamento vira contrato, o contrato vira
              medição, a medição vira dinheiro no financeiro — sem ninguém redigitar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {MODULOS.map(({ icon: Icon, titulo, texto }) => (
              <div
                key={titulo}
                className="group rounded-2xl bg-white border border-gray-100 p-6 hover:shadow-[0_20px_50px_-25px_rgba(0,0,0,0.25)] transition-shadow"
              >
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">{titulo}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────────── O sistema por dentro ───────────────────── */}
      {/* Container mais largo que o resto da página para caber a janela do
          sistema (na mesma largura do mockup do topo) COM o celular ao lado. */}
      <section id="sistema" className="scroll-mt-20 border-t border-gray-100 bg-[#fbfbfd]">
        <div className="max-w-[1280px] mx-auto px-6 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">O sistema por dentro</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
              Veja antes de decidir.
            </h2>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              As telas que sua equipe vai usar todos os dias.
            </p>
          </div>

          {/* Desktop e celular lado a lado — a mesma obra nas duas telas. */}
          {/* min-h nas legendas: sem isso a coluna do celular (legenda de duas
              linhas) fica mais alta e os dois mockups saem do mesmo eixo. */}
          <div className="grid lg:grid-cols-[1fr_232px] gap-y-10 lg:gap-x-14 items-center">
            <div className="min-w-0">
              <MockPainel />
              <p className="mt-4 text-sm text-gray-500 max-w-2xl lg:min-h-[40px]">
                Contrato, medido, a receber e a pagar lado a lado — o retrato da obra em uma tela.
              </p>
            </div>

            <div className="justify-self-center lg:justify-self-end">
              <MockDiario />
              <p className="mt-4 text-sm text-gray-500 text-center max-w-[232px] lg:min-h-[40px]">
                A mesma obra no celular — diário e ponto pelo telefone.
              </p>
            </div>
          </div>

          <div className="mt-10 flex justify-center lg:justify-start">
            <Link
              to="/Ajuda"
              className="group inline-flex items-center gap-2 text-[15px] font-medium text-blue-600 hover:text-blue-700"
            >
              Ver a demonstração completa
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────── Preços ───────────────────────── */}
      <section id="precos" className="scroll-mt-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24 lg:py-28">
          <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Planos</span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight">
              Preço que cabe na obra.
            </h2>
            <p className="mt-4 text-lg text-gray-500 leading-relaxed">
              Um valor por mês, com todos os módulos. Sem taxa de implantação e sem
              cobrança por obra cadastrada.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PLANOS.map((p) => (
              <div
                key={p.nome}
                className={`relative rounded-2xl border p-7 flex flex-col ${
                  p.destaque
                    ? 'border-blue-600 bg-white shadow-[0_30px_70px_-40px_rgba(37,99,235,0.6)] md:-mt-4 md:pb-9'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {p.destaque && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white">
                    Mais escolhido
                  </span>
                )}

                <h3 className="font-semibold text-lg">{p.nome}</h3>
                <p className="mt-1.5 text-sm text-gray-500 leading-relaxed min-h-[40px]">{p.resumo}</p>

                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{p.preco}</span>
                  {p.periodo && <span className="text-gray-400 text-sm">{p.periodo}</span>}
                </div>

                <ul className="mt-6 space-y-3 flex-1">
                  {p.itens.map((i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      {i}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => abrirContato(p.nome)}
                  className={`mt-7 inline-flex items-center justify-center rounded-full h-12 text-[15px] font-medium transition-colors ${
                    p.destaque
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {p.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-gray-400">
            Valores em reais, por empresa. Precisa de algo diferente?{' '}
            <button type="button" onClick={() => abrirContato(null)} className="text-blue-600 hover:text-blue-700 font-medium">Fale com a gente</button>.
          </p>
        </div>
      </section>

      {/* ───────────────────────── Contato ───────────────────────── */}
      <section id="contato" className="scroll-mt-20 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16 sm:py-24 lg:py-28">
          <BlocoContato contato={contato} />
        </div>
      </section>

      {/* ───────────────────────── Rodapé ───────────────────────── */}
      {/* Rodapé informativo: quem somos, como falar com a gente e o que o
          sistema é. Sem menu de navegação — a página é uma só. E-mail e WhatsApp
          vêm do cadastro da empresa; se não estiverem preenchidos, o bloco de
          contato simplesmente não aparece, em vez de mostrar link quebrado. */}
      <footer className="border-t border-gray-100 bg-[#fbfbfd]">
        <div className="max-w-6xl mx-auto px-6 py-14 sm:py-16">
          <div className="grid gap-10 md:grid-cols-2 lg:gap-24">
            {/* Marca */}
            <div className="max-w-sm">
              <p className="text-lg font-semibold tracking-tight">Construlog</p>
              <p className="mt-3 text-sm text-gray-500 leading-[1.7]">
                Software de gestão para construtoras. Orçamento, medição, suprimentos
                e financeiro no mesmo lugar — do canteiro ao escritório.
              </p>
              <button
                type="button"
                onClick={() => abrirContato(null)}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Agendar demonstração
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Contato — e-mail, telefone e endereço, nesta ordem. Cada linha só
                aparece se estiver preenchida no cadastro da empresa. */}
            <div className="md:justify-self-end md:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Contato</p>
              <ul className="mt-4 space-y-3.5 text-sm">
                {contato.email && (
                  <li>
                    <a
                      href={`mailto:${contato.email}`}
                      className="flex items-start gap-2.5 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span className="break-all">{contato.email}</span>
                    </a>
                  </li>
                )}
                {contato.telefone && (
                  <li>
                    <a
                      href={`tel:${String(contato.telefone).replace(/\D/g, '')}`}
                      className="flex items-start gap-2.5 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <Phone className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <span>{contato.telefone}</span>
                    </a>
                  </li>
                )}
                {contato.endereco && (
                  <li className="flex items-start gap-2.5 text-gray-500">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <span className="whitespace-nowrap">{contato.endereco}</span>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-400">
              © {new Date().getFullYear()} Construlog. Todos os direitos reservados.
            </p>
            {contato.empresa && (
              <p className="text-sm text-gray-400">{contato.empresa}</p>
            )}
          </div>
        </div>
      </footer>

      <ModalContato
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        contato={contato}
        plano={planoEscolhido}
      />
    </div>
  );
}
