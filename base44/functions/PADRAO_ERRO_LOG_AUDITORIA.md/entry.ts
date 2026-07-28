# PADRÃO: Erro + Log + Auditoria (PARTE 3/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## 1. PADRÃO DE ERRO (erroSeguradoResponse.js)

### Resposta de Erro:
```json
{
  "ok": false,
  "code": "OBRA_REQUIRED",
  "message": "Selecione uma obra antes de continuar",
  "timestamp": "2026-02-15T10:30:00Z",
  "details": "campo 'obraId' está vazio"
}
```

### Códigos Predefinidos:
- `OBRA_REQUIRED` (400) — Falta obra
- `OBRA_INVALIDA` (400) — Obra não existe
- `VALIDACAO` (400) — Dados inválidos
- `NAO_AUTORIZADO` (401) — Precisa login
- `SEM_PERMISSAO` (403) — Sem acesso
- `ALCADA_INSUFICIENTE` (402) — Acima do limite
- `RECURSO_NAO_ENCONTRADO` (404) — Não existe
- `ESTADO_INVALIDO` (409) — Operação proibida
- `ERRO_INTERNO` (500) — Erro não tratado

### Uso:
```javascript
const { body, status } = erroSeguro('OBRA_REQUIRED', 'Informe a obra');
return Response.json(body, { status });

// Com detalhes customizados:
const { body, status } = erroSeguro(
  'VALIDACAO',
  'Campo inválido',
  400,
  'email não é um endereço válido'
);
```

---

## 2. CORRELATION ID (correlationId.js)

### O que é?
ID único por request que rastreia fluxo end-to-end.

### Geração Automática:
```javascript
const correlationId = obterCorrelationId(req);
// x-correlation-id (header) OU gerado: req_1739584300000_a1b2c3d4
```

### Logs Estruturados:
```javascript
logar(correlationId, 'info', 'OC criada', { ocId: 'oc_123' });
logar(correlationId, 'error', 'Falha ao salvar', { erro: 'timeout' });

// Output:
// [2026-02-15T10:30:00Z] [req_1739584300000_a1b2c3d4] [INFO] OC criada
```

### Erro com Stack Limitado:
```javascript
logarErro(correlationId, 'OBRA_INVALIDA', 'Obra não encontrada', error.stack);
// Stack truncado em 500 chars para não poluir logs
```

---

## 3. AUDITORIA (auditoriaEvento.js)

### Registro Básico:
```javascript
await registrarAuditoria(base44, {
  entidade: 'OrdemCompra',
  entidadeId: oc.id,
  operacao: 'criar',  // criar, atualizar, excluir, aprovar, rejeitar
  obraId: oc.obra_id,
  usuarioId: user.email,
  funcao: 'criarOrdemCompra',
  beforeData: null,
  afterData: oc,
  ipOrigem: req.headers.get('x-forwarded-for')
});
```

### Campo detecta automaticamente:
- `campos_alterados`: lista de fields que mudaram (para updates)
- `dados_antes`: JSON da entidade antes
- `dados_depois`: JSON da entidade depois

### Tabela LogAuditoriaSistema:
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | Auto |
| entidade | string | 'OrdemCompra', 'Medicao', etc |
| entidade_id | string | ID do registro alterado |
| operacao | enum | criar, atualizar, excluir, aprovar, rejeitar |
| dados_antes | JSON | Estado anterior |
| dados_depois | JSON | Estado novo |
| usuario_id | string | Email do usuário |
| obra_id | string | Obra relacionada |
| data_hora | timestamp | Quando ocorreu |
| origem_funcao | string | 'criarOrdemCompra' |
| ip_origem | string | IP do cliente |
| campos_alterados | array | ['status', 'valor_total'] |

---

## 4. MIDDLEWARE GLOBAL (middlewareErroGlobal.js)

### Captura tudo não tratado:
```javascript
export default comErroGlobal(async (req, correlationId) => {
  // Seu código aqui
  // Se lançar erro, será capturado e retornará
  // {
  //   ok: false,
  //   code: "ERRO_INTERNO",
  //   message: "Algo deu errado...",
  //   correlationId: "req_..."
  // }
});
```

---

## 5. FLUXO COMPLETO (EXEMPLO)

### 1️⃣ Request chega:
```
POST /criarOrdemCompra
x-correlation-id: req_1739584300000_a1b2c3d4
body: { obra_id: 'obra_1', fornecedor_id: 'forn_1' }
```

### 2️⃣ Handler executa:
```javascript
const correlationId = obterCorrelationId(req); // "req_..."
logar(correlationId, 'info', 'Iniciando...');

// Validações
if (!payload.obra_id) {
  logarErro(correlationId, 'OBRA_REQUIRED', '...');
  const { body, status } = erroSeguro('OBRA_REQUIRED');
  return Response.json(body, { status: 400 });
}

// Operação
const oc = await base44.entities.OrdemCompra.create(novaOC);

// Auditoria
await registrarAuditoria(base44, {
  entidade: 'OrdemCompra',
  entidadeId: oc.id,
  operacao: 'criar',
  // ...
});
```

### 3️⃣ Response retorna:
```json
{
  "ok": true,
  "message": "Ordem de Compra criada com sucesso",
  "data": { "id": "oc_123", "numero": "OC-1739584300000" },
  "timestamp": "2026-02-15T10:30:00Z"
}
```

### 4️⃣ Logs e Auditoria:
```
[2026-02-15T10:30:00Z] [req_...] [INFO] Iniciando...
[2026-02-15T10:30:00Z] [req_...] [INFO] Validação de entrada OK
[2026-02-15T10:30:00Z] [req_...] [INFO] OC criada: oc_123
[2026-02-15T10:30:00Z] [req_...] [INFO] Auditoria registrada

LogAuditoriaSistema.create({
  entidade: "OrdemCompra",
  entidade_id: "oc_123",
  operacao: "criar",
  dados_antes: null,
  dados_depois: "{...}",
  usuario_id: "user@example.com",
  obra_id: "obra_1",
  data_hora: "2026-02-15T10:30:00Z",
  origem_funcao: "criarOrdemCompra",
  campos_alterados: []
})
```

---

## 6. CHECKLIST IMPLEMENTAÇÃO

- [x] `erroSeguradoResponse.js` — Padrão de erro
- [x] `correlationId.js` — Rastreamento e logs
- [x] `auditoriaEvento.js` — Registro de before/after
- [x] `middlewareErroGlobal.js` — Captura global de erros
- [x] Exemplo: `exemploCriarOrdemCompraComAuditoria.js`
- [ ] Atualizar funções críticas (PARTE 4)
- [ ] Testes de erro + auditoria (PARTE 5)

---

## 7. PRÓXIMAS AÇÕES (PARTE 4)

- [ ] Atualizar `criarOrdemCompra`, `criarMedicao`, `aprovarOrdemCompra`, etc
- [ ] Adicionar auditoria em `update` e `delete` lógicos
- [ ] Criar dashboard de auditoria
- [ ] Testes de erro e recovery

---

**Nenhum "500 genérico" sem log e correlationId!** ✅