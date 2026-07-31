import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Receipt, Users, Plug, FileBarChart,
  CreditCard, Activity, Settings, LogOut, Menu, X, ChevronDown, Puzzle, Inbox,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// LAYOUT DO BACK-OFFICE
//
// Menu em dois níveis: itens soltos (Dashboard, Cobranças) e grupos que abrem
// (Clientes, Sistema). O grupo que contém a página atual já nasce aberto — quem
// entra num link direto vê onde está, sem precisar caçar.

const MENU = [
  { tipo: 'item', to: '/PainelInicio', label: 'Dashboard', icon: LayoutDashboard },
  {
    tipo: 'grupo',
    id: 'clientes',
    label: 'Clientes',
    icon: Building2,
    filhos: [
      { to: '/PainelClientes', label: 'Clientes', icon: Building2 },
      { to: '/PainelInteressados', label: 'Interessados', icon: Inbox },
      { to: '/PainelPagamentos', label: 'Pagamentos', icon: CreditCard },
      { to: '/PainelIntegracoesClientes', label: 'Integrações', icon: Activity },
    ],
  },
  { tipo: 'item', to: '/PainelCobrancas', label: 'Cobranças', icon: Receipt },
  {
    tipo: 'grupo',
    id: 'sistema',
    label: 'Sistema',
    icon: Settings,
    filhos: [
      { to: '/PainelUsuarios', label: 'Usuários', icon: Users },
      // Estas duas mostram/guardam segredo (chaves dos clientes, token do
      // WhatsApp, senha do SMTP). O backend já recusa a leitura para quem não é
      // admin; esconder do menu evita a tela abrir vazia sem explicação.
      { to: '/PainelApi', label: 'Integrações & API', icon: Plug, somenteAdmin: true },
      { to: '/PainelIntegracoesExternas', label: 'Integrações externas', icon: Puzzle, somenteAdmin: true },
      { to: '/PainelRelatoriosIntegracoes', label: 'Relatórios de Integrações', icon: FileBarChart },
    ],
  },
];

// Título de cada rota, exibido na barra do topo. Fica aqui, e não em cada página,
// porque é o layout que desenha a barra — e assim uma rota nova sem título aparece
// como falta óbvia, em vez de silenciosamente ficar sem.
const TITULOS = {
  '/painelinicio': 'Visão geral',
  '/painelclientes': 'Clientes',
  '/painelinteressados': 'Interessados',
  '/painelpagamentos': 'Pagamentos',
  '/painelintegracoesclientes': 'Integrações dos clientes',
  '/painelcobrancas': 'Cobranças',
  '/painelusuarios': 'Usuários',
  '/painelapi': 'Integrações & API',
  '/painelintegracoesexternas': 'Integrações externas',
  '/painelrelatoriosintegracoes': 'Relatórios de Integrações',
};

