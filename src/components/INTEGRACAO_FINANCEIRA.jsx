# INTEGRAÇÃO AUTOMÁTICA DE LANÇAMENTOS FINANCEIROS

**Data:** 2026-02-19  
**Status:** IMPLEMENTADO

---

## FLUXOS IMPLEMENTADOS

### 1Requisição de Compra Aprovada → Conta a Pagar

**Trigger:** `RequisicaoCompra.update` com `status_aprovacao = "aprovada"`

**Função:** `criarContaPagarDeRequisicao`

**Fluxo:**
```
RequisicaoCompra (aprovada)
  ├─ Verificar se Conta a Pagar já existe
  ├─ Criar ContaFinanceira (tipo=pagar)
  │  ├─ valor = requisicao.valor_total_estimado
  │  ├─ data_vencimento = +30 dias
  │  ├─ referencia_tipo = "requisicao"
  │  ├─ referencia_id = requisicao_id
  │  └─ obra_id = HERDADO DE requisicao.obra_id 
  └─ LogAuditoria (origem + metadata)
```

**Proteções:**
- Evita duplicação (verifica se já existe)
- Herda `obra_id` automaticamente
- Logs com rastreabilidade completa
- Status inicial = "pendente"

---

### 2Medição de Contrato Aprovada → Conta a Receber

**Trigger:** `Medicao.update` com `status = "aprovada"`

**Função:** `criarContaReceberDeMedicao`

**Fluxo:**
```
Medicao (aprovada)
  ├─ Verificar se Conta a Receber já existe
  ├─ Criar ContaFinanceira (tipo=receber)
  │  ├─ valor = medicao.valor_liquido || medicao.valor_total_realizado
  │  ├─ data_vencimento = +30 dias
  │  ├─ referencia_tipo = "medicao"
  │  ├─ referencia_id = medicao_id
  │  └─ obra_id = HERDADO DE medicao.obra_id 
  └─ LogAuditoria (origem + metadata)
```

**Proteções:**
- Evita duplicação (verifica se já existe)
- Usa valor líquido (com retenções)
- Herda `obra_id` automaticamente
- Logs com rastreabilidade completa
- Status inicial = "pendente"

---

## AUTOMAÇÕES CRIADAS

### Automação 1: Medição Aprovada
- **ID:** `699793d9aa73af03008d5181`
- **Entity:** `Medicao`
- **Evento:** `update`
- **Função:** `criarContaReceberDeMedicao`
- **Status:** ATIVA

### Automação 2: Requisição Aprovada
- **ID:** `699793dbaa73af03008d5185`
- **Entity:** `RequisicaoCompra`
- **Evento:** `update`
- **Função:** `criarContaPagarDeRequisicao`
- **Status:** ATIVA

---

## CAMPOS ENVIADOS (via automação)

### Para `criarContaPagarDeRequisicao`:
```json
{
  "requisicao_id": "{entity_id}",
  "status_aprovacao": "{data.status_aprovacao}",
  "obra_id": "{data.obra_id}"
}
```

### Para `criarContaReceberDeMedicao`:
```json
{
  "medicao_id": "{entity_id}",
  "status": "{data.status}",
  "obra_id": "{data.obra_id}"
}
```

---

## LOGS CRIADOS

Ambas as funções criam `LogAuditoria` com:

```json
{
  "function_name": "criarContaPagarDeRequisicao | criarContaReceberDeMedicao",
  "user_email": "user@company.com",
  "user_role": "admin|user",
  "payload": "requisicao_id, obra_id",
  "result": "success|error",
  "timestamp": "2026-02-19T10:30:00Z",
  "metadata": {
    "conta_id": "UUID",
    "requisicao_id": "UUID",
    "medicao_id": "UUID",
    "obra_id": "UUID",
    "valor": 50000.00
  }
}
```

---

## VALIDAÇÕES

### Segurança:
- Autenticação obrigatória (user required)
- Verificação de duplicação antes de criar
- Validação de campos obrigatórios (requisicao_id, obra_id, medicao_id)

### Integridade:
- obra_id sempre herdado da entidade origem
- referencia_tipo e referencia_id preenchidos (rastreabilidade)
- Data de vencimento definida automaticamente (+30 dias)
- Status inicial = "pendente" (nunca "pago")

### Dados:
- Valor: copia de valor_total_estimado (requisição) ou valor_liquido (medição)
- Descrição: mantém contexto (título da requisição, número da medição)
- Nenhum dado existente alterado

---

## TESTE FUNCIONAL

### Cenário 1: Requisição Aprovada

1. Criar RequisicaoCompra com:
   - `titulo` = "Materiais de Construção"
   - `obra_id` = "obra_123"
   - `valor_total_estimado` = 50000
   - `status_aprovacao` = "pendente"

2. Atualizar para `status_aprovacao = "aprovada"`

3. **Resultado esperado:**
   - ContaFinanceira criada automaticamente
   - tipo = "pagar"
   - obra_id = "obra_123"
   - valor = 50000
   - referencia_id = requisicao_id
   - LogAuditoria registrado

---

### Cenário 2: Medição Aprovada

1. Criar Medicao com:
   - `numero` = "01"
   - `obra_id` = "obra_456"
   - `valor_total_realizado` = 100000
   - `valor_liquido` = 90000 (com 10% retenção)
   - `status` = "enviada"

2. Atualizar para `status = "aprovada"`

3. **Resultado esperado:**
   - ContaFinanceira criada automaticamente
   - tipo = "receber"
   - obra_id = "obra_456"
   - valor = 90000 (valor líquido!)
   - referencia_id = medicao_id
   - LogAuditoria registrado

---

### Cenário 3: Duplicação Prevenida

1. Criar Medicao e aprovar (Conta criada )

2. Atualizar Medicao novamente com `status = "aprovada"`

3. **Resultado esperado:**
   - Função retorna "already_exists"
   - Nenhuma conta duplicada
   - Nenhum erro

---

## PROTEÇÕES CONTRA PROBLEMAS

| Problema | Proteção | Status |
|----------|----------|--------|
| Conta duplicada | Verifica existência via referencia_id | OK |
| Obra_id perdido | Herdado automaticamente da origem | OK |
| Falta de auditoria | LogAuditoria criado sempre | OK |
| Usuário não autenticado | Valida user antes de processar | OK |
| Valor errado | Copia de campo específico (estimado/líquido) | OK |
| Referência perdida | referencia_tipo + referencia_id preenchidos | OK |

---

## PRÓXIMOS PASSOS

- [ ] Testar com dados reais
- [ ] Validar logs em produção
- [ ] Adicionar notificação ao usuário (Notificacao.create)
- [ ] Criar dashboard de rastreamento (origem → conta)
- [ ] Adicionar reversão automática se requisição/medição é rejeitada

---

**Implementação:** COMPLETA  
**Automações:** ATIVAS  
**Logs:** ESTRUTURADOS  
**Rastreabilidade:** 100%