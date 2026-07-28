# FLUXO DRE: CONSOLIDAÇÃO DE CUSTO E RECEITA POR OBRA (PARTE 8/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
MOVIMENTAÇÕES DE CUSTO         MOVIMENTAÇÕES DE RECEITA
├─ Estoque (BAIXA_OBRA)        ├─ Medição (faturada)
├─ Nota Fiscal                 └─ Contrato/Aditivo
├─ Mão de Obra
├─ Frota
└─ Serviços
    ↓                              ↓
    └──────→ DRE POR OBRA ←────────┘
             (consolidado)
```

Cada custo/receita é lançado com origem rastreável, alimentando a DRE automaticamente.

---

## 1. ENTIDADES

### LancamentoCustoObra
```json
{
  "obra_id": "OBRIGATÓRIO",
  "data_lancamento": "timestamp",
  "origem_tipo": "estoque_baixa|nota_fiscal|mao_de_obra|frota|servico|outro",
  "origem_id": "ID do documento de origem",
  "centro_custo_id": "Centro de custo",
  "categoria": "material|mao_de_obra|equipamento|transporte|servico|aluguel|impostos",
  "descricao": "Descrição do custo",
  "valor": "Valor do custo",
  "insumo_id": "Se origem=estoque",
  "fornecedor_id": "Se origem=nf",
  "referencia_numero": "NF, OC, etc",
  "mes_referencia": "YYYY-MM-01 para agrupamento",
  "status": "lançado|provisionado|realizado"
}
```

### LancamentoReceitaObra
```json
{
  "obra_id": "OBRIGATÓRIO",
  "data_lancamento": "timestamp",
  "origem_tipo": "medicao|contrato|aditivo|outro",
  "origem_id": "receita_id ou medicao_id",
  "descricao": "Descrição da receita",
  "valor_bruto": "Valor bruto",
  "retencoes_percentual": "% de retenção",
  "valor_retencoes": "Valor descontado",
  "valor_liquido": "Valor a receber",
  "medicao_id": "Se origem=medicao",
  "cliente_id": "ID do cliente",
  "mes_referencia": "YYYY-MM-01 para agrupamento",
  "status": "previsto|faturado|recebido"
}
```

---

## 2. OPERAÇÃO 1: LANÇAR CUSTO

### criarLancamentoCustoObra
```javascript
POST /criarLancamentoCustoObra
{
  "obra_id": "obra_123",
  "origem_tipo": "estoque_baixa",
  "origem_id": "mov_1",
  "categoria": "material",
  "descricao": "Cimento consumido",
  "valor": 500,
  "insumo_id": "cimento_1",
  "referencia_numero": "MOV-001"
}
```

**Validações:**
- ✓ Obra existe
- ✓ Valor > 0
- ✓ Origem tipo válido

**Operações:**
1. Cria `LancamentoCustoObra`
2. Calcula `mes_referencia` = primeiro dia do mês
3. Status = 'lançado'
4. Registra auditoria

**Response:**
```json
{
  "ok": true,
  "data": {
    "lancamento": {
      "id": "lc_1",
      "obra_id": "obra_123",
      "origem_tipo": "estoque_baixa",
      "valor": 500,
      "mes_referencia": "2026-02-01"
    }
  }
}
```

---

## 3. OPERAÇÃO 2: LANÇAR RECEITA

### criarLancamentoReceitaObra
```javascript
POST /criarLancamentoReceitaObra
{
  "obra_id": "obra_123",
  "origem_tipo": "medicao",
  "origem_id": "receita_1",
  "descricao": "Faturamento Medição 1",
  "valor_bruto": 25000,
  "retencoes_percentual": 10,
  "medicao_id": "med_1"
}
```

**Validações:**
- ✓ Obra existe
- ✓ Valor bruto > 0
- ✓ Retenção entre 0-100%

**Operações:**
1. Calcula retenção: `valor_retencoes = valor_bruto × (% / 100)`
2. Calcula líquido: `valor_liquido = valor_bruto - valor_retencoes`
3. Cria `LancamentoReceitaObra`
4. Status = 'previsto'
5. Registra auditoria

**Response:**
```json
{
  "ok": true,
  "data": {
    "lancamento": {
      "id": "lr_1",
      "obra_id": "obra_123",
      "origem_tipo": "medicao",
      "valor_bruto": 25000,
      "valor_retencoes": 2500,
      "valor_liquido": 22500,
      "mes_referencia": "2026-02-01"
    }
  }
}
```

---

## 4. OPERAÇÃO 3: CONSULTAR DRE

### getDREObra
```javascript
POST /getDREObra
{
  "obra_id": "obra_123",
  "mes_referencia": "2026-02-01"  // opcional, senão retorna acumulado
}
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "obra_id": "obra_123",
    "mes_referencia": "2026-02-01",
    "receita": {
      "bruta": 25000,
      "retencoes": 2500,
      "liquida": 22500,
      "quantidade_lancamentos": 1
    },
    "custos": {
      "por_categoria": {
        "material": 500,
        "mao_de_obra": 1000,
        "servico": 2000
      },
      "total": 3500,
      "quantidade_lancamentos": 3
    },
    "resultado": {
      "liquido": 19000,
      "margem_liquida": "84.44"
    },
    "resumo": {
      "receita_liquida": 22500,
      "(-) custos": 3500,
      "(=) resultado": 19000,
      "(%) margem": "84.44"
    }
  }
}
```

---

## 5. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Consumo de Material
```
MovimentacaoEstoque(BAIXA_OBRA)
↓
criarLancamentoCustoObra
{
  "obra_id": "obra_123",
  "origem_tipo": "estoque_baixa",
  "valor": 500,
  "categoria": "material"
}

