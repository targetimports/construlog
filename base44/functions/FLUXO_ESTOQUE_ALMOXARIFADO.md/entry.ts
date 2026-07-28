# FLUXO ESTOQUE/ALMOXARIFADO: RECEBIMENTO → TRANSFERÊNCIA → BAIXA (PARTE 5/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
ORDEM DE COMPRA
    ↓
RECEBIMENTO (ENTRADA) → Depósito Central
    ↓
TRANSFERÊNCIA (TRANSF_SAIDA + TRANSF_ENTRADA) → Estoque Obra
    ↓
CONSUMO (BAIXA_OBRA) → Reduz Saldo + Registra Custo
```

Cada operação cria MovimentacaoEstoque rastreável por obra e atualiza saldos.

---

## 1. TIPOS DE MOVIMENTO PADRONIZADOS

| Tipo | Origem | Destino | Quando | Saldo |
|------|--------|---------|--------|-------|
| `entrada` | NF/OC | Depósito | Recebimento | +qtd |
| `transf_saida` | Depósito | Obra | Transferência saída | -qtd |
| `transf_entrada` | Depósito | Obra | Transferência entrada | +qtd |
| `baixa_obra` | Obra | - | Consumo | -qtd |
| `ajuste` | Manual | Manual | Correção | ±qtd |

---

## 2. OPERAÇÃO 1: RECEBER MATERIAL

### criarRecebimentoComMovimento
```javascript
POST /criarRecebimentoComMovimento
{
  "ordem_compra_id": "oc_xyz",
  "almoxarifado_id": "deposito_central",
  "obra_id": "obra_123",
  "itens_recebidos": [
    { "insumo_id": "ins_1", "quantidade_recebida": 100, "valor_unitario": 5 }
  ]
}
```

### Validações
- ✓ OC existe e status = 'criada' ou 'aprovada'
- ✓ Almoxarifado existe
- ✓ Itens com quantidade > 0

### Operações
1. Cria `RecebimentoMaterial` (vinculado a OC)
2. Para cada item:
   - Cria `MovimentacaoEstoque(ENTRADA)`
   - Atualiza estoque do depósito
3. Atualiza OC: `status_entrega = "recebido_total"`
4. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "recebimento": { "id": "rec_123", "ordem_compra_id": "oc_xyz" },
    "movimentos": [
      { "id": "mov_1", "tipo": "entrada", "quantidade": 100 }
    ],
    "oc_atualizada": { "status": "recebida" }
  }
}
```

---

## 3. OPERAÇÃO 2: TRANSFERIR PARA OBRA

### transferirEstoqueParaObra
```javascript
POST /transferirEstoqueParaObra
{
  "deposito_origem_id": "deposito_central",
  "obra_id": "obra_123",
  "deposito_obra_id": "deposito_obra_123",
  "itens": [
    { "insumo_id": "ins_1", "quantidade": 50, "valor_unitario": 5 }
  ]
}
```

### Validações
- ✓ Depósito origem existe
- ✓ Obra existe
- ✓ Quantidade ≤ saldo disponível
- ✓ Itens com quantidade > 0

### Operações
1. Para cada item:
   - Cria `MovimentacaoEstoque(TRANSF_SAIDA)` no depósito central
   - Cria `MovimentacaoEstoque(TRANSF_ENTRADA)` na obra
   - Referencia cruzada entre movimentos
2. Atualiza saldo de `EstoqueObra` (+quantidade)
3. Registra auditoria com detalhes de transferência

### Response
```json
{
  "ok": true,
  "data": {
    "movimentos_saida": [{ "id": "mov_2", "tipo": "transf_saida" }],
    "movimentos_entrada": [{ "id": "mov_3", "tipo": "transf_entrada" }],
    "itens_transferidos": 1
  }
}
```

---

## 4. OPERAÇÃO 3: BAIXAR CONSUMO

### baixarConsumoObra
```javascript
POST /baixarConsumoObra
{
  "obra_id": "obra_123",
  "centro_custo_id": "cc_fundacoes",
  "itens": [
    { "insumo_id": "ins_1", "quantidade": 30, "valor_unitario": 5 }
  ],
  "referencia_tipo": "medicao",
  "referencia_id": "med_456"
}
```

### Validações
- ✓ Obra existe
- ✓ Centro de custo informado (obrigatório)
- ✓ Quantidade ≤ saldo disponível na obra
- ✓ Itens com quantidade > 0

### Operações
1. Cria `MovimentacaoEstoque(BAIXA_OBRA)`
2. Reduz saldo de `EstoqueObra` (-quantidade)
3. Registra referência cruzada (medição, medicao_id, etc)
4. Calcula valor total (qtd × valor unitário) para custo

### Response
```json
{
  "ok": true,
  "data": {
    "movimentos": [{ "id": "mov_4", "tipo": "baixa_obra" }],
    "itens_baixados": 1,
    "valor_total": 150
  }
}
```

