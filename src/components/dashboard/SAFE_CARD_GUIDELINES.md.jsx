# SafeStatCard - Diretrizes de Implementação

## ✅ Critérios de Aceitação

### 1. Clique Seguro (NUNCA crash)
- [x] Card sempre navega OU mostra aviso (sem throw)
- [x] 403 Forbidden = toast + bloqueado (não throw)
- [x] 500 Error = banner inline + retry (não crash)
- [x] Timeout = skeleton + retry (não trava UI)

### 2. Sem Travamento de Clique
- [x] setIsNavigating sempre resetado (finally block)
- [x] Sem pointer-events-none no overlay (se tivesse, travaria)
- [x] Cliques múltiplos bloqueados com guard clause
- [x] setTimeout + cleanup para liberar flag

### 3. Erro Local (NUNCA ErrorBoundary global)
- [x] try/catch em handleClick (NUNCA rethrow)
- [x] try/catch em onNavigate
- [x] try/catch em navigate()
- [x] Todos erros = toast + log (não dispara boundary)

### 4. Permissão Guardada no onClick
- [x] Validação de `can()` no handleClick
- [x] Se sem permissão = return imediato (não navega)
- [x] Sem verificação de permissão = rota pública

### 5. Rota Resolvida vs Menu
- [x] Se routePath = null = card bloqueado
- [x] Se routePath = string = tenta navegar
- [x] Se sem permissão = bloqueado visualmente

### 6. Skeleton + Retry Local
- [x] CardSkeleton para loading inline
- [x] Botão "Retry" no card (não fullscreen)
- [x] onRetry callback customizado
- [x] Retry com error handling próprio

---

## 📋 Padrão de Uso

```jsx
<SafeStatCard
  title="Obras Cadastradas"
  routePath="/Obras"                    // ✅ Rota segura
  requiredPermission="OBRAS_VIEW"       // ✅ Validada no onClick
  isLoading={loadingObras}              // ✅ Skeleton inline
  data={obras}                          // ✅ Só mostra se data !== null
  error={obraError}                     // ✅ Mostra retry
  onRetry={() => refetchObras()}        // ✅ Retry local
  value={obras.length}
  icon={Building2}
  // ... rest of StatCard props
/>
```

---

## 🔒 Segurança: Fluxo de Clique

```
CLIQUE
  ↓
[1] Bloquear cliques múltiplos? → SIM: return (sem travamento)
  ↓ NÃO
[2] Tem permissão? → NÃO: toast + return
  ↓ SIM
[3] Tem rota? → NÃO: toast + return
  ↓ SIM
[4] Executar onNavigate() com try/catch
  ↓
[5] navigate(routePath) com try/catch
  ↓ (erro ou sucesso)
[6] SEMPRE: setIsNavigating(false) no finally
  ↓
[7] NUNCA throw para ErrorBoundary
```

---

## ❌ Cenários NÃO Permitidos

| Cenário | Antes (ERRADO) | Depois (CORRETO) |
|---------|---|---|
| Sem permissão | Tenta navegar + 403 = crash | Toast + bloqueado |
| Rota não existe | Navega para vazio | Card desabilitado |
| Erro de API | Fullscreen ErrorBoundary | Banner inline + retry |
| Clique múltiplo | Trava | Guard clause + return |
| Timeout em onNavigate | Travamento | try/catch + finally |

---

## 🧪 Testes Manuais

### Test 1: Clique sem permissão
```
1. Logar como user (não admin)
2. Clicar em card com permission="ADMIN_ONLY"
→ Card bloqueado 🔒 + toast "Você não tem permissão"
```

### Test 2: Erro de API no KPI
```
1. getFinanceAdvancedKPIs retorna erro
2. Clicar em card "A Receber"
→ Banner inline + botão "Retry"
→ Nunca aparece ErrorBoundary global
```

### Test 3: Clique múltiplo
```
1. Clicar em card "Obras"
2. Clicar 10x rapidamente
→ Primeira navegação funciona
→ Próximos cliques ignorados (guard clause)
→ Sem travamento
```

### Test 4: Timeout em onNavigate
```
1. onNavigate = setTimeout 5s (simular lentidão)
2. Clicar em card
3. Esperar carregar
→ Overlay de loading aparece
→ Após 5s, navega
→ Sem travamento de clique
```

---

## 📊 Comparação: Antes vs Depois

### Antes (FALHO)
```jsx
<button onClick={() => navigate('/Obras')}>
  {/* Sem validação */}
  {/* Sem error handling */}
  {/* Se 403/500, ErrorBoundary dispara */}
  {/* Cliques múltiplos causam race condition */}
  <StatCard ... />
</button>
```

### Depois (SEGURO)
```jsx
<SafeStatCard
  routePath="/Obras"
  requiredPermission="OBRAS_VIEW"
  isLoading={loading}
  data={data}
  error={error}
  onRetry={retry}
/>
```

✅ Validação de perm no onClick
✅ Skeleton + error inline
✅ Retry local
✅ Clique seguro (sem race condition)
✅ NUNCA ErrorBoundary global