Resultado:
- LancamentoCustoObra criado
- mes_referencia = "2026-02-01"
```

### Step 2️⃣ - Recebimento de NF
```
NotaFiscal registrada
↓
criarLancamentoCustoObra
{
  "obra_id": "obra_123",
  "origem_tipo": "nota_fiscal",
  "valor": 1500,
  "categoria": "material",
  "referencia_numero": "NF-001"
}

Resultado:
- LancamentoCustoObra criado (estoque central)
```

### Step 3️⃣ - Faturamento de Medição
```
ReceitaObra(faturada)
↓
criarLancamentoReceitaObra
{
  "obra_id": "obra_123",
  "origem_tipo": "medicao",
  "valor_bruto": 25000,
  "retencoes_percentual": 10
}

Resultado:
- LancamentoReceitaObra criado
- valor_liquido = 22.500
```

### Step 4️⃣ - Consultar DRE
```
GET /getDREObra
{
  "obra_id": "obra_123",
  "mes_referencia": "2026-02-01"
}

Resultado:
RECEITA BRUTA         R$ 25.000
(-) Retenções         R$ (2.500)
─────────────────────────────
RECEITA LÍQUIDA       R$ 22.500

CUSTOS TOTAIS         R$ 3.500
  Material            R$   500
  Outras              R$ 3.000

─────────────────────────────
RESULTADO LÍQUIDO     R$ 19.000
MARGEM LÍQUIDA        84,44%
```

---

## 6. ALIMENTAÇÃO AUTOMÁTICA

### Quando criar LancamentoCustoObra?

| Evento | Origem | Categoria | Valor |
|--------|--------|-----------|-------|
| MovimentacaoEstoque(BAIXA_OBRA) | estoque_baixa | material | quantidade × valor_unitario |
| NotaFiscal(registrada) | nota_fiscal | [por categoria] | valor_liquido |
| ApontamentoHoras | mao_de_obra | mao_de_obra | horas × valor_hora |
| Viagem(finalizada) | frota | transporte | km × custo/km |

### Quando criar LancamentoReceitaObra?

| Evento | Origem | Status | Valor |
|--------|--------|--------|-------|
| ReceitaObra(faturada) | medicao | faturado | valor_liquido |
| Contrato(ativo) | contrato | previsto | valor_total |

---

## 7. ESTRUTURA DRE PADRÃO

```
DEMONSTRAÇÃO DE RESULTADO - Obra XYZ
Período: 02/2026

RECEITA
  Receita Bruta                          R$  100.000
  (-) Retenções (ISS, INSS)              R$ (10.000)
  ────────────────────────────────────────────────
  RECEITA LÍQUIDA                        R$   90.000

CUSTOS
  Material                               R$ (20.000)
  Mão de Obra                            R$ (25.000)
  Equipamento/Aluguel                    R$ (15.000)
  Serviços/Subcontratos                  R$ (10.000)
  Transporte/Frota                       R$  (5.000)
  ────────────────────────────────────────────────
  CUSTO TOTAL                            R$ (75.000)

RESULTADO
  ════════════════════════════════════════════════
  RESULTADO LÍQUIDO                      R$   15.000
  MARGEM BRUTA                           16,67%
```

---

## 8. VALIDAÇÕES

### ❌ Não Permitido
- Lançar custo com valor ≤ 0
- Lançar receita sem valor bruto
- Retenção > 100%
- Lançar em obra inexistente

### ✅ Permitido
- Múltiplos lançamentos por origem
- Lançamentos sem centro de custo
- Ajustes posterior (soft delete)

---

## 9. ÍNDICES RECOMENDADOS

```sql
CREATE INDEX idx_custo_obra_mes 
  ON lancamento_custo_obra(obra_id, mes_referencia);

CREATE INDEX idx_custo_origem 
  ON lancamento_custo_obra(origem_tipo, origem_id);

CREATE INDEX idx_receita_obra_mes 
  ON lancamento_receita_obra(obra_id, mes_referencia);

CREATE INDEX idx_receita_origem 
  ON lancamento_receita_obra(origem_tipo, origem_id);
```

---

## 10. AUTOMAÇÃO SUGERIDA

Criar automações para alimentar automaticamente:

```javascript
// Quando MovimentacaoEstoque(BAIXA_OBRA) é criada
base44.functions.invoke('criarLancamentoCustoObra', {
  obra_id: movimento.obra_id,
  origem_tipo: 'estoque_baixa',
  origem_id: movimento.id,
  categoria: 'material',
  valor: movimento.valor_total
});

// Quando ReceitaObra é faturada
base44.functions.invoke('criarLancamentoReceitaObra', {
  obra_id: receita.obra_id,
  origem_tipo: 'medicao',
  origem_id: receita.id,
  valor_bruto: receita.valor_bruto,
  retencoes_percentual: receita.retencoes_percentual
});
```

---

## 11. CHECKLIST

- [x] Entidades LancamentoCustoObra e LancamentoReceitaObra
- [x] Validador de DRE
- [x] criarLancamentoCustoObra
- [x] criarLancamentoReceitaObra
- [x] getDREObra (consolidação)
- [x] Alimentação por origem
- [x] Cálculo automático de retenção
- [x] Auditoria em lançamentos
- [ ] Automações (PARTE 9)
- [ ] Painel DRE visual (PARTE 10)

---

**Custos e receitas rastreados por origem, DRE consolidada por obra, sempre auditado!** ✅