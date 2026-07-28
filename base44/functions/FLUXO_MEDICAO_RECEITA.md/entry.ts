# FLUXO MEDIÇÃO & RECEITA: MEDIÇÃO → APROVAÇÃO → FATURAMENTO (PARTE 7/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
MEDIÇÃO (rascunho)
    ↓
ENVIAR (enviada)
    ↓
APROVAR (aprovada)
    ↓
FATURAR (faturada) → RECEITA + CONTA A RECEBER
```

Transformar produção em receita com rastreamento completo.

---

## 1. TIPOS E STATUS

### Medição
- **tipo**: `fisica` (interno) | `contratual` (cliente)
- **status**: `rascunho` → `enviada` → `aprovada` → `reprovada` | `faturada` | `cancelada`

### Receita
- **status**: `pendente` → `faturada` → `recebida` | `cancelada`

---

## 2. OPERAÇÃO 1: CRIAR MEDIÇÃO

### criarMedicaoObra
```javascript
POST /criarMedicaoObra
{
  "obra_id": "obra_123",
  "tipo": "contratual",
  "itens": [
    {
      "descricao": "Fundação",
      "unidade": "m3",
      "quantidade_periodo": 100,
      "valor_unitario": 250
    }
  ],
  "observacoes": "Medição do período",
  "enviar": true
}
```

### Validações
- ✓ Obra existe
- ✓ Itens com quantidade > 0
- ✓ Valor unitário informado

### Operações
1. Cria `Medicao` com status='rascunho'
2. Cria `ItemMedicao` para cada item
3. Calcula `valor_total_realizado` = Σ(qtd × valor)
4. Se `enviar=true`: muda status para 'enviada'
5. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "medicao": {
      "id": "med_1",
      "numero": "MED-1676989374",
      "status": "enviada",
      "valor_total_realizado": 25000
    },
    "itens": [
      { "id": "item_1", "quantidade_periodo": 100, "valor_periodo": 25000 }
    ]
  }
}
```

---

## 3. OPERAÇÃO 2: APROVAR MEDIÇÃO

### aprovarMedicaoObra
```javascript
POST /aprovarMedicaoObra
{
  "medicao_id": "med_1",
  "observacoes": "Aprovado conforme verificação de campo"
}
```

### Validações
- ✓ Medição existe
- ✓ Status = 'enviada'

### Operações
1. Atualiza status para 'aprovada'
2. Registra `aprovado_por` (email do usuário)
3. Registra `data_aprovacao`
4. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "medicao": {
      "id": "med_1",
      "status": "aprovada",
      "aprovado_por": "gestor@empresa.com",
      "data_aprovacao": "2026-02-15T10:30:00Z"
    }
  }
}
```

---

## 4. OPERAÇÃO 3: GERAR FATURAMENTO

### gerarFaturamentoMedicao
```javascript
POST /gerarFaturamentoMedicao
{
  "medicao_id": "med_1",
  "percentual_retencao": 10,
  "referencia_contrato": "CT-2026-001"
}
```

### Validações
- ✓ Medição existe
- ✓ Status = 'aprovada'
- ✓ Valor > 0
- ✓ Não possui receita anterior

### Operações
1. Calcula retenção:
   - `valor_retencoes = valor_bruto × (percentual / 100)`
   - `valor_liquido = valor_bruto - valor_retencoes`
2. Cria `ReceitaObra`:
   - tipo='medicao'
   - status='faturada'
   - medicao_id vinculado
3. Cria `ContaFinanceira` (receber):
   - tipo='receber'
   - valor=valor_liquido
   - status='pendente'
   - referencia_id=medicao_id
4. Vincula receita ↔ conta
5. Atualiza medição: status='faturada', receita_id
6. Registra auditoria

### Response
```json
{
  "ok": true,
  "data": {
    "medicao": {
      "id": "med_1",
      "status": "faturada",
      "receita_id": "receita_1"
    },
    "receita": {
      "id": "receita_1",
      "tipo": "medicao",
      "valor_bruto": 25000,
      "valor_retencoes": 2500,
      "valor_liquido": 22500,
      "status": "faturada"
    },
    "conta_receber": {
      "id": "conta_1",
      "valor": 22500,
      "status": "pendente",
      "data_vencimento": "2026-03-17"
    },
    "valores": {
      "bruto": 25000,
      "retencoes": 2500,
      "liquido": 22500
    }
  }
}
```

---

## 5. ENTIDADES ATUALIZADAS

### Medicao
```json
{
  "obra_id": "OBRIGATÓRIO",
  "numero": "MED-xxx",
  "data_medicao": "Data da medição",
  "tipo": "fisica|contratual",
  "status": "rascunho|enviada|aprovada|faturada",
  "valor_total_realizado": "Valor bruto da medição",
  "valor_liquido": "Valor após retenções",
  "retencoes_percentual": "% de retenção",
  "aprovado_por": "Email do aprovador",
  "data_aprovacao": "timestamp",
  "receita_id": "ID da receita gerada"
}
```

### ItemMedicao
```json
{
  "medicao_id": "OBRIGATÓRIO",
  "descricao": "Descrição do item",
  "unidade": "m3, m, un, etc",
  "quantidade_anterior": "Qtd de períodos anteriores",
  "quantidade_periodo": "Qtd deste período",
  "quantidade_acumulada": "anterior + período",
  "valor_unitario": "Preço com BDI",
  "valor_periodo": "qtd_período × valor_unitario",
  "valor_acumulado": "qtd_acumulada × valor_unitario",
  "percentual_executado": "% executado vs orçado"
}
```

### ReceitaObra
```json
{
  "obra_id": "OBRIGATÓRIO",
  "tipo": "medicao",
  "valor_bruto": "Valor total",
  "retencoes_percentual": "% de retenção",
  "valor_retencoes": "Valor descontado",
  "valor_liquido": "Valor a receber",
  "status": "pendente|faturada|recebida",
  "medicao_id": "ID da medição vinculada",
  "conta_receber_id": "ID da conta a receber"
}
```

---

## 6. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Criar e Enviar Medição
```
POST /criarMedicaoObra
{
  "obra_id": "obra_123",
  "tipo": "contratual",
  "itens": [
    { "descricao": "Fundação", "quantidade_periodo": 100, "valor_unitario": 250 }
  ],
  "enviar": true
}

