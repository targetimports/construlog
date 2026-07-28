# FLUXO CONSULTAS: BUSCA GLOBAL + POR MÓDULO (PARTE 9/10)

**Status:** ✅ Implementado  
**Data:** 2026-02-15

---

## VISÃO GERAL

```
Consultas Menu
├─ Busca Global (agrupada por categoria)
├─ Compras (OC + Requisições + Cotações)
├─ Estoque (Movimentações)
├─ Financeiro (NF + Contas)
├─ Medições & Receitas
└─ Campo (Diários)
```

Encontre qualquer coisa por obra em até 3 cliques com paginação automática.

---

## 1. BUSCA GLOBAL

### searchGlobal
```javascript
POST /searchGlobal
{
  "obra_id": "obra_123",
  "termo": "cimento"
}
```

**Retorna agrupado por categoria:**
```json
{
  "termo": "cimento",
  "total": 12,
  "resultados": {
    "ordens_compra": [
      { "numero": "OC-001", "fornecedor_nome": "Acme", "valor_total": 5000 }
    ],
    "notas_fiscais": [
      { "numero_nf": "NF-001", "descricao": "Cimento 50kg", "valor_bruto": 500 }
    ],
    "medicoes": [
      { "numero": "MED-001", "valor_total_realizado": 25000 }
    ],
    "contas": [...],
    "movimentacoes": [...],
    "receitas": [...]
  }
}
```

**Funcionalidade:**
- Debounce 300ms
- Mínimo 2 caracteres
- Máximo 5 resultados por categoria
- Busca case-insensitive em nome, número, descrição

---

## 2. CONSULTAS POR MÓDULO

### ConsultasCompras
Filtra:
- Status (rascunho, enviada, aprovada, etc)
- Data
- Fornecedor
- Valor (mín-máx)

Paginação: 10 items/página

### ConsultasEstoque
Filtra:
- Tipo (entrada, transf_saida, transf_entrada, baixa_obra, ajuste)
- Data
- Categoria
- Valor

Ordenação: Data decrescente (mais recentes primeiro)

### ConsultasFinanceiro
2 abas:
- **Notas Fiscais**: NF status, data, valor
- **Contas**: Contas a pagar/receber por status

Filtra:
- Status
- Data
- Fornecedor
- Valor

### ConsultasMedicoes
2 abas:
- **Medições**: Medições por status
- **Receitas**: Receitas de medições

Filtra:
- Status (rascunho, enviada, aprovada, faturada)
- Data
- Valor

### ConsultasCampo
- Diários de obra
- Data, clima, qtd funcionários, status

Ordenação: Data decrescente

---

## 3. COMPONENTES

### BuscaGlobal.jsx
- Input com debounce
- Cards agrupados por categoria
- Máximo 5 itens por categoria
- Hover para detalhar

### FiltrosConsulta.jsx
- Reutilizável em todos módulos
- Status, Data, Fornecedor, Valor
- Botão "Limpar Filtros"

### Paginação
- Botões Anterior/Próximo
- Mostra página atual vs total
- Desabilitado em limites

---

## 4. EXEMPLO: FLUXO COMPLETO

### Step 1️⃣ - Ir para Consultas
```
Menu → Consultas (nova página)
```

### Step 2️⃣ - Busca Global
```
Input: "cimento"
Resultado: 12 encontrados
- OC-001
- NF-001
- MED-001
- 3 movimentações de estoque
```

### Step 3️⃣ - Consulta Detalhada (Compras)
```
Clica em "Compras"
Filtra:
- Status: aprovada
- Data: 01/02/2026 até 15/02/2026
- Valor mín: 1000

Resultado: 8 OCs aprovadas nesse período
Paginação: 10 itens/página
```

### Resultado
```
Usuário encontrou o que buscava em:
1 clique no menu
2 cliques na consulta específica
1 busca/filtro

Total: 3-4 cliques ✓
```

---

## 5. PERFORMANCE

### Índices
```sql
CREATE INDEX idx_oc_obra_status ON ordem_compra(obra_id, status);
CREATE INDEX idx_nf_obra_data ON nota_fiscal(obra_id, data);
CREATE INDEX idx_conta_obra_vencimento ON conta_financeira(obra_id, data_vencimento);
CREATE INDEX idx_medicao_obra_status ON medicao(obra_id, status);
CREATE INDEX idx_diario_obra_data ON diario_obra(obra_id, data);
```

### Paginação
- 10 items por página (padrão)
- Debounce 300ms em busca global
- Filtros locais (não consulta backend a cada mudança)
- Carregamento em paralelo (Promise.all)

---

## 6. VALIDAÇÕES

### ❌ Não Permitido
- Buscar sem obra selecionada
- Buscar com < 2 caracteres
- Ir para consultasMódulo sem obra

### ✅ Permitido
- Filtros vazios (mostra todos)
- Múltiplas abas por módulo
- Paginação em tempo real

---

## 7. MENU NAVIGATION

```
Dashboard
├─ Obras
├─ [NOVO] Consultas ← AQUI
├─ Compras
├─ Estoque
├─ Financeiro
├─ Medições
└─ Campo
```

---

## 8. CHECKLIST

- [x] Busca Global com agrupamento
- [x] ConsultasCompras (com paginação)
- [x] ConsultasEstoque (com filtros)
- [x] ConsultasFinanceiro (2 abas)
- [x] ConsultasMedicoes (2 abas)
- [x] ConsultasCampo (Diários)
- [x] FiltrosConsulta (reutilizável)
- [x] Paginação em todos módulos
- [x] Debounce em busca global
- [x] Índices de performance
- [ ] Testes (PARTE 10)

---

**Encontre qualquer coisa por obra em até 3 cliques!** ✅