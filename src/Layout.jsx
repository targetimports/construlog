import React, { useState, useEffect, useMemo } from 'react';
import SidebarCompact from './components/layout/SidebarCompact';
import TopHeader from './components/layout/TopHeader';
import { GlobalContextProvider } from './components/shared/GlobalContextProvider';
import { RBACProvider } from './components/shared/RBACContext';
import { AppBootstrapProvider, useAppBootstrap } from './components/shared/AppBootstrapProvider';
import BootstrapErrorScreen from './components/layout/BootstrapErrorScreen';
import BootstrapLoadingScreen from './components/layout/BootstrapLoadingScreen';
import { menuItems } from './components/layout/navigation';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Menu, X, Home, Plus, User, Building2, FileSpreadsheet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import UserAvatar from './components/shared/UserAvatar';

import AguardandoAprovacao from './components/auth/AguardandoAprovacao';
import GlobalSearch from './components/shared/GlobalSearch';
import NotificationCenter from './components/shared/NotificationCenter';
import BellNotifications from './components/shared/BellNotifications';
import DiagnosticoAmbiente from './components/diagnostico/DiagnosticoAmbiente';
import ErrorBoundary from './components/layout/ErrorBoundary.jsx';
import MiniChatIA from './components/ia/MiniChatIA';

import { useKeyboardShortcuts, COMMON_SHORTCUTS } from './components/shared/useKeyboardShortcuts';
import RouteRedirects from './components/layout/RouteRedirects';
import NavigationValidator from './components/layout/NavigationValidator';
import RouteGuardWithFallback from './components/layout/RouteGuardWithFallback';
import { FinancePeriodProvider } from './components/shared/FinancePeriodProvider';
import { BrandingEffect } from './components/shared/useBranding';
import { toast } from 'sonner';

// IDs de menu permitidos para motorista.
// 'ativos' = Logística & Frota, onde moram as Viagens de Entrega (a seção 'logistica'
// não existe mais). 'obras' = as obras em que ele trabalha — o filtro "só as minhas
// obras" (obraScope) já limita a lista, então ele não enxerga o canteiro dos outros.
const MOTORISTA_MENU_IDS = ['dashboard', 'calendario', 'ativos', 'obras', 'ajuda', 'meu-perfil'];

// Páginas permitidas para motorista (page names)
const MOTORISTA_PAGES_ALLOWED = [
  // Fluxo atual: entregas + obras em que ele atua.
  'ViagensEntregas', 'Obras', 'ObraDetalhes',
  'Logistica', 'MinhasViagens', 'ViagensAbastecimentos', 'SolicitacoesVeiculos',
  'SolicitacoesMaquinas', 'Dashboard', 'Ajustes', 'Ajuda', 'AjustesPessoais',
  'MinhasNotificacoes', 'GerenciadorAtalhos', 'Frota', 'Motoristas',
  'RastreamentoGPS', 'GestorCustosViagens', 'DashboardLogistica',
  'LogisticaAvancada', 'AlertasIA', 'MonitoramentoViagens', 'ViagensPorAbastecer',
  'RotasMotorista', 'SolicitacaoDetalhes', 'SolicitacaoForm',
  'VeiculoDetalhes'
];

function isMotorista(user) {
  return user?.cargo?.toLowerCase() === 'motorista' || user?.perfil_acesso?.toLowerCase() === 'motorista';
}

function filterMenuForMotorista(items) {
  return items.filter(item => MOTORISTA_MENU_IDS.includes(item.id));
}