export default function LayoutPainel({ children }) {
  const location = useLocation();
  const { user } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);

  const ativo = (to) => location.pathname.toLowerCase() === to.toLowerCase();
  const tituloPagina = TITULOS[location.pathname.toLowerCase()] || '';

  // Esconder do menu é conveniência, não proteção: quem digitar a URL chega na
  // tela. Ela é que virá vazia, porque o backend recusa os dados.
  const ehAdmin = user?.role === 'admin' || user?.acesso_global === true;
  const visivel = (item) => !item.somenteAdmin || ehAdmin;
  const filhosVisiveis = (g) => g.filhos.filter(visivel);
  const grupoTemAtivo = (g) => filhosVisiveis(g).some((f) => ativo(f.to));

  // Abre o grupo da página atual (e mantém aberto o que o usuário abrir).
  const [abertos, setAbertos] = useState(() => {
    const inicial = {};
    MENU.filter((m) => m.tipo === 'grupo').forEach((g) => {
      inicial[g.id] = g.filhos.some((f) => location.pathname.toLowerCase() === f.to.toLowerCase());
    });
    return inicial;
  });

  useEffect(() => {
    setAbertos((atual) => {
      const novo = { ...atual };
      MENU.filter((m) => m.tipo === 'grupo').forEach((g) => {
        if (grupoTemAtivo(g)) novo[g.id] = true;
      });
      return novo;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sair = async () => {
    try { await base44.auth.logout(); } catch { /* segue para a landing de todo jeito */ }
    window.location.href = '/';
  };

  const iniciais = String(user?.full_name || 'A')
    .trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  const linhaItem = (item, dentroDeGrupo = false) => {
    const Icone = item.icon;
    const isAtivo = ativo(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMenuAberto(false)}
        className={`flex items-center gap-3 rounded-lg py-2.5 text-sm transition-colors ${
          dentroDeGrupo ? 'pl-3 pr-3' : 'px-3'
        } ${isAtivo ? 'bg-white/10 text-white font-medium' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
      >
        <Icone className={`w-[18px] h-[18px] shrink-0 ${isAtivo ? 'text-white' : 'text-gray-400'}`} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  };

  const navegacao = (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {MENU.map((m) => {
        if (m.tipo === 'item') return linhaItem(m);

        const Icone = m.icon;
        const aberto = abertos[m.id];
        const temAtivo = grupoTemAtivo(m);
        return (
          <div key={m.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => setAbertos((a) => ({ ...a, [m.id]: !a[m.id] }))}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                temAtivo && !aberto ? 'text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icone className="w-[18px] h-[18px] shrink-0 text-gray-400" />
              <span className="truncate">{m.label}</span>
              <ChevronDown className={`ml-auto w-4 h-4 text-gray-500 transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>
            {aberto && (
              <div className="ml-[19px] pl-3 border-l border-white/10 space-y-0.5">
                {filhosVisiveis(m).map((f) => linhaItem(f, true))}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col bg-[#18181B] text-zinc-300">
        <div className="h-16 flex items-center px-5 border-b border-white/5 shrink-0">
          <span className="font-semibold tracking-tight text-white">Construlog</span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-zinc-500">painel</span>
        </div>
        {navegacao}
        <div className="p-3 border-t border-white/5 shrink-0">
          <button
            type="button"
            onClick={sair}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sair
          </button>
        </div>
      </aside>

      {/* Topo (mobile) */}
      <header className="md:hidden sticky top-0 z-40 h-14 bg-[#18181B] flex items-center justify-between gap-3 px-4">
        {/* No mobile a marca dá lugar ao título quando há um: numa tela estreita,
            saber onde se está vale mais do que repetir o nome do produto. */}
        <span className="font-semibold tracking-tight text-white truncate">
          {menuAberto ? 'Construlog' : (tituloPagina || 'Construlog')}
        </span>
        <button type="button" onClick={() => setMenuAberto((v) => !v)} aria-label="Menu" className="p-2 -mr-2 text-gray-300">
          {menuAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {menuAberto && (
        <div className="md:hidden fixed inset-x-0 top-14 bottom-0 z-40 bg-[#18181B] flex flex-col overflow-y-auto">
          {navegacao}
          <div className="p-3 border-t border-white/5">
            <button
              type="button"
              onClick={sair}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400"
            >
              <LogOut className="w-[18px] h-[18px]" /> Sair
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <div className="md:pl-60">
        <div className="hidden md:flex h-16 items-center gap-3 px-6 border-b border-gray-200 bg-white/85 backdrop-blur sticky top-0 z-30">
          <h1 className="text-base font-semibold text-gray-900 truncate">{tituloPagina}</h1>

          {/* Menu do usuário. Usa o DropdownMenu do kit em vez de um popover
              caseiro: já resolve fechar ao clicar fora, Esc e navegação por
              teclado — coisas fáceis de esquecer numa implementação à mão. */}
          {/* modal={false}: no modo padrão o Radix trava o scroll do body e
              compensa a largura da barra de rolagem, o que fazia a página
              "pular" ao abrir o menu. Sem modal, nada disso acontece — e aqui
              não faz falta, porque é um menu simples, não um diálogo. */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="ml-auto flex items-center gap-3 rounded-lg px-2 py-1.5 -mr-2 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40">
              <span className="text-right leading-tight">
                <span className="block text-sm font-semibold text-gray-900">{user?.full_name || 'Administrador'}</span>
                <span className="block text-xs text-gray-400">{user?.email}</span>
              </span>
              <span className="grid place-items-center w-9 h-9 rounded-full bg-blue-600 text-sm font-semibold text-white shrink-0">
                {iniciais}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'Administrador'}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                {user?.role && (
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mt-1">{user.role}</p>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/PainelUsuarios" className="cursor-pointer gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  Usuários do painel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={sair} className="cursor-pointer gap-2 text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="w-4 h-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
