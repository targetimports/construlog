# SISTEMA DE PERMISSÃO: PERFIL + OBRA

**Data:** 2026-02-19  
**Status:** IMPLEMENTADO

---

## OBJETIVO

Controlar acesso a dados por PERFIL + OBRA, garantindo que cada usuário só veja/edite dados de suas obras.

---

## NÍVEIS DE ACESSO

| Nível | Acesso | Descrição |
|-------|--------|-----------|
| **Administrador** | TUDO | Acesso irrestrito (role=admin) |
| **Mestre de Obras** | Todas suas obras | Gerencia múltiplas obras vinculadas |
| **Encarregado** | Uma ou mais obras | Responsável de obra específica |
| **Funcionário** | Uma obra apenas | Operário/colaborador em 1 obra |

---

## ESTRUTURA IMPLEMENTADA

### 1. Tabela UsuarioObra

```json
{
  "user_email": "string (OBRIGATÓRIO)",
  "obra_id": "string (OBRIGATÓRIO)",
  "perfil": "enum[administrador, mestre_de_obras, encarregado, funcionario] (OBRIGATÓRIO)",
  "data_inicio": "date",
  "data_fim": "date (null = ativo permanente)",
  "ativo": "boolean (default: true)"
}
```

**Índices:**
- `(user_email, obra_id)` ÚNICO
- `obra_id`
- `user_email`

---

### 2. Validação de Acesso

**Função:** `validarAcessoObraUsuario`

**Input:**
```json
{
  "obra_id": "obra_123" (opcional)
}
```

**Output (com obra_id):**
```json
{
  "success": true,
  "tem_acesso": true,
  "motivo": "vinculo_valido",
  "perfil": "encarregado",
  "obra_id": "obra_123",
  "data_inicio": "2026-01-01",
  "data_fim": null
}
```

**Output (sem obra_id - lista todas):**
```json
{
  "success": true,
  "user_email": "user@company.com",
  "total_obras": 5,
  "obras_por_perfil": {
    "administrador": [],
    "mestre_de_obras": ["obra_123", "obra_456"],
    "encarregado": ["obra_789"],
    "funcionario": []
  },
  "all_obras": ["obra_123", "obra_456", "obra_789"]
}
```

---

### 3. Filtro Automático em Queries

**Função:** `filtrarQueriesPorObra`

**Input:**
```json
{
  "entidade": "Medicao",
  "filtro_original": { "status": "aprovada" },
  "usar_filtro_obra": true
}
```

**Output:**
```json
{
  "success": true,
  "user_email": "user@company.com",
  "entidade": "Medicao",
  "obras_acessiveis": ["obra_123", "obra_456"],
  "total_obras": 2,
  "filtro_final": {
    "status": "aprovada",
    "obra_id": { "$in": ["obra_123", "obra_456"] }
  }
}
```

**Automático adiciona:** `obra_id: {$in: [...obras do usuário]}`

---

## FLUXO DE VALIDAÇÃO

```
Usuário tenta acessar Medicão
  │
  ├─ Verificar se é admin/programador
  │  └─ SIM: Acesso irrestrito 
  │
  ├─ Buscar UsuarioObra por (user_email, obra_id)
  │  ├─ Não encontrado: BLOQUEAR (403) 
  │  ├─ data_fim expirada: BLOQUEAR (403) 
  │  └─ Válido: Continuar 
  │
  ├─ Aplicar filtro automático
  │  └─ Query = `{...filtro_original, obra_id: {$in: [...obras]}}`
  │
  └─ Retornar dados filtrados 
```

---

## TESTES IMPLEMENTADOS

**Função:** `testePermissaoPerfilObra`

### Teste 1: Validar Tabela UsuarioObra
- Registros encontrados
- Estrutura correta (campos obrigatórios)
- Ativos vs inativos
- Exemplos de vínculos

### Teste 2: Perfil ENCARREGADO
- Acesso restrito à sua obra
- Validação de vínculo
- Impossibilidade de acessar outras obras

### Teste 3: Perfil FUNCIONÁRIO
- Uma obra apenas
- Acesso exclusivo à sua obra
- Sem permissão para outras

### Teste 4: Perfil MESTRE DE OBRAS
- Múltiplas obras vinculadas
- Acesso a todas suas obras
- Gestão centralizada

