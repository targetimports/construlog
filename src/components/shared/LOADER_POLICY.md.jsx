# 🔒 Política de Loading Global vs Local

## ✅ QUANDO Usar Loader Global (BootstrapLoadingScreen)

```
✅ BOOT INICIAL (primeira vez que abre a app)
   - validar sessão
   - carregar permissões (RBAC)
   - carregar menu
   - App começa em bootStatus = 'loading'
   - Loader global aparece
   - Após completar: bootStatus = 'ready' (NUNCA volta)

✅ ERRO NO BOOT (403, 500, timeout)
   - Mostrar BootstrapErrorScreen com retry
   - Se retry falha novamente: bootStatus = 'error'
   - NUNCA voltar para 'loading' automaticamente
```

## ❌ NUNCA Usar Loader Global em Navegação

```
❌ Clicar em card Dashboard → Obras
   - NUNCA mostrar loader global
   - Usar skeleton LOCAL na lista de Obras
   
❌ Mudar de aba (Financeiro tab A → tab B)
   - NUNCA mostrar loader global
   - Usar skeleton LOCAL na aba

❌ Refetch de dados (F5, retry)
   - NUNCA mostrar loader global
   - Usar skeleton LOCAL ou banner de retry

❌ Timeout em qualquer endpoint
   - NUNCA mostrar loader global
   - Mostrar erro inline + botão retry
   - Liberar UI imediatamente
```

## 🏗️ Arquitetura

```
AppBootstrapProvider
  ├── bootStatus: 'loading' | 'ready' | 'error'
  │   └── 🔒 Muda UMA VEZ: loading → (ready | error)
  │   └── NUNCA volta para 'loading' após 'ready'
  │
  └── Context retorna:
      ├── status: bootStatus
      ├── ready: bootStatus === 'ready'
      ├── error: { step, message }
      └── retry: () => força re-boot (APENAS se error)

Layout
  └── if bootStatus === 'loading'
      └── mostra BootstrapLoadingScreen
  └── if bootStatus === 'error'
      └── mostra BootstrapErrorScreen
  └── if bootStatus === 'ready'
      └── renderiza app normal (NUNCA mais loader)

Pages/Components (Obras, Painel, etc)
  └── useQuery/useMutation
      └── NUNCA setam bootStatus
      └── mostram skeleton LOCAL
      └── mostram erro LOCAL (inline)
```

## 🚫 Guardrails

| O que fazer | ✅ Certo | ❌ ERRADO |
|---|---|---|
| Ao navegar | Skeleton local | Loader global |
| Ao dar erro 403 | Toast + card bloqueado | Fullscreen error screen |
| Ao timeout | Retry button + liberar UI | Loader infinito |
| onNavigate com erro | try/catch + toast | throw para ErrorBoundary |
| Clique múltiplo | Guard clause return | Overlay invisível |

## 📋 Checklist de Implementação

- [x] AppBootstrapProvider: bootStatus.ready = NUNCA volta
- [x] AppBootstrapProvider: bootCompletedRef = gate para re-boot
- [x] Layout: loader global SÓ quando status === 'loading'
- [x] SafeCardNavigator: NUNCA set bootStatus
- [x] SafeStatCard: skeleton + retry LOCAL
- [x] Pages: useQuery com skeleton LOCAL
- [x] AbortController + timeout (10s) em cada fetch
- [x] Comentários no código alertando para não disparar loader global

## 🧪 Teste: Entrar → Obras

```
1. Abre app (localhost)
   ✅ Ver: BootstrapLoadingScreen (steps auth/rbac/menu)
   ✅ Duração: 3-5s

2. Completa bootstrap
   ✅ bootStatus = 'ready'
   ✅ BootstrapLoadingScreen some

3. Clicar em card "Obras Cadastradas"
   ✅ NUNCA aparece BootstrapLoadingScreen
   ✅ Skeleton aparece na lista
   ✅ Após 2-3s: dados carregam

4. Navegar: Dashboard → Obras → Estoques → Financeiro
   ✅ NUNCA aparece loader global
   ✅ Skeleton LOCAL em cada página
   ✅ Cliques SEMPRE respondem
```

## 🔍 Debug: Se Loader Global Aparecer em Navegação

```bash
# 1. Verificar console
console.log('[Bootstrap]', bootstrap.status, bootstrap.step)

# 2. Procurar por setBootStatus em navegação
# ❌ ERRADO: onClick={() => setBootStatus('loading')}
# ✅ CERTO: onClick={() => navigate('/Obras')}

# 3. Verificar useQuery loading
# ❌ ERRADO: if (globalLoading) return <Loader/>
# ✅ CERTO: if (isLoading) return <CardSkeleton/>

# 4. Timeout?
# ❌ ERRADO: Loader fica infinito (sem finally)
# ✅ CERTO: finally { setLocalLoading(false) }
``