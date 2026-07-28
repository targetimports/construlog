# FLUXO DE COMPRAS: ENCADEAMENTO OBRIGATÓRIO (PARTE 4/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
REQUISIÇÃO → COTAÇÃO → ORDEM DE COMPRA
   (1)        (N)         (1 selecionada)
```

Cada OC deve referenciar a cotação e requisição que a originou. Nenhum registro "solto".

---

## 1. STATUS EM CASCATA

### RequisicaoCompra
```
aberta → em_cotacao → cotacao_finalizada → comprada → recebida
  ↓                                           ↓
  └─ cancelada                             cancelada
```

### CotacaoFornecedor
```
aberta → selecionada → (vinculada a OC)
  ↓         ↓
  └─ vencida
  └─ rejeitada
  └─ cancelada
```

### OrdemCompra
```
criada → aprovada → paga → recebida → finalizada
  ↓                                      ↓
  └──────────────────────────────────┘ cancelada
```

---

## 2. ENTIDADES ATUALIZADAS

### RequisicaoCompra
```json
{
  "status": "aberta|em_cotacao|cotacao_finalizada|comprada|recebida|cancelada",
  "itens": [
    {
      "cotacao_id": "cotacao_id",
      "ordem_compra_id": "oc_id",
      "status": "em_aberto|em_cotacao|em_compra|recebido|recusado"
    }
  ]
}
```

### CotacaoFornecedor
```json
{
  "requisicao_id": "req_id",  // OBRIGATÓRIO
  "obra_id": "obra_id",        // OBRIGATÓRIO (indexação)
  "ordem_compra_id": "oc_id",  // Preenchido quando selecionada
  "selecionada_para_oc": true,
  "status": "aberta|selecionada|vencida|rejeitada|cancelada"
}
```

### OrdemCompra
```json
{
  "requisicao_id": "req_id",   // OBRIGATÓRIO - rastreabilidade para obra
  "cotacao_id": "cotacao_id",  // OBRIGATÓRIO - encadeamento
  "obra_id": "obra_id",
  "status": "criada|aprovada|paga|recebida|cancelada"
}
```

---

## 3. VALIDAÇÃO DE ENCADEAMENTO

### Criar Cotação
```javascript
await validarFluxoCotacao(base44, requisicaoId, obraId);
// ✓ Requisição existe
// ✓ Status permite cotação (aberta ou em_cotacao)
// ✓ Obra corresponde
```

### Criar OC
```javascript
const { requisicao, cotacao } = await validarFluxoOrdenCompra(
  base44, 
  requisicaoId, 
  cotacaoId, 
  obraId
);
// ✓ Requisição existe e status permite
// ✓ Cotação existe e pertence a esta requisição
// ✓ Cotação status permite (aberta ou selecionada)
// ✓ Cotação não foi já usada em outra OC
```

### Validar Integridade
```javascript
const integridade = await validarIntegridadeFluxo(base44, ocId);
// Verifica elos: OC → Cotação → Requisição
// Detecta orpandos ou referências quebradas
```

---

## 4. OPERAÇÕES EM CASCATA

Quando OC é criada:

1. **Cotação** atualiza:
   - status → 'selecionada'
   - ordem_compra_id → OC.id
   - selecionada_para_oc → true

2. **Requisição** atualiza:
   - status → 'comprada'
   - itens[i].ordem_compra_id → OC.id
   - itens[i].status → 'em_compra'

3. **Auditoria** registra:
   - operacao: 'criar'
   - entidade: 'OrdemCompra'
   - detalhes: { encadeamento: { requisicao_id, cotacao_id, validado: true } }

---

## 5. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Criar Requisição
```javascript
POST /criarRequisicaoCompra
{
  "obra_id": "obra_123",
  "titulo": "Compra de cimento",
  "itens": [
    { "insumo_id": "insumo_1", "quantidade_solicitada": 100, "valor_estimado": 500 }
  ]
}
// Response: { id: "req_abc", status: "aberta" }
```

### Step 2️⃣ - Criar Múltiplas Cotações
```javascript
POST /criarCotacao
{
  "requisicao_id": "req_abc",
  "obra_id": "obra_123",
  "fornecedor_id": "forn_1",
  "valor_total": 480,
  "prazo_entrega_dias": 5
}
// Response: { id: "cotacao_1", status: "aberta", requisicao_id: "req_abc" }

POST /criarCotacao
{
  "requisicao_id": "req_abc",
  "obra_id": "obra_123",
  "fornecedor_id": "forn_2",
  "valor_total": 520,
  "prazo_entrega_dias": 3
}
// Response: { id: "cotacao_2", status: "aberta", requisicao_id: "req_abc" }
```

### Step 3️⃣ - Selecionar Cotação → Criar OC
```javascript
POST /criarOrdemCompraComEncadeamento
{
  "requisicao_id": "req_abc",
  "cotacao_id": "cotacao_2",  // Melhor prazo
  "obra_id": "obra_123",
  "fornecedor_id": "forn_2"
}
// Valida que cotacao_2 pertence a req_abc ✓
// Cria OC com requisicao_id e cotacao_id ✓
// Atualiza status em cascata ✓
// Response: {
//   oc: { id: "oc_xyz", requisicao_id: "req_abc", cotacao_id: "cotacao_2", status: "criada" },
//   encadeamento: true
// }
```

### Resultado Final
```
Requisição (req_abc):
  - status: "comprada"
  - itens[0].ordem_compra_id: "oc_xyz"

Cotação 1 (cotacao_1):
  - status: "aberta" (não selecionada)

Cotação 2 (cotacao_2):
  - status: "selecionada"
  - ordem_compra_id: "oc_xyz"

OC (oc_xyz):
  - requisicao_id: "req_abc"
  - cotacao_id: "cotacao_2"
  - status: "criada"
```

---

## 6. REGRAS DE NEGÓCIO

### Não Permitido
- ❌ Criar OC sem requisição → erro `REQUISICAO_NAO_ENCONTRADA`
- ❌ Criar OC sem cotação → erro `COTACAO_NAO_ENCONTRADA`
- ❌ Criar OC com cotação de outra requisição → erro `CONFLITO_DADOS`
- ❌ Usar cotação já vinculada a outra OC → erro `JA_UTILIZADA`
- ❌ Criar cotação em requisição cancelada → erro `ESTADO_INVALIDO`

### Permitido
- ✅ Múltiplas cotações para uma requisição
- ✅ Cancelar requisição se status = 'aberta'
- ✅ Rejeitar cotação (não altera requisição)
- ✅ Cancelar OC (marca como cancelada, não apaga)

---

## 7. ÍNDICES RECOMENDADOS

```sql
CREATE INDEX idx_cotacao_requisicao_obra 
  ON cotacao_fornecedor(requisicao_id, obra_id, status);

CREATE INDEX idx_oc_requisicao_cotacao 
  ON ordem_compra(requisicao_id, cotacao_id, obra_id);

CREATE INDEX idx_oc_obra_status 
  ON ordem_compra(obra_id, status, created_at);
```

---

## 8. CHECKLIST

- [x] Entidades com referências cruzadas (requisicao_id, cotacao_id)
- [x] Status em cascata (3 tabelas)
- [x] Validador de encadeamento
- [x] Atualização automática em cascata
- [x] Validação de integridade
- [x] Auditoria com contexto de encadeamento
- [ ] Testes de fluxo (PARTE 5)
- [ ] Dashboard de rastreabilidade (PARTE 6)

---

**Nenhuma compra fica "solta" sem rastreabilidade de onde veio!** ✅