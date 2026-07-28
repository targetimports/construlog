# MAPEAMENTO COMPLETO DA ESTRUTURA DO SISTEMA ERP

**Data:** 2026-02-19  
**Status:** ANÁLISE APENAS - SEM ALTERAÇÕES  
**Total de Entidades:** 252

---

## 1TABELAS CORE (NÚCLEO)

### OBRA (Núcleo Central)
- **Entity:** `Obra.json`
- **Status:** TABELA CONSOLIDADA

**Campos:** codigo, nome, tipo, tipo_obra, fase, status, cliente, cidade, estado, responsavel_tecnico, responsavel_obra, data_inicio, data_prevista_fim, total_orcamento

---

## TABELAS COM obra_id OBRIGATÓRIO (17)

1. ContaFinanceira 
2. OrdemCompra 
3. Medicao/MedicaoContrato 
4. RequisicaoCompra 
5. Contrato 
6. MovimentacaoEstoque 
7. ApontamentoHora 
8. UsoVeiculo 

---

## TABELAS EM RISCO (8)

1. **FolhaPagamento** - **CRÍTICO** - SEM obra_id
2. **LancamentoFolhaPagamento** - Verificar
3. **Veiculo** - **CRÍTICO** - Sem obra_id (global)
4. **ManutencaoVeiculo** - Verificar
5. **Abastecimento** - Verificar
6. **CustoVeiculo** - Verificar
7. **MaterialSolicitado** - Verificar
8. **SugestaoCompra** - Verificar

---

## 2MÓDULO FINANCEIRO

### ContaFinanceira 
- `obra_id` - **OBRIGATÓRIO**
- Tipos: pagar/receber
- Fluxo: Manual + Auto (OrdemCompra, Medicao, RequisicaoCompra)

### OrdemCompra 
- `obra_id` - **OBRIGATÓRIO**
- Fluxo: RequisicaoCompra → CotacaoFornecedor → OrdemCompra → ContaFinanceira

### Medicao 
- `obra_id` - **OBRIGATÓRIO**
- Fluxo: Contrato → Medicao → ContaFinanceira (receber)

### RequisicaoCompra 
- `obra_id` - **OBRIGATÓRIO**
- Fluxo: RequisicaoCompra (aprovada) → OrdemCompra → ContaFinanceira

### Contrato 
- `obra_id` - **OBRIGATÓRIO**

### FolhaPagamento RISCO
- **SEM `obra_id`** - Gerada por empresa, não por obra
- Impacto: Custo RH não rastreado por obra
- Solução: Adicionar `obra_id` NULLABLE ou via LancamentoFolhaPagamento

---

## 3MÓDULO ALMOXARIFADO

### MovimentacaoEstoque 
- `obra_id` - **OBRIGATÓRIO**
- Tipos: entrada/transf_saida/transf_entrada/baixa_obra/ajuste

### EstoqueObra 
- **VERIFICAR se `obra_id` é obrigatório**

---

## 4MÓDULO RH

### ApontamentoHora 
- `obra_id` - **OBRIGATÓRIO**
- `colaborador_id` - **OBRIGATÓRIO**

### Colaborador 
- `obra_atual_id` - ÚNICA OBRA ATUAL
- `obras_vinculadas` - ARRAY (múltiplas)
- Risco: Apontamentos podem não rastrear corretamente

---

## 5MÓDULO LOGÍSTICA

### UsoVeiculo 
- `obra_id` - **OBRIGATÓRIO**
- Fluxo: Motorista usa veículo em obra específica

### Veiculo RISCO
- **SEM `obra_id`** - Tabela global (veículos compartilhados)
- Vincular via: UsoVeiculo, ManutencaoVeiculo, Abastecimento

### ManutencaoVeiculo 
- **VERIFICAR se `obra_id` é obrigatório**

### Abastecimento 
- **VERIFICAR se `obra_id` é obrigatório**

---

## PONTOS CRÍTICOS DE RISCO

| Item | Problema | Impacto | Solução |
|------|----------|--------|---------|
| FolhaPagamento | Sem obra_id | Custo RH não rastreado | Adicionar obra_id |
| Veiculo | Sem obra_id | Global (OK) | Vincular via UsoVeiculo |
| ManutencaoVeiculo | Sem verificação | Custos perdidos | Adicionar obra_id |
| Abastecimento | Sem verificação | Custos perdidos | Adicionar obra_id |
| Colaborador | Múltiplas obras | Apontamento ambíguo | Validar obra_id sempre |

---

## FLUXOS DE ENCADEAMENTO

```
COMPRA:
RequisicaoCompra → OrdemCompra → ContaFinanceira (pagar)

RECEITA:
Contrato → Medicao → ContaFinanceira (receber)

RH:
ApontamentoHora (obra_id) → FolhaPagamento (SEM OBRA)

LOGÍSTICA:
UsoVeiculo (obra_id) → Abastecimento (verificar)
                    → ManutencaoVeiculo (verificar)
```

---

**Status:** Mapeamento completo sem alterações