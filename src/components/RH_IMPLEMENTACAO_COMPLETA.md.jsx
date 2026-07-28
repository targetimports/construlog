# 📋 Módulo RH - Implementação Completa

**Data:** 2026-02-16  
**Status:** ✅ Implementado  
**Escopo:** Cadastro de Colaboradores + Remuneração + Jornada + Geração de Folha de Pagamento

---

## 📍 TXT 01 — Arquitetura Geral

### Onde fica cada coisa?
- **RH > Colaboradores**: Dados pessoais + Remuneração + Jornada (FormIntegrado)
- **RH > Folha de Pagamento**: Geração mensal + integração automática em Gastos
- **Administração**: Apenas usuários, permissões, perfis e acessos (SEM remuneração)

### Fluxo automático
1. RH preenche Remuneração + Jornada em RH > Colaboradores
2. Sistema calcula `custo_total_mensal` automaticamente
3. Integra em GASTOS (Mão de Obra) quando gera folha
4. Todo mês: RH > Folha de Pagamento > Gerar Folha → cria lançamentos
5. **Permissão:** Só RH/Admin editam valores

### Jornada de Trabalho
- **Tipos:** 6x1, 5x2, 12x36, 7x0, Personalizada
- **Campos:** dias_trabalho, dias_folga, horario_entrada, horario_saida, carga_semanal_horas, intervalo_minutos

---

## 🗄️ TXT 02 — Modelagem (Entidades)

### Colaborador (atualizado)
```json
{
  "remuneracao": {
    "salario_base": "number",
    "bonificacao_percentual": "number",
    "bonificacao_valor": "number",
    "desconto_vale_refeicao": "number",
    "desconto_vale_transporte": "number",
    "desconto_vale_alimentacao": "number",
    "fgts_percentual": "number (padrão 8)",
    "inss_percentual": "number (padrão 8)",
    "ir_percentual": "number",
    "outros_descontos": "number",
    "custo_total_mensal": "number (calculado)"
  },
  "jornada": {
    "tipo": "6x1 | 5x2 | 12x36 | 7x0 | personalizada",
    "dias_trabalho": ["SEG", "TER", ...],
    "dias_folga": ["SAB", "DOM"],
    "carga_semanal_horas": "number",
    "horario_entrada": "HH:MM",
    "horario_saida": "HH:MM",
    "intervalo_minutos": "number",
    "observacoes_jornada": "string"
  }
}
```

### ColaboradorBeneficio
```json
{
  "colaborador_id": "string (obrigatório)",
  "nome": "Vale Transporte | Vale Refeição | Plano Saúde | ...",
  "valor_mensal": "number",
  "ativo": "boolean (padrão true)"
}
```

### ColaboradorCustoExtra
```json
{
  "colaborador_id": "string (obrigatório)",
  "descricao": "Ajuda de custo | EPI | Cesta básica | ...",
  "valor_mensal": "number",
  "ativo": "boolean (padrão true)"
}
```

### FolhaPagamento
```json
{
  "competencia": "YYYY-MM (obrigatório, ex: 2026-02)",
  "empresa_id": "string",
  "status": "rascunho | gerada | processada | cancelada",
  "total": "number",
  "total_itens": "number",
  "criado_por": "email do usuário",
  "lancamento_id": "ID do lançamento em ContaFinanceira",
  "observacoes": "string"
}
```

### FolhaPagamentoItem
```json
{
  "folha_id": "string (obrigatório)",
  "colaborador_id": "string (obrigatório)",
  "salario_base": "number",
  "bonificacao": "number",
  "fgts": "number (calculado)",
  "beneficios": "number (soma de benefícios ativos)",
  "extras": "number (soma de custos extras ativos)",
  "total_item": "number (salário + bônus + FGTS + benefícios + extras)",
  "referencia_unica": "YYYY-MM:colaborador_id (evita duplicação)",
  "lancamento_id": "ID do lançamento em ContaFinanceira"
}
```

---

## 🎨 TXT 03 — Interface (FormIntegrado)

### Estrutura
**RH > Colaboradores > FormIntegrado.jsx**
- **Tab 1: Dados Pessoais** (nome, CPF, email, cargo, departamento, etc.)
- **Tab 2: Remuneração** (salário, bônus, FGTS, benefícios, extras, totais)
- **Tab 3: Jornada** (tipo, horários, carga semanal, intervalo)
- **Seção: Equipes** (seleção múltipla)
- **Seção: Obras Vinculadas** (obra + função + datas)

### Permissões UI
- **Sem RH_SALARIO_VIEW:** Tab Remuneração oculta completamente
- **Com VIEW, sem EDIT:** Modo leitura (campos disabled)
- **Com EDIT:** Modo completo (edição habilitada)

### Comportamento
- Benefícios e Extras aparecem como blocos adicionáveis
- Custo Total Mensal é **leitura obrigatória** (calculado pelo backend)
- Jornada com select de tipo + campos condicionais por tipo
- Validação obrigatória: nome, CPF, cargo

---

## 💰 TXT 04 — Geração de Folha

### Página: RH > Folha de Pagamento
**pages/FolhasPagamento.jsx**
- Select de competência (YYYY-MM) com dropdown dos últimos 12 meses + próximos 3
- Botão: "Gerar Folha"
- Lista de folhas geradas com status (rascunho, gerada, processada, cancelada)
- Botão "Visualizar" → modal com itens (colaborador, salário, bônus, FGTS, benefícios, extras, total)

### Backend: gerarFolhaPagamento()
**functions/gerarFolhaPagamento.js**

