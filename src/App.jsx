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
import { ERP_ATIVO, ROTA_POS_LOGIN } from '@/config/modulos';
// <<< BACKOFFICE — bloco removido ao empacotar para o cliente
// (scripts/empacotar-cliente.sh recorta entre os marcadores). Não tire os
// marcadores nem misture código do ERP aqui dentro.
import LayoutPainel from '@/components/painel/LayoutPainel';
import PainelInicio from '@/pages/PainelInicio';
import PainelClientes from '@/pages/PainelClientes';
import PainelPagamentos from '@/pages/PainelPagamentos';
import PainelIntegracoesClientes from '@/pages/PainelIntegracoesClientes';
import PainelCobrancas from '@/pages/PainelCobrancas';
import PainelUsuarios from '@/pages/PainelUsuarios';
import PainelApi from '@/pages/PainelApi';
import PainelRelatoriosIntegracoes from '@/pages/PainelRelatoriosIntegracoes';
// >>> BACKOFFICE
import BloqueioLicenca, { useLicenca } from '@/components/licenca/BloqueioLicenca';
import ConfiguracaoInicial from '@/components/instalacao/ConfiguracaoInicial';
import { useInstalacao } from '@/components/instalacao/useInstalacao';

const { Pages, Layout } = pagesConfig;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Quem já tem sessão e abre /Login vai direto para a tela inicial.
const RedirecionarParaDashboard = () => {
  useEffect(() => { window.location.replace(ROTA_POS_LOGIN); }, []);
  return null;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, user } = useAuth();
  const location = useLocation();
  const { estado: licenca, bloqueado } = useLicenca();
  const { configurado, recarregar: recarregarInstalacao } = useInstalacao();

  // Boas-vindas: o LoginScreen deixa o sinal 'construlog:bemvindo' antes do reload;
  // aqui, com o usuário já carregado, exibimos o toast e limpamos o sinal (uma vez).
  useEffect(() => {
    if (isAuthenticated && user && sessionStorage.getItem('construlog:bemvindo')) {
      sessionStorage.removeItem('construlog:bemvindo');
      const primeiroNome = String(user.full_name || '').trim().split(' ')[0];
      toast.success(primeiroNome ? `Bem-vindo, ${primeiroNome}!` : 'Login efetuado com sucesso');
    }
  }, [isAuthenticated, user]);

  // LICENÇA NEGADA: a tela de bloqueio ENTRA NO LUGAR da aplicação, não por cima.
  // Overlay se apaga pelo console; aqui não há nada renderizado atrás para
  // aparecer. A tranca real é o backend, que responde 423 em toda a API.
  //
  // A landing ("/") é a única exceção: é página pública de vitrine, não dá acesso
  // a dado nenhum, e derrubá-la junto tiraria do ar a cara da empresa por causa de
  // uma pendência de contrato. Todo o resto — inclusive /Login — vira a tela de
  // bloqueio.
  if (bloqueado && location.pathname !== '/') {
    return <BloqueioLicenca estado={licenca} />;
  }

  // A landing pública ("/") renderiza sem esperar auth e sem tela de login.
  const isLanding = location.pathname === '/';
  // Rota de login própria: é a única porta de entrada do sistema.
  const isLogin = location.pathname.toLowerCase() === '/login';
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
      // VISITANTE ANÔNIMO: o sistema não existe para ele.
      //
      // Fora de "/", "/Ajuda" e "/Login", qualquer caminho responde 404 — em vez
      // da tela de login, que confirmaria "esta rota existe, só falta entrar".
      // É ocultação, não autorização: quem protege os dados é o backend, que
      // exige token em toda rota de API. Aqui só se evita expor o mapa do
      // sistema (e a lista de módulos) para quem chega de fora.
      if (isLogin) return <LoginScreen />;
      return <PageNotFound />;
    }
  }

  // INSTALAÇÃO NOVA: quem entra como admin cai na configuração inicial antes de
  // qualquer tela. Fica depois do gate de autenticação de propósito — configurar
  // cria a empresa e amarra o acesso, então não pode ser aberto a anônimos.
  if (isAuthenticated && configurado === false && user?.role === 'admin') {
    return <ConfiguracaoInicial onPronto={() => { recarregarInstalacao(); window.location.replace(ROTA_POS_LOGIN); }} />;
  }

  // Já autenticado em /Login: não faz sentido pedir login de novo.
  if (isLogin) {
    return isAuthenticated ? <RedirecionarParaDashboard /> : <LoginScreen />;
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* Rota real de login (antes a tela só aparecia no lugar da página pedida). */}
      <Route path="/Login" element={isAuthenticated ? <RedirecionarParaDashboard /> : <LoginScreen />} />

      {/* <<< BACKOFFICE — PAINEL DO FORNECEDOR (sai no pacote do cliente) */}
      <Route path="/PainelInicio" element={<LayoutPainel><PainelInicio /></LayoutPainel>} />
      <Route path="/PainelClientes" element={<LayoutPainel><PainelClientes /></LayoutPainel>} />
      <Route path="/PainelPagamentos" element={<LayoutPainel><PainelPagamentos /></LayoutPainel>} />
      <Route path="/PainelIntegracoesClientes" element={<LayoutPainel><PainelIntegracoesClientes /></LayoutPainel>} />
      <Route path="/PainelCobrancas" element={<LayoutPainel><PainelCobrancas /></LayoutPainel>} />
      <Route path="/PainelUsuarios" element={<LayoutPainel><PainelUsuarios /></LayoutPainel>} />
      <Route path="/PainelApi" element={<LayoutPainel><PainelApi /></LayoutPainel>} />
      <Route path="/PainelRelatoriosIntegracoes" element={<LayoutPainel><PainelRelatoriosIntegracoes /></LayoutPainel>} />
      {/* >>> BACKOFFICE */}

      {/* ERP de obras: só entra no roteador com a chave ligada (config/modulos.js).
          Desligado, estas rotas nem existem e caem no 404 abaixo. */}
      {ERP_ATIVO && Object.entries(Pages).map(([path, Page]) => (
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
      {ERP_ATIVO && (
        <Route path="/EmissaoNFe" element={
          <LayoutWrapper currentPageName="EmissaoNFe">
            <EmissaoNFe />
          </LayoutWrapper>
        } />
      )}
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