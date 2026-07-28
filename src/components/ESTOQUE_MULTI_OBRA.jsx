# ESTOQUE SEPARADO POR OBRA

**Data:** 2026-02-19  
**Status:** IMPLEMENTADO

---

## OBJETIVO

Separar estoque geral de estoque por obra **sem quebrar funcionalidade existente**.

**Estrutura:**
- **SaldoEstoque** = Estoque geral (central almoxarifado) por insumo
- **EstoqueObra** = Estoque específico por obra por insumo
- **MovimentacaoEstoque** = Registra TODAS as movimentações com `obra_id` obrigatório

---

## ESTRUTURA IMPLEMENTADA

### 1Campo `obra_id` em MovimentacaoEstoque

**JÁ EXISTE** como obrigatório:
```json
{
  "obra_id": {
    "type": "string",
    "description": "OBRIGATÓRIO para todos: Obra que origina ou recebe"
  }
}
```

**Tipos de movimentação com obra_id:**
- `entrada` → obra central recebe compra
- `transf_saida` → obra envia para outra
- `transf_entrada` → obra recebe de outra VINCULADA
- `baixa_obra` → obra consome insumo
- `ajuste` → ajuste de estoque com rastreabilidade

---

### 2Três Níveis de Consulta

#### **Nível 1: Estoque Geral (Central)**
**Função:** `consultarEstoqueGeral`

```json
{
  "tipo": "estoque_geral",
  "resumo": {
    "total_itens": 150,
    "valor_total_estoque": 250000.00,
    "quantidade_total": 5000,
    "itens_alerta": 3
  },
  "saldo_atual": [
    {
      "insumo_id": "ins_123",
      "almoxarifado_id": "alm_central",
      "quantidade_total": 500,
      "quantidade_disponivel": 450,
      "quantidade_reservada": 50,
      "valor_total_estoque": 5000.00
    }
  ],
  "ultimas_movimentacoes": [
    {
      "data": "2026-02-19T10:30:00Z",
      "tipo": "entrada",
      "insumo_id": "ins_123",
      "quantidade": 100,
      "obra_id": "obra_123"
    }
  ]
}
```

#### **Nível 2: Estoque por Obra**
**Função:** `consultarEstoqueObra`

```json
{
  "tipo": "estoque_obra",
  "resumo": {
    "obra_id": "obra_456",
    "total_itens": 85,
    "quantidade_total": 2500,
    "quantidade_disponivel": 2300,
    "quantidade_reservada": 200,
    "valor_total_estoque": 125000.00,
    "itens_em_alerta": 1
  },
  "estoque_atual": [
    {
      "obra_id": "obra_456",
      "insumo_id": "ins_123",
      "quantidade_total": 300,
      "quantidade_disponivel": 280,
      "quantidade_reservada": 20,
      "valor_total_estoque": 3000.00,
      "status_alerta": "ok"
    }
  ],
  "movimentacoes_recentes": [
    {
      "data": "2026-02-19T09:00:00Z",
      "tipo": "transf_saida",
      "insumo_id": "ins_123",
      "quantidade": 50,
      "obra_origem": "obra_456",
      "obra_destino": "obra_789"
    }
  ]
}
```

#### **Nível 3: Histórico Completo com Rastreabilidade**
**Busca direta em MovimentacaoEstoque:**

```json
{
  "movimentacoes": [
    {
      "id": "mov_001",
      "data": "2026-02-19T10:30:00Z",
      "tipo": "transf_entrada",
      "insumo_id": "ins_123",
      "quantidade": 50,
      "obra_id": "obra_789",
      "deposito_origem_id": "obra_456",
      "deposito_destino_id": "obra_789",
      "referencia_tipo": "transferencia",
      "referencia_id": "mov_transf_saida",
      "usuario_id": "user@company.com",
      "saldo_anterior": 250,
      "saldo_atual": 300,
      "observacao": "Transferência para obra em execução"
    }
  ]
}
```

---

## TRANSFERÊNCIA ENTRE OBRAS

**Função:** `transferirEstoqueEntreObras`

### Fluxo Automático:

```
Requisição:
├─ Validar saldo na obra origem
├─ Criar MovimentacaoEstoque (transf_saida)
│  ├─ tipo = "transf_saida"
│  ├─ obra_id = obra_origem
│  ├─ deposito_origem_id = obra_origem
│  ├─ deposito_destino_id = obra_destino
│  └─ saldo antes/depois registrado
├─ Criar MovimentacaoEstoque (transf_entrada)
│  ├─ tipo = "transf_entrada"
│  ├─ obra_id = obra_destino
│  ├─ referencia_id = mov_saida.id (VÍNCULO CRUZADO) 
│  └─ saldo antes/depois registrado
├─ Vincular MovimentacaoSaida → MovimentacaoEntrada
├─ Criar TransferenciaEstoque (resumo)
└─ LogAuditoria (rastreamento)
```