**Fluxo:**
1. Recebe `competencia` (ex: "2026-02")
2. Cria registro em `FolhaPagamento` com status "gerada"
3. Para cada colaborador ATIVO:
   - Busca `remuneracao` + `jornada` + benefícios + extras
   - Calcula: salário + bônus + FGTS + benefícios + extras
   - Cria `FolhaPagamentoItem` com `referencia_unica` = "2026-02:colab_id"
   - Se já existe item com mesma referência → ignora (idempotência)
4. Cria lançamento único em `ContaFinanceira`:
   - tipo: "pagar"
   - categoria: "mao_de_obra"
   - descrição: "Folha de Pagamento - 2026-02"
   - valor: soma de todos os itens
   - obra_id: "Administrativo" (ou obra padrão do colaborador, se houver)
   - referencia_tipo: "folha_pagamento"
5. Atualiza `FolhaPagamento.status` → "processada"
6. Retorna: total_itens, total, data_criacao

**Idempotência:**
- Campo `referencia_unica` garante que não cria duplicatas
- Se re-executar com mesma competência, ignora colaboradores já lançados

**Integração Gastos:**
- Lançamento aparece automaticamente em Financeiro > Contas a Pagar > Mão de Obra
- Elo: `FolhaPagamento.lancamento_id` ↔ `ContaFinanceira.referencia_id`

---

## 🔐 TXT 05 — Permissões Granulares

### Permissões Novas
```
RH_COLABORADOR_VIEW   → pode visualizar aba Dados Pessoais
RH_COLABORADOR_EDIT   → pode editar dados pessoais
RH_SALARIO_VIEW       → pode visualizar aba Remuneração (salários, bônus, FGTS)
RH_SALARIO_EDIT       → pode editar remuneração
RH_FOLHA_GERAR        → pode gerar folha de pagamento mensal
```

### Atribuição por Perfil

| Perfil | VIEW | EDIT | FOLHA | Notas |
|--------|------|------|-------|-------|
| **admin_empresa** | ✅ | ✅ | ✅ | Acesso total exceto TI |
| **rh** | ✅ | ✅ | ✅ | Função principal |
| **campo** | ❌ | ❌ | ❌ | Operacional |
| **motorista** | ❌ | ❌ | ❌ | Operacional |
| **almoxarifado** | ❌ | ❌ | ❌ | Operacional |

### Implementação

**1. defaultPermissions.ts**
```javascript
admin_empresa: {
  RH_COLABORADOR_VIEW: true,
  RH_COLABORADOR_EDIT: true,
  RH_SALARIO_VIEW: true,
  RH_SALARIO_EDIT: true,
  RH_FOLHA_GERAR: true,
  // ... outras
}

rh: {
  RH_COLABORADOR_VIEW: true,
  RH_COLABORADOR_EDIT: true,
  RH_SALARIO_VIEW: true,
  RH_SALARIO_EDIT: true,
  RH_FOLHA_GERAR: true,
  // ... outras
}

// campo, motorista, almoxarifado NÃO recebem RH_* perms
```

**2. FormIntegrado.jsx**
```javascript
const canViewSalario = useHasPermission('RH_SALARIO_VIEW');
const canEditSalario = useHasPermission('RH_SALARIO_EDIT');

// Aba Remuneração
{!canViewSalario && (
  <div>Sem permissão para visualizar</div>
)}
{canViewSalario && !canEditSalario && (
  <div>Modo leitura</div>
)}
```

**3. getEffectivePermissionsV2.js**
- **Fallback seguro:** se API falhar, usa defaultPermissions (NUNCA retorna perms=0)
- **admin_empresa:** libera tudo exceto TI
- **Outros:** libera somente conforme role

---

## 🔧 Funções Utilizadas

| Função | Localização | Descrição |
|--------|-------------|-----------|
| `gerarFolhaPagamento` | functions/ | Cria folha mensal + lançamentos |
| `calcularCustoMensalColaborador` | functions/ | Atualiza custo_total_mensal |
| `getEffectivePermissionsV2` | functions/ | RBAC com fallback |
| `initializeRolePermissionsGranular` | functions/ | Bootstrap de permissões |

---

## 📄 Páginas

| Página | Caminho | Usuários | Descrição |
|--------|---------|----------|-----------|
| **Colaboradores** | RH > Colaboradores | RH, Admin | Lista + FormIntegrado |
| **Folha Pagamento** | RH > Folha de Pagamento | RH, Admin | Geração mensal |

---

## ✅ Checklist de Implementação

- ✅ Entidades criadas (Colaborador + FolhaPagamento + itens)
- ✅ FormIntegrado com 3 tabs (dados, remuneração, jornada)
- ✅ Permissões granulares (RH_SALARIO_* + RH_COLABORADOR_*)
- ✅ Página FolhasPagamento (geração + visualização)
- ✅ Backend: gerarFolhaPagamento (idempotência + integração Gastos)
- ✅ Menu atualizado (RH > Folha de Pagamento)
- ✅ Fallback seguro em getEffectivePermissionsV2 (nunca retorna vazio)

---

## 🚀 Próximos Passos (Opcional)

- [ ] Botão "Recalcular folha" (apenas rascunho)
- [ ] Botão "Cancelar folha" (marca como cancelada + estorna lançamentos)
- [ ] Integração com férias/afastamentos (reduz salário)
- [ ] Relatório de apontamento de horas vs salário
- [ ] Sincronização com sistema de ponto
- [ ] Exportar folha em PDF/Excel

---

**Documentação gerada em:** 2026-02-16  
**Versão:** 1.0 — Implementação Completa