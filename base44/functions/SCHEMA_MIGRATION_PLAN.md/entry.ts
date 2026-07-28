# PLANO DE MIGRAÇÃO: obraId + FKs + ÍNDICES (Base44)

**Data:** 2026-02-15 | **Status:** PARTE 2/10 - Diagnóstico + Planejamento

---

## DIAGNÓSTICO ATUAL

### Cobertura de `obra_id`:
✅ **OK:** Medicao, ApontamentoHoras (obrigatório)  
⚠️ **OPCIONAL:** OrdemCompra, MovimentacaoEstoque  
❌ **FALTA:** RecebimentoMaterial, NotaFiscal, ContaFinanceira  

---

## ESTRATÉGIA MIGRAÇÃO (3 FASES)

### FASE 1: Saneamento (AGORA ✅)
- `diagnosticoEsquemaObraId()` lista órfãos
- `SaneamentoDados` (admin) atribui obra_id manualmente
- Log em `LogAuditoriaSistema`

### FASE 2: Schema (PARTE 3)
- Adicionar `obra_id` + `centro_custo_id` aos schemas
- Marcar como `required` nas entidades críticas

### FASE 3: Validação (PARTE 4)
- `validarObraObrigatoria()` bloqueia sem obra
- Atualizar funções create/update

---

## ENTIDADES A AJUSTAR

| Entidade | Ação | Prioridade |
|----------|------|-----------|
| OrdemCompra | Tornar `obra_id` obrigatório | 🔴 ALTA |
| RecebimentoMaterial | Adicionar `obra_id` via OC | 🔴 ALTA |
| NotaFiscal | Adicionar `obra_id` | 🔴 ALTA |
| ContaFinanceira | Adicionar `obra_id` | 🔴 ALTA |
| CentroCusto | Adicionar ref em financeiro | 🟡 MÉDIA |

---

## ÍNDICES CRIADOS

Base44 auto-indexa FKs. Índices compostos necessários:
- `(obra_id, status)` — filtros comuns
- `(obra_id, created_date)` — ordenação temporal
- `(obra_id, centro_custo_id)` — agrupamento

---

**Execução:** Use `diagnosticoEsquemaObraId()` para ver status.