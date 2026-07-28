# Smoke Tests - Guia de Execução

## O que é?

Smoke tests validam as funções críticas do sistema com dados de teste. Executam automaticamente e retornam se passaram ou falharam.

## Funções Testadas

1. Criar Requisição de Compra
2. Criar Ordem de Compra
3. Aprovar Ordem de Compra
4. Receber Material
5. Transferir Estoque
6. Criar Conta a Pagar
7. Conciliar Pagamento
8. Criar Medição
9. Aprovar Medição
10. Gerar KPIs Financeiros

---

## Como Rodar

### Opção 1: Via Dashboard (Recomendado)

1. Abrir dashboard do app
2. Ir para **"Ops Console"** ou **"Diagnostico"**
3. Executar função: `runSmokeTests`
4. Ver resultados em tempo real

### Opção 2: Via cURL

```bash
curl -X POST http://localhost:8000/api/functions/runSmokeTests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{}'
```

### Opção 3: Via Frontend (Componente React)

```typescript
import { base44 } from '@/api/base44Client';

async function executarSmokeTests() {
  const response = await base44.functions.invoke('runSmokeTests', {});
  
  console.log(response.data);
  // {
  //   ok: true,
  //   data: {
  //     summary: { passed: 10, failed: 0, total: 10 },
  //     results: [...]
  //   }
  // }
}
```

---

## Resposta Esperada

### Sucesso (Todos os testes passaram)

```json
{
  "ok": true,
  "data": {
    "summary": {
      "passed": 10,
      "failed": 0,
      "total": 10
    },
    "results": [
      {
        "name": "Criar Requisição de Compra",
        "status": "PASS",
        "duration": 145
      },
      {
        "name": "Criar Ordem de Compra",
        "status": "PASS",
        "duration": 123
      },
      // ... mais testes
    ]
  }
}
```

### Falha (Um ou mais testes falharam)

```json
{
  "ok": true,
  "data": {
    "summary": {
      "passed": 8,
      "failed": 2,
      "total": 10
    },
    "results": [
      {
        "name": "Criar Ordem de Compra",
        "status": "FAIL",
        "error": "Nenhum fornecedor encontrado para teste",
        "duration": 234
      }
    ]
  }
}
```

---

## O que Fazer se Falhar

### Cenário 1: "Nenhuma obra encontrada"
- Sistema não tem nenhuma obra criada
- Solução: Criar uma obra antes de rodar testes

### Cenário 2: "Nenhum fornecedor encontrado"
- Sistema não tem fornecedores
- Solução: Cadastrar pelo menos um fornecedor

### Cenário 3: "Nenhuma OC aprovada para receber"
- A OC criada não foi aprovada (esperado em primeiro ciclo)
- Solução: Rodar teste novamente ou revisar fluxo de aprovação

### Cenário 4: "Requisição não criada corretamente"
- Erro interno na criação de requisição
- Solução: Verificar logs da function `criarOrdemCompra`

---

## Agendamento Automático

Para rodar smoke tests **diariamente** (recomendado):

### Via Dashboard:
1. Ir para **Automações**
2. **Criar Nova Automação**
3. Configurar:
   - **Tipo**: Agendada
   - **Função**: `runSmokeTests`
   - **Recorrência**: Diária (ex: 6am)
4. Salvar

### Via API (Deno):
```typescript
import { create_automation } from '@base44/sdk';

await create_automation({
  automation_type: 'scheduled',
  name: 'Smoke Tests Diários',
  function_name: 'runSmokeTests',
  schedule_type: 'simple',
  repeat_interval: 1,
  repeat_unit: 'days',
  start_time: '06:00'
});
```

---

## Logs e Debug

Ver logs detalhados da execução:

```typescript
// No browser console:
const result = await base44.functions.invoke('runSmokeTests', {});
console.log('Testes rodados:', result.data.data.results);

// Filtrar apenas os que falharam:
const falhas = result.data.data.results.filter(r => r.status === 'FAIL');
console.error('Falhas:', falhas);
```

---

## Performance

Tempo estimado por teste:
- Criar entidade: 100-200ms
- Atualizar entidade: 80-150ms
- Invocar função: 150-300ms

**Tempo total esperado**: ~1.5-2 segundos para 10 testes

---

## Segurança

**Apenas admins podem rodar smoke tests**

Se receber erro `FORBIDDEN`:
- Usuário não é admin
- Token inválido ou expirado
- Solicitar acesso ao administrador

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `UNAUTHORIZED` | Não autenticado | Fazer login |
| `FORBIDDEN` | Não é admin | Solicitar permissão |
| `INTERNAL_ERROR` | Erro no backend | Verificar logs de server |
| `NETWORK_ERROR` | Conexão falhou | Verificar internet |