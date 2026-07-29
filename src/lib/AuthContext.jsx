import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// Versão self-host do AuthContext. A versão original do base44 consultava a
// nuvem (/prod/public-settings) e usava o token da URL. Aqui a autenticação é
// 100% local: base44.auth.me() bate em /api/auth/me com o JWT do localStorage.
// O shim (base44Client) exibe automaticamente o overlay de login em 401.

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState({ id: 'construlog', public_settings: {} });

  useEffect(() => {
    checkAppState();
    // Quando o shim sinaliza 401 (sessão expirada), re-checa → mostra a LoginScreen.
    const onUnauthorized = () => checkAppState();
    window.addEventListener('construlog:unauthorized', onUnauthorized);
    return () => window.removeEventListener('construlog:unauthorized', onUnauthorized);
  }, []);

  const checkAppState = async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      // 401 → o shim já abriu o overlay de login. Sinalizamos auth_required
      // para o App não renderizar as rotas protegidas enquanto isso.
      if (!error || error.status === 401 || error.status === 403) {
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      } else {
        setAuthError({ type: 'unknown', message: error.message || 'Falha ao carregar' });
      }
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    base44.auth.logout();
    if (shouldRedirect) base44.auth.redirectToLogin();
  };

  const navigateToLogin = () => {
    base44.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