// Componente interno (após bootstrap)
function LayoutContent({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [obraMenuOpen, setObraMenuOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(() => {
    const saved = localStorage.getItem('sidebar-compact');
    return saved !== 'false';
  });
  const [menusLoaded, setMenusLoaded] = useState(false);

  const bootstrap = useAppBootstrap();
  const { menuIds: bootstrapMenuIds = [] } = bootstrap;

  // Verificar se está em modo debug
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debugMode = params.has('debug') && params.get('debug') === '1';
    setShowDebug(debugMode);
  }, []);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000, // 5 min — evita 4+ chamadas redundantes ao auth
    refetchOnWindowFocus: false
  });

  // Bloqueio de rota para motorista
  useEffect(() => {
    if (!user || !isMotorista(user)) return;
    const currentPage = currentPageName || '';
    const isAllowed = MOTORISTA_PAGES_ALLOWED.some(p => 
      currentPage === p || currentPage.startsWith(p)
    );
    if (!isAllowed && currentPage) {
      toast.error('Acesso restrito: motorista vê entregas e as obras em que atua.');
      window.location.href = createPageUrl('ViagensEntregas');
    }
  }, [currentPageName, user]);

  // Filtrar menuItems com base nos IDs do bootstrap + RBAC
  const displayItems = useMemo(() => {
    // Seção TI é EXCLUSIVA do perfil de TI (programador) — nem o admin a vê.
    // Usa a mesma precedência de perfil do RBAC (perfil_acesso primeiro).
    const ehTI = String(user?.perfil_acesso || user?.perfil_sistema || user?.role || '').toLowerCase().trim() === 'programador';
    const semTI = (arr) => (ehTI ? arr : arr.filter(item => item.id !== 'ti'));

    // Itens marcados como visivel:false são ocultos do menu (ex.: os dashboards
    // específicos por papel, que servem só para redirect). No base44 isso vinha
    // do getMenuForBootstrap; aqui honramos o flag diretamente.
    const visibleMenu = menuItems.filter(item => item.visivel !== false);

    // Motorista: apenas logística
    if (user && isMotorista(user)) {
      const filtered = filterMenuForMotorista(visibleMenu);
      // Remover "Máquinas" do submenu de Logística para motorista
      return semTI(filtered.map(item => {
        if (item.id === 'logistica' && item.groups) {
          return {
            ...item,
            groups: item.groups.map(group => ({
              ...group,
              items: group.items.filter(subItem => !subItem.motorista_denied)
            }))
          };
        }
        return item;
      }));
    }

    if (!bootstrapMenuIds || !Array.isArray(bootstrapMenuIds)) {
      return semTI(visibleMenu);
    }

    const filtered = visibleMenu.filter(item => bootstrapMenuIds.includes(item.id));
    return semTI(filtered.length > 0 ? filtered : visibleMenu);
  }, [bootstrapMenuIds, user]);

  // Atalhos de teclado globais (apenas após menus prontos)
  useKeyboardShortcuts(menusLoaded ? [
    {
      keys: COMMON_SHORTCUTS.SEARCH,
      action: () => setGlobalSearchOpen(true)
    },
    {
      keys: COMMON_SHORTCUTS.CLOSE,
      action: () => {
        setGlobalSearchOpen(false);
        setMobileMenuOpen(false);
      }
    }
  ] : []);

  // A largura da sidebar (240px expandida / 68px recolhida) é definida pela
  // própria Sidebar via --sidebar-width.

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  // Sanitizar URL (remover text fragments do Chrome)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.location.hash && window.location.hash.includes(':~:text=')) {
        const cleanHash = window.location.hash.split(':~:text=')[0];
        window.history.replaceState({}, '', cleanHash || window.location.pathname);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Se usuário está aguardando aprovação, mostra tela de aguardo
  // SÓ libera se: status_acesso = 'aprovado' OU status = 'ativo' OU super admin
  if (!userLoading && user) {
    // Super admins (role=admin, role=programador) nunca veem tela de aguardo
    const isSuperAdmin = user.role === 'admin' || user.role === 'programador';

    if (!isSuperAdmin) {
      // Aprovado se status='ativo' OU status_acesso='aprovado'
      // (usuários criados via CRUD de Usuários nascem com status='ativo').
      // Usuário com PAPEL atribuído (role != 'user') foi criado por um admin → já
      // aprovado (ex.: gestores do seed multi-empresa não têm status gravado).
      const isApproved =
        user.status === 'ativo' || user.status_acesso === 'aprovado' ||
        (!!user.role && user.role !== 'user');

      const isPending = !isApproved && (
        (user.status_acesso === 'pendente' || !user.status_acesso) ||
        (user.status === 'aguardando_aprovacao' || user.status === 'pendente')
      );

      // NÃO liberar enquanto não estiver aprovado
      if (isPending) {
        return <AguardandoAprovacao user={user} />;
      }
    }
  }

  return (
     <ErrorBoundary>
     <BrandingEffect />
     <div className="flex w-full min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Top bar mobile — leve/sutil: logo · notificações · menu */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-white/85 backdrop-blur-md border-b border-gray-200/70 z-40 flex items-center justify-between px-3">
        <Link to={createPageUrl('Dashboard')} className="flex items-center gap-2 min-w-0" aria-label="Início">
          <img src="/icon.svg" alt="" className="w-8 h-8 rounded-lg flex-shrink-0" />
          <span className="font-bold tracking-tight text-gray-900 truncate">Construlog</span>
        </Link>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {user && <BellNotifications tema="claro" />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center h-11 w-11 text-gray-700 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors"
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Bottom bar mobile — pílula preta full-width: Home · + (nova obra) · Perfil */}
      <nav
        className="md:hidden fixed inset-x-3 z-40 bg-[#18181B] rounded-full flex items-center justify-around px-4 py-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.4)]"
        style={{ bottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          to={createPageUrl('Dashboard')}
          aria-label="Início"
          className="flex items-center justify-center w-12 h-12 rounded-full text-white/70 hover:text-white active:bg-white/10 transition-colors"
        >
          <Home className="w-6 h-6" />
        </Link>
        <button
          type="button"
          onClick={() => setObraMenuOpen(true)}
          aria-label="Nova obra"
          className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/40 active:scale-95 transition-all"
        >
          <Plus className="w-6 h-6" />
        </button>
        <Link
          to={createPageUrl('AjustesPessoais')}
          aria-label="Perfil"
          className="flex items-center justify-center w-12 h-12 rounded-full text-white/70 hover:text-white active:bg-white/10 transition-colors"
        >
          <User className="w-6 h-6" />
        </Link>
      </nav>

      {/* Sheet (mobile): como cadastrar a obra — manual ou do OrçaFascio */}
      {obraMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[70]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setObraMenuOpen(false)} />
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl p-4 shadow-2xl"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3 px-1">Nova obra</h3>
            <div className="space-y-2">
              <Link
                to={createPageUrl('ObraForm')}
                onClick={() => setObraMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">Cadastrar manualmente</p>
                  <p className="text-xs text-gray-500">Preencher os dados da obra</p>
                </div>
              </Link>
              <Link
                to={createPageUrl('ImportarOrcaFacil')}
                onClick={() => setObraMenuOpen(false)}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">Importar do OrçaFascio</p>
                  <p className="text-xs text-gray-500">Criar a partir do orçamento</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay (fade) */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden={!mobileMenuOpen}
      />

      {/* Mobile Sidebar Drawer (desliza ao abrir/fechar) */}
      <div
        className={`fixed top-0 left-0 h-screen w-72 sm:w-80 bg-[#18181B] z-50 md:hidden overflow-hidden shadow-2xl transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ height: '100dvh' }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!mobileMenuOpen}
      >
        {displayItems && (
          <SidebarCompact
            items={displayItems}
            isMobile={true}
            user={user}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        )}
      </div>

       {/* Desktop Sidebar - Always Fixed */}
                <div className="hidden md:block">
                  <SidebarCompact 
                     items={displayItems || []} 
                     user={user}
                     onToggleCompact={(isCompact) => setSidebarCompact(isCompact)}
                   />
                </div>

      {/* Main Content */}
      <main
        className="app-main flex-1 min-h-screen bg-[#F7F8FA] pt-14 md:pt-0"
        style={{ marginLeft: 'var(--sidebar-width, 240px)', minWidth: 0, width: 0, flex: '1 1 0%', transition: 'margin-left 300ms ease-in-out' }}
      >
       <div className="hidden md:block md:fixed md:top-0 md:right-0 md:z-30" style={{ left: 'var(--sidebar-width, 240px)', transition: 'left 300ms ease-in-out' }}>
         <TopHeader
           currentPageName={currentPageName}
           onSearchClick={() => setGlobalSearchOpen(true)}
         />
       </div>
       <div className="p-3 sm:p-4 md:p-6 md:pt-20 pb-40 md:pb-6 overflow-x-hidden max-w-full">
         {children}
       </div>
       </main>



        {/* Busca Global */}
        <GlobalSearch 
          open={globalSearchOpen} 
          onClose={() => setGlobalSearchOpen(false)} 
        />

        {/* Diagnóstico Dev-Only */}
        {showDebug && <DiagnosticoAmbiente />}

        {/* Assistente IA flutuante (substitui a antiga seção Ajuda) */}
        <MiniChatIA />

        </div>
        </ErrorBoundary>
        );
        }

        // Componente principal - providers estáveis no topo
        export default function Layout({ children, currentPageName }) {
        return (
        <ErrorBoundary>
        <AppBootstrapProvider>
        <GlobalContextProvider>
        <RBACProvider>
        <FinancePeriodProvider>
        <LayoutWrapper children={children} currentPageName={currentPageName} />
        </FinancePeriodProvider>
        </RBACProvider>
        </GlobalContextProvider>
        </AppBootstrapProvider>
        </ErrorBoundary>
        );
        }

        // Intermediário que acessa bootstrap
        function LayoutWrapper({ children, currentPageName }) {
          const bootstrap = useAppBootstrap();

          // Loading: SÓ aparece no BOOT INICIAL (primeira vez)
          // NUNCA aparece em navegação entre telas
          if (bootstrap.status === 'loading') {
            return <BootstrapLoadingScreen step={bootstrap.step} />;
          }

          // Bootstrap pronto: renderizar layout
          return <LayoutContent children={children} currentPageName={currentPageName} />;
        }