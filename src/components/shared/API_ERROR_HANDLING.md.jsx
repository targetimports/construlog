# 🚀 Guia de Tratamento de Erros de API

**Objetivo:** Evitar que erros de API derubem a aplicação (tela fullscreen "Erro no Sistema").

---

## ⚠️ PROBLEMAS A EVITAR

❌ **NUNCA:**
```javascript
// Isso lança exception e deruba a app
const data = await base44.functions.invoke('myFunc', {});
setData(data); // Se erro, cai no ErrorBoundary

// Isso também é perigoso
try {
  const res = await fetch(...);
  if (!res.ok) throw new Error('API error'); // ❌ Lança exception
} catch (err) {
  // Se não capturar bem, cai no ErrorBoundary
}
```

---

## ✅ PADRÃO CORRETO

### 1) **Usar `safeInvoke` do apiClient**

```javascript
import { safeInvoke } from '@/components/shared/apiClient';
import { useApiError } from '@/components/shared/useApiError';

export default function MyPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { error, showErrorToast, clearError } = useApiError();

  const fetchData = async () => {
    setIsLoading(true);
    clearError();

    // SEGURO: nunca lança exception
    const result = await safeInvoke(base44, 'myFunction', { param: 'value' });

    if (!result.ok) {
      // Mostrar toast + banner, NÃO deruba app
      showErrorToast(result, fetchData); // fetchData = retry
      setIsLoading(false);
      return;
    }

    setData(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
      {/* Mostrar banner de erro se houver */}
      {error && (
        <ErrorBanner 
          error={error}
          onRetry={fetchData}
          onDismiss={clearError}
        />
      )}

      {/* Conteúdo */}
      {isLoading && <SkeletonLoader />}
      {!isLoading && data && <DataView data={data} />}
    </div>
  );
}
```

### 2) **Usar `PageContainer` para estados**

```javascript
import { PageContainer } from '@/components/shared/PageContainer';

export default function ObrasList() {
  const [obras, setObras] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { error, showErrorToast, clearError } = useApiError();

  const loadObras = async () => {
    setIsLoading(true);
    const result = await safeEntity(base44.entities.Obra, 'list');

    if (!result.ok) {
      showErrorToast(result, loadObras);
      setIsLoading(false);
      return;
    }

    setObras(result.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadObras();
  }, []);

  return (
    <PageContainer
      isLoading={isLoading}
      error={error}
      isEmpty={obras?.length === 0}
      onRetry={loadObras}
      emptyMessage="Nenhuma obra encontrada"
    >
      <div className="grid gap-4">
        {obras?.map(obra => (
          <ObraCard key={obra.id} obra={obra} />
        ))}
      </div>
    </PageContainer>
  );
}
```

### 3) **Padrão para formulários**

```javascript
export default function ObraForm({ obraId }) {
  const [isSaving, setIsSaving] = useState(false);
  const { showErrorToast } = useApiError();
  const [form, setForm] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    // SEGURO: safeEntity retorna { ok, data?, message? }
    const result = await safeEntity(
      base44.entities.Obra,
      'update',
      obraId,
      form
    );

    if (!result.ok) {
      showErrorToast(result); // Toast apenas
      setIsSaving(false);
      return;
    }

    // Sucesso
    toast.success('Obra salva com sucesso!');
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* fields... */}
      <button disabled={isSaving}>
        {isSaving ? 'Salvando...' : 'Salvar'}
      </button>
    </form>
  );
}
```

---

## 📋 API Seguro - Retorno

```javascript
// SEMPRE retorna objeto, NUNCA lança exception durante fetch
const result = await safeInvoke(base44, 'fn', {});

// Sucesso
result = {
  ok: true,
  status: 200,
  data: { ... }
}

// Erro de API (403, 500, etc)
result = {
  ok: false,
  status: 403,
  message: 'Acesso negado',
  details: { ... },
  data: null
}

// Network error / timeout
result = {
  ok: false,
  status: 0,
  message: 'Erro de conexão',
  details: 'timeout',
  data: null
}
```

---

## 🎯 ErrorBoundary - APENAS para crashes

**Quando aparece:**
- Erro de renderização (null.map(), etc)
- Erro em lifecycle (constructor, useEffect throw)
- Component crash JS

**NÃO aparece para:**
- Erro de API (403/500)
- Validação de formulário
- Dados vazios
- Timeout

---

## 📝 Checklist por página

- [ ] Usar `safeInvoke` / `safeEntity` (nunca throw)
- [ ] Tratar `!result.ok` e chamar `showErrorToast`
- [ ] Ter retry function em showErrorToast
- [ ] Usar `PageContainer` para estados
- [ ] Mostrar banner de erro, não fullscreen
- [ ] Sidebar/menu nunca desaparecem
- [ ] Loading skeleton local (não fullscreen)

---

## 🧪 Teste rápido

**Como não quebrar a app:**
```javascript
// ✅ Certo
const res = await safeInvoke(...);
if (!res.ok) {
  showErrorToast(res); // Toast + banner
  return;
}

// ❌ Errado - deruba a app
const res = await safeInvoke(...);
if (!res.ok) throw res; // ❌ NO! Cai no ErrorBoundary
``