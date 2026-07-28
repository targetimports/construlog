# Correção de Erros Frontend/Backend

## Problemas Corrigidos

### 1. "Failed to fetch" - Erro de Conexão
- **Causa**: Timeout, CORS, ou conexão perdida
- **Solução**: `fetchJson()` e `useApiCall()` tratam timeouts e erros de rede

### 2. "fetchJson is not defined"
- **Causa**: Função não existia no frontend
- **Solução**: Criada `components/shared/fetchJson.ts` com suporte completo

### 3. "Unexpected token '<'" - HTML em vez de JSON
- **Causa**: Backend retornando erro 500 com HTML em vez de JSON
- **Solução**: 
  - `responseHandler.ts` garante SEMPRE JSON
  - `errorWrapper.ts` valida responses
  - `ensureJsonResponse.ts` middleware extra para functions

---

## Arquivos Criados

### Frontend
- `components/shared/fetchJson.ts` - Wrapper de fetch com tratamento de erro
- `components/hooks/useApiCall.ts` - Hook React para chamar functions

### Backend - Response Handler
- `functions/_shared/responseHandler.ts` - Padroniza respostas (ok, code, message, data)
- `functions/_shared/errorWrapper.ts` - Garante JSON em todas responses
- `functions/_lib/ensureJsonResponse.ts` - Middleware de validação JSON

### Backend - Security Handler
- `functions/_shared/secureHandler.ts` - Melhorado com:
  - Tratamento de JSON parseError
  - Logging detalhado de erros
  - Validação de Content-Type

---

## Arquivos Modificados

### Functions Críticas (Padronizadas)
- `functions/criarOrdemCompra.ts` - Usa `responseHandler`
- `functions/gerarOCDaCotacao.ts` - Usa `responseHandler`
- `functions/processarMovimentacaoEstoque.ts` - Usa `responseHandler`
- `functions/getFinanceKPIs.ts` - Usa `responseHandler`
- `functions/conciliarDadosInsumos.ts` - Usa `responseHandler`
- `functions/pagarConta.ts` - Usa `responseHandler`
- `functions/listarOpsOutbox.ts` - Usa `responseHandler`

---

## Formato de Resposta Padronizado

### Sucesso
```json
{
  "ok": true,
  "data": { /* resultado */ }
}
```

### Erro Esperado
```json
{
  "ok": false,
  "code": "INVALID_VALUE",
  "message": "Descrição do erro"
}
```

### Erro Interno
```json
{
  "ok": false,
  "code": "INTERNAL_ERROR",
  "message": "Erro interno do servidor"
}
```

---

## Como Usar no Frontend

### Opção 1: Com fetchJson (direto)
```typescript
const result = await fetchJson('/api/funcao', {
  method: 'POST',
  body: JSON.stringify({ param: 'valor' })
});

if (!result.ok) {
  console.error(result.code, result.message);
}
```

### Opção 2: Com useApiCall (React)
```typescript
function MeuComponente() {
  const { call, loading, error, data } = useApiCall('criarOrdemCompra', {
    showToast: true
  });
  
  const handleSubmit = async () => {
    const resultado = await call({ obra_id, valor });
    // resultado já é tipado e tratado
  };
}
```

### Opção 3: Com base44.functions.invoke (legacy)
```typescript
const response = await base44.functions.invoke('criarOrdenCompra', {
  obra_id: '123'
});
const { ok, data, code, message } = response.data;
```

---

## Checklist de Verificação

- Nenhuma function retorna HTML (todas retornam JSON)
- Todos erros têm `code` e `message`
- Frontend tem `fetchJson()` para tratar erros
- Frontend tem `useApiCall()` hook para React
- `secureHandler` trata JSON parseError
- Response handler centralizado em `_shared/