---

## 5. ENTIDADES ATUALIZADAS

### MovimentacaoEstoque
```json
{
  "tipo": "entrada|transf_saida|transf_entrada|baixa_obra|ajuste",
  "obra_id": "OBRIGATÓRIO",
  "centro_custo_id": "Obrigatório para baixa_obra",
  "deposito_origem_id": "Para saídas/transferências",
  "deposito_destino_id": "Para entradas/transferências",
  "referencia_tipo": "ordem_compra|recebimento|medicao|transferencia|manual",
  "referencia_id": "ID da referência"
}
```

### EstoqueObra
```json
{
  "obra_id": "OBRIGATÓRIO",
  "insumo_id": "OBRIGATÓRIO",
  "quantidade_total": "Saldo total",
  "quantidade_disponivel": "total - reservada",
  "custo_unitario": "Custo médio ponderado",
  "valor_total_estoque": "qtd × custo",
  "data_ultima_movimentacao": "timestamp"
}
```

---

## 6. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Receber OC
```
POST /criarRecebimentoComMovimento
{
  "ordem_compra_id": "oc_789",
  "almoxarifado_id": "central",
  "itens_recebidos": [{ "insumo_id": "cimento", "quantidade_recebida": 100 }]
}

Response:
- RecebimentoMaterial criado
- MovimentacaoEstoque(ENTRADA) criado: 100 un
- EstoqueObra.quantidade_total = 100
```

### Step 2️⃣ - Transferir para Obra
```
POST /transferirEstoqueParaObra
{
  "deposito_origem_id": "central",
  "obra_id": "obra_123",
  "itens": [{ "insumo_id": "cimento", "quantidade": 80 }]
}

Response:
- MovimentacaoEstoque(TRANSF_SAIDA): central -80
- MovimentacaoEstoque(TRANSF_ENTRADA): obra_123 +80
- EstoqueObra(obra_123).quantidade_total = 80
```

### Step 3️⃣ - Consumir na Obra
```
POST /baixarConsumoObra
{
  "obra_id": "obra_123",
  "centro_custo_id": "fundacoes",
  "itens": [{ "insumo_id": "cimento", "quantidade": 50 }],
  "referencia_tipo": "medicao",
  "referencia_id": "med_456"
}

Response:
- MovimentacaoEstoque(BAIXA_OBRA): obra_123 -50
- EstoqueObra(obra_123).quantidade_total = 30
- Custo registrado em Medição/Custo
```

### Saldos Finais
| Estoque | Qtd | Valor |
|---------|-----|-------|
| Central | 20 | 100 |
| Obra 123 | 30 | 150 |
| **Total Consumo** | **50** | **250** |

---

## 7. CÁLCULO CUSTO MÉDIO

Ao receber com ENTRADA:
```
Novo Custo Médio = (Saldo Anterior × Custo Anterior + Entrada Valor) / (Saldo Anterior + Entrada Qtd)

Exemplo:
- Saldo: 100 un @ R$5 = R$500
- Entrada: 50 un @ R$6 = R$300
- Novo: (100×5 + 50×6) / (100+50) = (500+300)/150 = R$5.33

Valor Total Estoque = 150 × R$5.33 = R$799.50
```

---

## 8. VALIDAÇÕES DE REGRA DE NEGÓCIO

### ❌ Não Permitido
- Receber OC com status 'cancelada'
- Transferir quantidade > saldo disponível
- Baixar sem centro de custo (obrigatório)
- Transferir para obra que não existe
- Criar movimento com quantidade ≤ 0

### ✅ Permitido
- Múltiplas transferências parciais
- Ajustes manuais (com auditoria)
- Cancelar movimento (soft delete, não apaga)

---

## 9. ÍNDICES RECOMENDADOS

```sql
CREATE INDEX idx_movimento_obra_tipo_data 
  ON movimentacao_estoque(obra_id, tipo, data DESC);

CREATE INDEX idx_movimento_insumo_obra 
  ON movimentacao_estoque(insumo_id, obra_id);

CREATE INDEX idx_estoque_obra_insumo 
  ON estoque_obra(obra_id, insumo_id);

CREATE INDEX idx_recebimento_oc 
  ON recebimento_material(ordem_compra_id);
```

---

## 10. CHECKLIST

- [x] Tipos de movimento padronizados (5 tipos)
- [x] Validador de estoque (recebimento/transf/baixa)
- [x] criarRecebimentoComMovimento (OC → Depósito)
- [x] transferirEstoqueParaObra (Depósito → Obra)
- [x] baixarConsumoObra (Obra → Reduz Saldo)
- [x] Atualização automática de saldos
- [x] Custo médio ponderado
- [x] Auditoria de movimentos
- [ ] Testes de fluxo (PARTE 6)
- [ ] Dashboard de estoque (PARTE 7)

---

**Material recebido → transferido → consumido, sempre rastreado por obra!** ✅