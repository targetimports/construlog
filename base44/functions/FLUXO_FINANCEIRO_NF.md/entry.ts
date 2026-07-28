# FLUXO FINANCEIRO: NF → CONTA A PAGAR → PAGAMENTO → CONCILIAÇÃO (PARTE 6/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
NOTA FISCAL
    ↓
CONTA A PAGAR (automática)
    ↓
PAGAMENTO (parcial/total)
    ↓
CONCILIAÇÃO (vinculação bancária)
```

Cada NF gera automaticamente uma conta a pagar, com validação de divergências com OC se vinculada.

---

## 1. OPERAÇÃO 1: CRIAR NF + CONTA A PAGAR

### criarNFComContaPagar
```javascript
POST /criarNFComContaPagar
{
  "numero_nf": "NF-2026-001",
  "data": "2026-02-15",
  "obra_id": "obra_123",
  "fornecedor_id": "forn_1",
  "fornecedor_nome": "Acme Materiais",
  "valor_bruto": 1000,
  "valor_liquido": 1000,
  "categoria": "material",
  "referencia_vinculo": "oc_789",
  "dias_vencimento": 30,
  "forma_pagamento": "transferencia"
}
```

### Validações
- ✓ Obra existe
- ✓ Fornecedor existe (ou aceita sem validação)
- ✓ Valor > 0
- ✓ NF não possui conta a pagar anterior

### Lógica de Divergência
Se `referencia_vinculo` (OC_id) informado:
- Compara valor_bruto NF vs valor_total OC
- Compara data NF vs data_emissao OC
- Gera **alerta** (não bloqueia)

### Operações
1. Cria `NotaFiscal` com status='registrada'
2. Calcula data de vencimento (data_nf + dias_vencimento)
3. Cria `ContaFinanceira` tipo='pagar' com status='pendente'
4. Vincula NF → ContaPagar (atualiza nf.conta_pagar_id)
5. Registra auditoria com divergências

### Response
```json
{
  "ok": true,
  "data": {
    "nf": {
      "id": "nf_1",
      "numero_nf": "NF-2026-001",
      "status": "registrada",
      "conta_pagar_id": "conta_1"
    },
    "conta_pagar": {
      "id": "conta_1",
      "descricao": "Conta referente à NF NF-2026-001",
      "valor": 1000,
      "status": "pendente",
      "data_vencimento": "2026-03-17"
    },
    "divergencias": null
  }
}
```

---

## 2. OPERAÇÃO 2: PAGAR CONTA

### pagarConta
```javascript
POST /pagarConta
{
  "conta_id": "conta_1",
  "valor_pagamento": 500,
  "forma_pagamento": "pix",
  "numero_comprovante": "PIX-ABC123",
  "observacao": "Pagamento parcial"
}
```

### Validações
- ✓ Conta existe
- ✓ Status = 'pendente', 'parcial', ou 'atrasado'
- ✓ valor_pagamento > 0
- ✓ valor_pagamento ≤ (valor_total - valor_pago)

### Operações
1. Calcula novo valor_pago = valor_pago_anterior + valor_pagamento
2. Determina novo status:
   - Se valor_pago < valor_total → 'parcial'
   - Se valor_pago == valor_total → 'pago'
3. Registra no `historico_baixas`:
   - data (agora)
   - valor
   - forma_pagamento
   - responsavel (user.email)
   - numero_comprovante
4. Atualiza `data_pagamento` da conta
5. Marca NF vinculada como 'paga' (se status=pago)
6. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "conta": {
      "id": "conta_1",
      "valor_pago": 500,
      "status": "parcial",
      "historico_baixas": [
        {
          "data": "2026-02-15T10:30:00Z",
          "valor": 500,
          "forma_pagamento": "pix",
          "numero_comprovante": "PIX-ABC123",
          "responsavel": "user@empresa.com"
        }
      ]
    },
    "pagamento": {
      "valor": 500,
      "forma": "pix"
    },
    "status_novo": "parcial",
    "saldo_restante": 500
  }
}
```

---

## 3. OPERAÇÃO 3: CONCILIAR PAGAMENTO

### conciliarPagamento
```javascript
POST /conciliarPagamento
{
  "conta_id": "conta_1",
  "transacao_bancaria_id": "txn_abc123",
  "valor_transacao": 1000,
  "observacao": "Conciliação com extrato bancário"
}
```

### Validações
- ✓ Conta existe
- ✓ Status = 'pago' ou 'parcial'
- ✓ (Opcional) valor_transacao ≈ valor_pago (alerta se divergir)

### Operações
1. Adiciona metadados `conciliacao`:
   - transacao_bancaria_id
   - data_conciliacao
   - usuario_conciliacao
   - valor_reconciliado
