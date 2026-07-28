import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { setSessionToken } from './apiClient';

const AppBootstrapContext = createContext(null);

const BOOTSTRAP_TIMEOUT = 8000;
const MAX_RETRIES = 1;
const RETRY_DELAYS = [500];
const TOTAL_BOOT_TIMEOUT = 30000;

// Helper: verificar se já fez boot hoje
function shouldShowBootstrap() {
  try {
    const lastBoot = localStorage.getItem('bootstrap-last-shown');
    if (!lastBoot) return true;
    
    const lastBootDate = new Date(lastBoot);
    const today = new Date();
    
    // Se é outro dia, mostrar bootstrap
    if (lastBootDate.toDateString() !== today.toDateString()) {
      return true;
    }
    
    // Mesmo dia, não mostrar
    return false;
  } catch (err) {
    // Erro no localStorage, mostrar por segurança
    return true;
  }
}

// Marcar que bootstrap foi mostrado hoje
function markBootstrapShown() {
  try {
    localStorage.setItem('bootstrap-last-shown', new Date().toISOString());
  } catch (err) {
    console.warn('[Bootstrap] Failed to save date:', err);
  }
}

/**
 * Provider que gerencia bootstrap da aplicação em sequência:
 * SÓ MOSTRA LOADING UMA VEZ POR DIA
 * SEPARADO: bootStatus (BOOT único) vs routeLoading (navegações entre telas)
 * Com AbortController + timeout (nunca fica preso)
 * bootStatus.ready = nunca volta para 'loading' em navegações
 * 1) Autenticação
 * 2) RBAC
 * 3) Menu
 * 4) Bootstrap completo
 */
