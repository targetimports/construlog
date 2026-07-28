import { useEffect } from 'react'
import { toast } from 'sonner'
import { AppToaster } from "@/components/ui/AppToaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import ScrollToTop from '@/lib/ScrollToTop'
import { ConfirmarHost } from '@/lib/confirmar'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import LoginScreen from '@/components/auth/LoginScreen';
import LandingPage from '@/components/landing/LandingPage';
import AjudaPublica from '@/components/landing/AjudaPublica';
import EmissaoNFe from '@/pages/EmissaoNFe';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();
  const location = useLocation();

  // Boas-vindas: o LoginScreen deixa o sinal 'germanos:bemvindo' antes do reload;
  // aqui, com o usuário já carregado, exibimos o toast e limpamos o sinal (uma vez).
  useEffect(() => {
    if (isAuthenticated && user && sessionStorage.getItem('germanos:bemvindo')) {
      sessionStorage.removeItem('germanos:bemvindo');
      const primeiroNome = String(user.full_name || '').trim().split(' ')[0];
      toast.success(primeiroNome ? `Bem-vindo, ${primeiroNome}!` : 'Login efetuado com sucesso');
    }
  }, [isAuthenticated, user]);
  // A landing pública ("/") renderiza sem esperar auth e sem tela de login.
  const isLanding = location.pathname === '/';
  // A Central de Ajuda também é pública: quem não tem sessão vê a versão com a
  // navbar da landing, sem sidebar. Ela não pula o carregamento do auth (senão
  // um usuário logado veria a casca pública piscar antes de virar a do app) —
  // só não cai na tela de login quando não há sessão.
  const isAjuda = location.pathname.toLowerCase() === '/ajuda';

  // Spinner enquanto carrega settings/auth — exceto na landing pública.
  if (!isLanding && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Sem sessão em /Ajuda: entrega a versão pública em vez de exigir login.
  if (isAjuda && !isAuthenticated) {
    return <AjudaPublica />;
  }

  // Gate de autenticação — só para rotas protegidas (não para a landing/ajuda).
  if (!isLanding && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <LoginScreen />;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/EmissaoNFe" element={
        <LayoutWrapper currentPageName="EmissaoNFe">
          <EmissaoNFe />
        </LayoutWrapper>
      } />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <AppToaster />
        <ConfirmarHost />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App