2. Marca status = 'pago' (finaliza)
3. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "conta": {
      "id": "conta_1",
      "status": "pago",
      "conciliacao": {
        "transacao_bancaria_id": "txn_abc123",
        "data_conciliacao": "2026-02-15T10:35:00Z",
        "status": "conciliada"
      }
    }
  }
}
```

---

## 4. ENTIDADES ATUALIZADAS

### NotaFiscal
```json
{
  "numero_nf": "NF-xxx",
  "obra_id": "OBRIGATÓRIO",
  "fornecedor_id": "OBRIGATÓRIO",
  "valor_bruto": "Valor total (com impostos)",
  "valor_liquido": "Valor sem impostos",
  "conta_pagar_id": "ID da conta vinculada",
  "data_vencimento": "Data de vencimento",
  "status": "rascunho|registrada|paga|cancelada",
  "referencia_vinculo": "oc_id se vinculada"
}
```

### ContaFinanceira (pagar)
```json
{
  "tipo": "pagar",
  "descricao": "Descrição",
  "valor": "Valor total",
  "valor_pago": "Valor já pago",
  "status": "pendente|parcial|pago|atrasado|cancelado",
  "obra_id": "OBRIGATÓRIO",
  "fornecedor_id": "ID do fornecedor",
  "data_vencimento": "Data de vencimento",
  "data_pagamento": "Data do último pagamento",
  "referencia_tipo": "nota_fiscal|medicao|etc",
  "referencia_id": "ID da NF/Medição",
  "historico_baixas": [
    {
      "data": "timestamp",
      "valor": "Valor pago",
      "forma_pagamento": "pix|transferencia|etc",
      "numero_comprovante": "PIX-ABC ou similar",
      "responsavel": "email do usuário"
    }
  ],
  "conciliacao": {
    "transacao_bancaria_id": "ID da transação",
    "data_conciliacao": "timestamp",
    "status": "conciliada"
  }
}
```

---

## 5. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Criar NF + Conta
```
POST /criarNFComContaPagar
{
  "numero_nf": "NF-2026-001",
  "obra_id": "obra_123",
  "fornecedor_id": "forn_1",
  "valor_bruto": 1000,
  "referencia_vinculo": "oc_789"
}

Validações:
- OC 789 tem valor_total = 1000 ✓ (sem divergência)

Response:
- NF criada: status='registrada'
- Conta criada: status='pendente', vencimento=30 dias
- Divergências: null
```

### Step 2️⃣ - Pagar Parcialmente
```
POST /pagarConta
{
  "conta_id": "conta_1",
  "valor_pagamento": 600,
  "forma_pagamento": "pix",
  "numero_comprovante": "PIX-ABC123"
}

Response:
- Conta status='parcial'
- Saldo restante: 400
- Histórico registrado
```

### Step 3️⃣ - Pagar Restante
```
POST /pagarConta
{
  "conta_id": "conta_1",
  "valor_pagamento": 400,
  "forma_pagamento": "ted",
  "numero_comprovante": "TED-DEF456"
}

Response:
- Conta status='pago' ✓
- NF status='paga' ✓
- Saldo: 0
```

### Step 4️⃣ - Conciliar
```
POST /conciliarPagamento
{
  "conta_id": "conta_1",
  "transacao_bancaria_id": "txn_xyz789",
  "valor_transacao": 1000
}

Response:
- Conta conciliada ✓
- Status final: 'pago'
```

---

## 6. VALIDAÇÕES DE REGRA

### ❌ Não Permitido
- Gerar conta a pagar de NF que já tem uma
- Pagar conta com status 'cancelado'
- Pagar valor > saldo devedor
- Criar NF sem obra
- Pagar sem forma_pagamento

### ✅ Permitido
- Múltiplos pagamentos parciais
- Pagar antes da data de vencimento
- Divergências com OC (gera alerta, não bloqueia)
- Cancelar conta (soft delete, não apaga)

---

## 7. CÁLCULO: JUROS E MULTA (Estrutura Pronta)

```javascript
function calcularJurosMulta(valorOriginal, diasAtraso) {
  const taxaMulta = 0.02;      // 2% multa fixa
  const taxaJuros = 0.001;     // 0.1% ao dia
  
  const multa = valorOriginal * taxaMulta;
  const juros = valorOriginal * taxaJuros * diasAtraso;
  
  return {
    multa,
    juros,
    total_acrescimo: multa + juros,
    valor_final: valorOriginal + multa + juros
  };
}

// Exemplo
calcularJurosMulta(1000, 10)
// {
//   multa: 20,
//   juros: 10,
//   total_acrescimo: 30,
//   valor_final: 1030
// }
```

---

## 8. DETECÇÃO DE DIVERGÊNCIA NF ↔ OC

| Cenário | Alerta | Bloqueia |
|---------|--------|----------|
| Valor diferente > R$1 | ⚠️ Sim | ❌ Não |
| Data NF > Data OC | ⚠️ Sim | ❌ Não |
| OC não encontrada | ℹ️ Info | ❌ Não |
| Categoria diferente | ℹ️ Info | ❌ Não |

---

## 9. ÍNDICES RECOMENDADOS

```sql
CREATE INDEX idx_nf_obra_status 
  ON nota_fiscal(obra_id, status);

CREATE INDEX idx_conta_obra_status 
  ON conta_financeira(obra_id, tipo, status);

CREATE INDEX idx_conta_vencimento 
  ON conta_financeira(data_vencimento, status);

CREATE INDEX idx_conta_referencia 
  ON conta_financeira(referencia_tipo, referencia_id);
```

---

## 10. CHECKLIST

- [x] NotaFiscal com obra_id obrigatório
- [x] ContaFinanceira tipo='pagar' com rastreamento
- [x] criarNFComContaPagar (automático)
- [x] pagarConta (parcial/total)
- [x] conciliarPagamento (vinculação bancária)
- [x] Validação de divergência NF↔OC
- [x] Histórico de pagamentos
- [x] Cálculo juros/multa (estrutura)
- [x] Auditoria em cada operação
- [ ] Testes de fluxo (PARTE 7)
- [ ] Dashboard de contas (PARTE 8)

---

**NF → Conta → Pagamento → Conciliação, sempre rastreado por obra!** ✅