export function AppBootstrapProvider({ children }) {
  // Verificar se deve mostrar bootstrap (apenas primeira vez no dia)
  const shouldShowLoading = useRef(shouldShowBootstrap());
  
  // BOOT state (só muda: loading → ready | error, NUNCA volta)
  const [bootStatus, setBootStatus] = useState(() => {
    // Se não deve mostrar loading, já inicia como 'ready' (silencioso)
    return shouldShowLoading.current ? 'loading' : 'ready';
  });
  const [bootError, setBootError] = useState(null);
  const [bootStep, setBootStep] = useState('auth');
  
  const abortControllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const bootLogRef = useRef([]);
  const bootStartedRef = useRef(false);
  const bootCompletedRef = useRef(!shouldShowLoading.current); // Se não deve mostrar, já marca como completo
  const totalBootStartRef = useRef(Date.now());

  // 1) AUTENTICAÇÃO
    const { data: user, isLoading: userLoading, error: userError, refetch: refetchUser } = useQuery({
      queryKey: ['bootstrap-user'],
      queryFn: async () => {
        bootLog('step=auth start');
        const start = performance.now();
        try {
          const u = await base44.auth.me();
          const elapsed = performance.now() - start;

          if (u && u.email) {
            setSessionToken(u.email);
          }

          // Validar status via snapshot (evita cache). Papel atribuído (role != 'user')
          // = criado por admin → já aprovado (gestores do seed multi-empresa).
          let isApproved = u.status === 'ativo' || u.status_acesso === 'aprovado' ||
            (!!u.role && u.role !== 'user');

          if (!isApproved && u.role !== 'admin' && u.role !== 'programador') {
            try {
              const snapshotRes = await base44.functions.invoke('getUserApprovalSnapshot', {});
              const snapshot = snapshotRes?.data?.snapshot;
              isApproved = snapshot?.status === 'ativo' || snapshot?.status_acesso === 'aprovado';
              bootLog(`step=auth snapshot status=${snapshot?.status} approved=${isApproved}`);
            } catch (err) {
              bootLog(`step=auth snapshot error: ${err.message}`);
            }
          }

          bootLog(`step=auth ok t=${elapsed.toFixed(0)}ms user=${u.email} approved=${isApproved}`);
          return { ...u, _isApproved: isApproved };
        } catch (err) {
          bootLog(`step=auth error ${err.message}`);
          throw err;
        }
      },
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false
    });

  // 2) RBAC (com retry para 502)
  const { data: rbacData, isLoading: rbacLoading, error: rbacError, refetch: refetchRbac } = useQuery({
    queryKey: ['bootstrap-rbac', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      bootLog(`step=rbac start user=${user.email}`);

      let retryCount = 0;
      const maxRetries = 2;

      const tryRbac = async () => {
        const start = performance.now();
        try {
          const res = await base44.functions.invoke('getEffectivePermissionsV2', {
            userId: user.email
          });
          const elapsed = performance.now() - start;
          bootLog(`step=rbac ok t=${elapsed.toFixed(0)}ms`);
          return res.data;
        } catch (err) {
          const status = err?.response?.status;
          // 404 = função não encontrada ou usuário sem permissões cadastradas → fallback, não retry
          if (status === 404) {
            const perfil = user?.perfil_acesso || user?.perfil_sistema || user?.role || '';
            const isAdminEmpresaFallback = perfil === 'admin_empresa' || user?.cargo === 'admin_empresa';
            const isSuperFallback = perfil === 'programador' || user?.role === 'admin';
            bootLog(`step=rbac 404 - usando fallback perfil=${perfil} isAdmin=${isAdminEmpresaFallback} isSuper=${isSuperFallback}`);
            return { 
              isSuperAdmin: isSuperFallback, 
              isCompanyAdmin: isAdminEmpresaFallback || isSuperFallback,
              permissions: [], 
              legacy: {},
              effectivePermissionsV2: isSuperFallback ? { ADMIN_CONFIG: true, PROFILE_EDIT: true } :
                isAdminEmpresaFallback ? { PROFILE_EDIT: true, DASHBOARD_VIEW: true } : { PROFILE_EDIT: true }
            };
          }
          if ((status === 502 || status === 503) && retryCount < maxRetries) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 500;
            bootLog(`step=rbac 502/503 retry=${retryCount}/${maxRetries} delay=${delay}ms`);
            await new Promise(r => setTimeout(r, delay));
            return tryRbac();
          }
          bootLog(`step=rbac error ${err.message} status=${status} - usando fallback`);
          // Para qualquer outro erro, usar fallback em vez de quebrar o boot
          return { isSuperAdmin: false, isCompanyAdmin: false, permissions: [], legacy: {} };
        }
      };

      return tryRbac();
    },
    enabled: !!user?.email,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false
  });

  // 3) MENU (com retry para 502)
    const { data: menuData, isLoading: menuLoading, error: menuError, refetch: refetchMenu } = useQuery({
      queryKey: ['bootstrap-menu', user?.email],
      queryFn: async () => {
        if (!user?.email || !rbacData) return null;

        bootLog(`step=menu start user=${user.email} super=${rbacData?.isSuperAdmin}`);

        let retryCount = 0;
        const maxRetries = 2;

        const tryMenu = async () => {
          const start = performance.now();
          try {
            const res = await Promise.race([
              base44.functions.invoke('getMenuForBootstrap', {
                userId: user.email,
                isSuperAdmin: rbacData?.isSuperAdmin,
                isCompanyAdmin: rbacData?.isCompanyAdmin
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Menu timeout')), BOOTSTRAP_TIMEOUT)
              )
            ]);

            const result = res.data || {};
            const menuIds = Array.isArray(result) ? result : (result.menuIds || []);
            const elapsed = performance.now() - start;

            bootLog(`step=menu ok menuIds=${menuIds.length} t=${elapsed.toFixed(0)}ms`);
            return menuIds;
          } catch (err) {
            const status = err?.response?.status;
            if (status === 404) {
              bootLog(`step=menu 404 - usando menu padrão`);
              return [];
            }
            if ((status === 502 || status === 503) && retryCount < maxRetries) {
              retryCount++;
              const delay = Math.pow(2, retryCount) * 500;
              bootLog(`step=menu 502/503 retry=${retryCount}/${maxRetries} delay=${delay}ms`);
              await new Promise(r => setTimeout(r, delay));
              return tryMenu();
            }
            bootLog(`step=menu error ${err.message} status=${status} - usando menu padrão`);
            return [];
          }
        };

        return tryMenu();
      },
      enabled: !!user?.email && !!rbacData,
      staleTime: Infinity,
      gcTime: Infinity,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: false
    });

  // Log helper
  const bootLog = useCallback((msg) => {
    const fullMsg = `[BOOT] ${msg}`;
    console.log(fullMsg);
    bootLogRef.current.push(fullMsg);
  }, []);

  // Orquestrar boot - SÓ EXECUTA SE shouldShowLoading = true
   useEffect(() => {
     // Se não deve mostrar loading, não executar bootstrap visual
     if (!shouldShowLoading.current) {
       return;
     }

     // PROTEÇÃO ABSOLUTA: Se já completou, NUNCA mais executa
     if (bootCompletedRef.current) {
       return;
     }

     // Se já iniciou o boot, não re-executa
     if (bootStartedRef.current) {
       return;
     }

     let currentStep = 'auth';
     let retryCount = 0;

     const executeBootstrap = async () => {
       bootLog('start');
       bootStartedRef.current = true;

       // PROTEÇÃO CONTRA INFINITO
       const elapsedTotal = Date.now() - totalBootStartRef.current;
       if (elapsedTotal > TOTAL_BOOT_TIMEOUT) {
         bootLog(`CRITICAL: Total boot timeout (${elapsedTotal}ms > ${TOTAL_BOOT_TIMEOUT}ms)`);
         bootCompletedRef.current = true;
         setBootError({ step: 'timeout', message: 'Inicialização expirou. Tente recarregar.' });
         setBootStatus('error');
         return;
       }

      // Step 1: Auth
      if (!user && !userLoading && !userError) {
        setBootStep('auth');
        return;
      }
      if (userError) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          bootLog(`step=auth retry=${retryCount}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount - 1]));
          refetchUser();
          return;
        }
        bootLog(`step=auth FAILED after ${MAX_RETRIES} retries - modo anônimo/fallback`);
        setBootError({ step: 'auth', message: userError.message });
        bootCompletedRef.current = true;
        markBootstrapShown(); // Marcar que foi mostrado
        setBootStatus('ready');
        return;
      }

      currentStep = 'rbac';

      // Step 2: RBAC
      if (!rbacData && !rbacLoading && !rbacError) {
        setBootStep('rbac');
        return;
      }
      if (rbacError) {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          bootLog(`step=rbac retry=${retryCount}/${MAX_RETRIES}`);
          await new Promise(r => setTimeout(r, RETRY_DELAYS[retryCount - 1]));
          refetchRbac();
          return;
        }
        bootLog(`step=rbac FAILED after ${MAX_RETRIES} retries - usando fallback`);
        // FALLBACK: sempre liberar acesso em caso de erro
        bootCompletedRef.current = true;
        markBootstrapShown();
        setBootStatus('ready');
        return;
      }

      currentStep = 'menu';

      // Step 3: Menu
      if (!menuData && !menuLoading && !menuError) {
        setBootStep('menu');
        return;
      }
      if (menuError) {
         bootLog(`step=menu FAILED - liberando acesso com menu padrão`);
         bootCompletedRef.current = true;
         markBootstrapShown();
         setBootStatus('ready');
         return;
       }

      // SUCESSO - Marcar que foi mostrado hoje
      bootLog(`complete user=${user?.email} menuIds=${menuData?.length || 0}`);
      bootCompletedRef.current = true;
      bootStartedRef.current = true;
      markBootstrapShown(); // Marcar que foi mostrado
      setBootStatus('ready');
      };

      if (!userLoading && !rbacLoading && !menuLoading) {
      executeBootstrap();
      }
      }, [user, userLoading, userError, rbacData, rbacLoading, rbacError, menuData, menuLoading, menuError, bootLog, refetchUser, refetchRbac, refetchMenu]);

  // Retry manual: limpa localStorage e permite re-boot
   const retryBootstrap = useCallback(() => {
     if (!bootCompletedRef.current) {
       console.warn('[Bootstrap] Retry while already booting');
       return;
     }
     
     // Limpar localStorage para forçar re-boot
     try {
       localStorage.removeItem('bootstrap-last-shown');
     } catch (err) {
       console.warn('[Bootstrap] Failed to clear date:', err);
     }
     
     bootCompletedRef.current = false;
     bootStartedRef.current = false;
     shouldShowLoading.current = true;
     setBootStatus('loading');
     setBootError(null);
     setBootStep('auth');
     refetchUser();
   }, [refetchUser]);

  const value = {
    status: bootStatus,
    step: bootStep,
    error: bootError,
    user,
    rbac: rbacData,
    menuIds: menuData || [],
    ready: bootStatus === 'ready',
    retry: retryBootstrap,
    logs: bootLogRef.current
  };

  return (
    <AppBootstrapContext.Provider value={value}>
      {children}
    </AppBootstrapContext.Provider>
  );
}

export function useAppBootstrap() {
  const context = useContext(AppBootstrapContext);
  if (!context) {
    throw new Error('useAppBootstrap must be used within AppBootstrapProvider');
  }
  return context;
}