Response:
- Medição criada e enviada
- valor_total_realizado = 25.000
```

### Step 2️⃣ - Aprovar Medição
```
POST /aprovarMedicaoObra
{
  "medicao_id": "med_1",
  "observacoes": "Verificado em campo"
}

Response:
- Status: aprovada
- aprovado_por: gestor@empresa.com
```

### Step 3️⃣ - Gerar Faturamento
```
POST /gerarFaturamentoMedicao
{
  "medicao_id": "med_1",
  "percentual_retencao": 10
}

Response:
- Medição: status='faturada'
- Receita: tipo='medicao', valor_liquido=22.500
- Conta a Receber: pendente, valor=22.500
- Tudo vinculado e auditado
```

### Resultado
```
Medição MED-1
├── Status: FATURADA ✓
├── Valor Bruto: R$25.000
├── Retenção (10%): R$2.500
├── Valor Líquido: R$22.500
└── Receita: rec_1 → Conta a Receber: conta_1
```

---

## 7. VALIDAÇÕES DE REGRA

### ❌ Não Permitido
- Enviar medição sem itens
- Aprovar medição que não está 'enviada'
- Faturar medição sem aprovação
- Faturar medição que já foi faturada
- Retenção > 100%

### ✅ Permitido
- Múltiplas medições por obra
- Medições parciais (física vs contratual)
- Cancelar medição (soft delete)
- Ajustar antes de enviar

---

## 8. CÁLCULOS

### Valor Total da Medição
```
valor_total = Σ(quantidade_periodo × valor_unitario)

Exemplo:
Item 1: 100 m³ × R$250 = R$25.000
Total = R$25.000
```

### Retenção e Valor Líquido
```
valor_retencoes = valor_bruto × (percentual / 100)
valor_liquido = valor_bruto - valor_retencoes

Exemplo:
valor_bruto = R$25.000
percentual = 10%
valor_retencoes = 25.000 × 0,10 = R$2.500
valor_liquido = 25.000 - 2.500 = R$22.500
```

### Percentual Executado
```
% executado = (quantidade_acumulada / quantidade_orcada) × 100

Exemplo:
Orçado: 1000 m³
Acumulado: 250 m³
% = (250 / 1000) × 100 = 25%
```

---

## 9. ÍNDICES RECOMENDADOS

```sql
CREATE INDEX idx_medicao_obra_status 
  ON medicao(obra_id, status);

CREATE INDEX idx_item_medicao 
  ON item_medicao(medicao_id);

CREATE INDEX idx_receita_obra_medicao 
  ON receita_obra(obra_id, medicao_id);

CREATE INDEX idx_receita_status 
  ON receita_obra(obra_id, status);
```

---

## 10. CHECKLIST

- [x] Medição com tipo (física/contratual)
- [x] Status em cascata (rascunho→enviada→aprovada→faturada)
- [x] criarMedicaoObra (com opção enviar)
- [x] aprovarMedicaoObra (com auditoria)
- [x] gerarFaturamentoMedicao (cria receita + conta receber)
- [x] Cálculo automático de retenção
- [x] Auditoria em cada operação
- [ ] Testes de fluxo (PARTE 8)
- [ ] Dashboard de medições (PARTE 9)

---

**Produção medida → Receita faturada → Cliente paga, tudo rastreado!** ✅