### Teste 5: Filtro Automático
- Aplicação correta de obra_id
- Mescla com filtro original
- Diferentes entidades

---

## EXEMPLOS DE USO

### 1. Validar Acesso à Obra

```javascript
// Verificar se usuário pode acessar obra_123
const res = await base44.functions.invoke('validarAcessoObraUsuario', {
  obra_id: 'obra_123'
});

if (!res.data.tem_acesso) {
  console.error('Sem permissão');
  return;
}

console.log(`Perfil: ${res.data.perfil}`);
```

### 2. Listar Todas as Obras do Usuário

```javascript
// Sem passar obra_id = lista tudo
const res = await base44.functions.invoke('validarAcessoObraUsuario', {});

console.log(res.data.total_obras); // 5
console.log(res.data.obras_por_perfil.mestre_de_obras); // ["obra_123", "obra_456"]
```

### 3. Consultar com Filtro Automático

```javascript
// Aplicar filtro de obra automaticamente
const res = await base44.functions.invoke('filtrarQueriesPorObra', {
  entidade: 'Medicao',
  filtro_original: { status: 'aprovada' }
});

// res.data.filtro_final já inclui: obra_id: {$in: [...]}
const medicoes = await base44.entities.Medicao.filter(res.data.filtro_final);
```

### 4. Criar Vínculo Usuário-Obra

```javascript
// Adicionar encarregado à obra
await base44.entities.UsuarioObra.create({
  user_email: 'carlos@company.com',
  obra_id: 'obra_456',
  perfil: 'encarregado',
  data_inicio: '2026-02-20',
  ativo: true
});
```

---

## PROTEÇÕES IMPLEMENTADAS

| Proteção | Mecanismo | Status |
|----------|-----------|--------|
| Acesso a obra não vinculada | Validação em `UsuarioObra` | |
| Expiração de acesso | Verificação de `data_fim` | |
| Query vaza dados | Filtro automático por `obra_id` | |
| Super admin sem restrição | Role=admin/programador bypass | |
| Duplicação de vínculo | Índice ÚNICO (user_email, obra_id) | |
| Auditoria completa | LogAuditoria em cada validação | |

---

## PERMISSÕES POR PERFIL

### Administrador
```
Ver todas obras
Editar todas obras
Gerenciar usuários
Acessar financeiro global
Sem restrição de obra_id
```

### Mestre de Obras
```
Ver suas obras (múltiplas)
Editar suas obras
Gerenciar equipes em suas obras
Relatórios de suas obras
Ver outras obras
Gerenciar usuários globais
```

### Encarregado
```
Ver sua(s) obra(s)
Editar sua(s) obra(s)
Gerenciar equipe local
Criar medições, custos
Ver outras obras
Gerenciar contratos
```

### Funcionário
```
Ver sua obra
Registrar apontamentos
Consultar dados da obra
Editar dados estruturais
Ver outras obras
```

---

## AUDIÇÃO COMPLETA

Todos os acessos são logados em `LogAuditoria`:

```json
{
  "function_name": "validarAcessoObraUsuario",
  "user_email": "carlos@company.com",
  "user_role": "encarregado",
  "result": "success",
  "timestamp": "2026-02-19T10:30:00Z",
  "metadata": {
    "obra_id": "obra_456",
    "tem_acesso": true,
    "perfil": "encarregado"
  }
}
```

---

## PRÓXIMOS PASSOS

- [ ] Dashboard de permissões por gestor
- [ ] Auditoria visual de acessos
- [ ] Solicitação de acesso temporário
- [ ] Renovação automática de período
- [ ] Alertas de acesso expirado
- [ ] Integração com RBAC granular

---

## RESUMO TÉCNICO

| Item | Detalhes |
|------|----------|
| **Entidade Principal** | UsuarioObra |
| **Campos Críticos** | user_email, obra_id, perfil |
| **Índices** | (user_email, obra_id) ÚNICO |
| **Validações** | 2 funções (validar + filtrar) |
| **Automação** | Filtro em todas as queries |
| **Auditoria** | LogAuditoria + metadata |
| **Testes** | 5 testes validados |

---

**Status:** COMPLETO  
**Segurança:** VALIDADA  
**Auditoria:** IMPLEMENTADA  
**Testes:** PASSANDO