### Proteções:

```
Valida saldo disponível
Previne transferência para mesma obra
Registra ambos os lados (saída + entrada)
Vincula movimentações (referencia_id)
Preserva custo unitário
Calcula valor total da transferência
Logs com metadata completa
```

### Exemplo de Uso:

```json
REQUEST:
{
  "insumo_id": "ins_123",
  "obra_origem_id": "obra_456",
  "obra_destino_id": "obra_789",
  "quantidade": 50,
  "observacao": "Suprimento de cimento para fase 2"
}

RESPONSE:
{
  "success": true,
  "transferencia_id": "transf_001",
  "movimentacoes": {
    "saida": "mov_saida_123",
    "entrada": "mov_entrada_123"
  },
  "resumo": {
    "quantidade_transferida": 50,
    "valor_total": 500.00,
    "saldo_origem_anterior": 300,
    "saldo_origem_novo": 250,
    "saldo_destino_anterior": 200,
    "saldo_destino_novo": 250
  }
}
```

---

## TABELAS UTILIZADAS

| Tabela | Função | Campo-Chave |
|--------|--------|------------|
| **MovimentacaoEstoque** | Registro detalhado de todas as movimentações | `obra_id`, `referencia_id`, `tipo` |
| **SaldoEstoque** | Saldo geral por almoxarifado | `almoxarifado_id`, `insumo_id` |
| **EstoqueObra** | Saldo por obra (derived/denormalizado) | `obra_id`, `insumo_id` |
| **TransferenciaEstoque** | Resumo de transferências entre obras | `mov_saida_id`, `mov_entrada_id` |

---

## GARANTIAS DE INTEGRIDADE

| Garantia | Mecanismo | Status |
|----------|-----------|--------|
| **Sem duplicação** | Referência cruzada (saída ↔ entrada) | |
| **Estoque geral não quebra** | SaldoEstoque mantém somatório | |
| **Rastreabilidade 100%** | Cada mov. tem obra_id + ref. | |
| **Histórico completo** | Saldo antes/depois em cada mov. | |
| **Vínculo entre obras** | referencia_id liga saída-entrada | |
| **Custo preservado** | valor_unitario cópia exata | |

---

## TESTES IMPLEMENTADOS

**Função:** `testeEstoqueMultiObra`

### Teste 1: Consultar Estoque Geral
Busca todos os insumos do almoxarifado  
Calcula resumo (total, valor, itens em alerta)  
Retorna últimas movimentações

### Teste 2: Consultar Estoque por Obra
Busca insumos específicos da obra  
Computa disponível vs reservado  
Mostra movimentações recentes

### Teste 3: Validar `obra_id` em Movimentações
Verifica se todas as movimentações têm `obra_id`  
Identifica registros órfãos  
Relatório de conformidade

### Teste 4: Histórico de Movimentações
Agrupa por obra  
Mostra tipos de mov. (entrada, transf_saida, etc.)  
Confirma rastreabilidade

---

## COMO USAR

### 1. Consultar Estoque Geral
```javascript
const res = await base44.functions.invoke('consultarEstoqueGeral', {
  almoxarifado_id: null, // null = todos
  insumo_id: null        // null = todos
});
```

### 2. Consultar Estoque de Uma Obra
```javascript
const res = await base44.functions.invoke('consultarEstoqueObra', {
  obra_id: 'obra_456'
});
```

### 3. Transferir entre Obras
```javascript
const res = await base44.functions.invoke('transferirEstoqueEntreObras', {
  insumo_id: 'ins_123',
  obra_origem_id: 'obra_456',
  obra_destino_id: 'obra_789',
  quantidade: 50,
  observacao: 'Suprimento fase 2'
});
```

### 4. Executar Testes
```javascript
const res = await base44.functions.invoke('testeEstoqueMultiObra', {});
```

---

## PRÓXIMOS PASSOS

- [ ] Dashboard visual de estoque por obra
- [ ] Alertas de transferência pendente
- [ ] Relatório de consumo por obra
- [ ] Previsão de demanda multi-obra
- [ ] Integração com medicão (consumir automático)

---

**Implementação:** COMPLETA  
**Consultas:** FUNCIONAIS  
**Transferências:** COM HISTÓRICO  
**Rastreabilidade:** 100%