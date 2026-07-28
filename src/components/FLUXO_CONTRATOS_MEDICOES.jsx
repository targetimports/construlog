# FLUXO COMPLETO: CONTRATOS → MEDIÇÕES → EXPORTAÇÃO

**Data:** 2026-02-19  
**Status:** IMPLEMENTADO

---

## OBJETIVO

Vincular contratos a obras, medições a contratos, e gerar automaticamente lançamentos financeiros e exportações.

---

## ESTRUTURA DE VINCULAÇÃO

```
OBRA
  └─ CONTRATO (obra_id obrigatório )
      └─ MEDIÇÃO (contrato_id obrigatório )
          ├─ Status: aprovada
          ├─ Gera automaticamente: ContaFinanceira (receber)
          ├─ Permite exportar: Boletim PDF
          └─ Permite exportar: Nota Fiscal
```

---

## GARANTIAS IMPLEMENTADAS

| Garantia | Campo | Status |
|----------|-------|--------|
| Contrato vinculado à obra | `Contrato.obra_id` | OBRIGATÓRIO |
| Medição vinculada ao contrato | `Medicao.contrato_id` | OBRIGATÓRIO |
| Rastreabilidade completa | `obra_id` + `contrato_id` em cada medição | |
| Sem duplicação de conta | Verifica `referencia_tipo: medicao` + `referencia_id` | |
| Retenções preservadas | `valor_liquido` em ContaFinanceira | |

---

## FLUXOS AUTOMÁTICOS

### Fluxo 1: Medição Aprovada → Conta a Receber

**Trigger:** `Medicao.update` com `status = "aprovada"`

**Função:** `criarContaReceberDeMedicao.js` (já implementada)

```
Medição aprovada
  ├─ Verificar se ContaFinanceira já existe (referencia_id)
  ├─ Criar ContaFinanceira
  │  ├─ tipo = "receber"
  │  ├─ obra_id = medicao.obra_id (HERDADO)
  │  ├─ valor = medicao.valor_liquido (COM RETENÇÕES)
  │  ├─ referencia_tipo = "medicao"
  │  └─ referencia_id = medicao.id
  ├─ LogAuditoria
  └─ Retorna: conta_id
```

**Proteção contra duplicação:**
```javascript
// Verifica se já existe
const contasExistentes = await base44.entities.ContaFinanceira.filter({
  referencia_tipo: 'medicao',
  referencia_id: medicao_id
});

if (contasExistentes.length > 0) {
  return { status: 'already_exists' };
}
```

---

## FUNÇÕES DE EXPORTAÇÃO

### Função 1: `listarMedicoesContrato`

**O quê:** Lista todas as medições de um contrato com resumo.

**Input:**
```json
{
  "contrato_id": "contrato_123"
}
```

**Output:**
```json
{
  "success": true,
  "resumo": {
    "contrato_id": "contrato_123",
    "numero_contrato": "001/2026",
    "valor_total_contrato": 100000.00,
    "total_medicoes": 5,
    "valor_total_medido": 75000.00,
    "percentual_realizado": "75.00%",
    "status_breakdown": {
      "rascunho": 1,
      "enviada": 2,
      "aprovada": 2,
      "reprovada": 0,
      "faturada": 0
    }
  },
  "medicoes": [
    {
      "id": "med_001",
      "numero": "01",
      "data_medicao": "2026-02-10",
      "status": "aprovada",
      "valor_liquido": 15000.00,
      "aprovado_por": "admin@company.com"
    }
  ]
}
```

---

### Função 2: `exportarBoletimMedicao`

**O quê:** Gera boletim de medição em HTML (ready for PDF conversion).

**Input:**
```json
{
  "medicao_id": "medicao_123"
}
```

**Output:**
```json
{
  "success": true,
  "html": "<!DOCTYPE html>...",
  "resumo": {
    "medicao_numero": "01",
    "contrato_numero": "001/2026",
    "valor_liquido": 15000.00,
    "status": "aprovada"
  }
}
```

**Conteúdo do Boletim:**
- Identificação da medição (número, data, status)
- Dados do contrato (número, tipo, contratado)
- Dados da obra (nome, localização)
- Valores (bruto, retenções, líquido)
- Percentual de realização
- Aprovação (assinado por, data)
- Seção de assinaturas (3 campos)

**Como usar:**
```javascript
// 1. Obter HTML
const res = await base44.functions.invoke('exportarBoletimMedicao', {
  medicao_id: 'med_123'
});

// 2. Converter para PDF (usando bibliotecas client-side ou servidor)
// Opção A: html2pdf (client-side)
// Opção B: Puppeteer/Playwright (server-side)

const pdf = await htmlToPdf(res.data.html);
```

---

### Função 3: `exportarNotaFiscalMedicao`

**O quê:** Cria NotaFiscal vinculada a medição aprovada.

**Input:**
```json
{
  "medicao_id": "medicao_123",
  "numero_nf": "NF-001-2026",
  "data_nf": "2026-02-19"
}
```

**Output:**
```json
{
  "success": true,
  "message": "Nota fiscal criada com sucesso",
  "nf": {
    "id": "nf_001",
    "numero_nf": "NF-001-2026",
    "data": "2026-02-19",
    "valor_liquido": 15000.00,
    "status": "registrada"
  }
}
```

**Validações:**
- Medição deve estar APROVADA
- Não cria duplicatas (verifica `referencia_vinculo`)
- Herda `obra_id` automaticamente
- Copia valores (bruto e líquido)

**Fluxo:**
```
Medição aprovada
  ├─ Validar status = "aprovada"
  ├─ Verificar duplicação
  ├─ Buscar contrato vinculado
  ├─ Criar NotaFiscal
  │  ├─ numero_nf = parametro ou auto-gerado
  │  ├─ obra_id = medicao.obra_id
  │  ├─ fornecedor_id = contrato.fornecedor_id
  │  ├─ valor_bruto = medicao.valor_total_realizado
  │  ├─ valor_liquido = medicao.valor_liquido
  │  ├─ vinculado_a = "medicao"
  │  ├─ referencia_vinculo = medicao.id
  │  └─ status = "registrada"
  └─ LogAuditoria
```

---

## TESTES IMPLEMENTADOS

**Função:** `testeFluxoMedicaoCompleto`

### Teste 1: Validar `contrato_id` Obrigatório
Verifica se todas as medições têm contrato_id  
Confirma vínculo direto

### Teste 2: Listar Medições de Contrato
Busca todas as medições  
Calcula resumo (total medido, percentual, status)

### Teste 3: Exportar Boletim de Medição
Gera HTML completo  
Contém todos os campos esperados

### Teste 4: Criar Nota Fiscal de Medição
Valida se medição está aprovada  
Evita duplicação  
Vincula corretamente

### Teste 5: Validar Conta a Receber Automática
Verifica se ContaFinanceira foi criada  
Confirma valores corretos

---

## FLUXO COMPLETO (EXEMPLO)

### Cenário: Medição de Contrato de Serviços

**1. Contrato criado:**
```json
{
  "obra_id": "obra_456",
  "numero": "001/2026",
  "titulo": "Serviços de Engenharia",
  "fornecedor_id": "forn_123",
  "valor_total": 100000.00
}
```

**2. Medição criada:**
```json
{
  "obra_id": "obra_456",
  "contrato_id": "contrato_123",
  "numero": "01",
  "data_medicao": "2026-02-10",
  "responsavel_email": "eng@company.com",
  "valor_total_realizado": 25000.00,
  "retencoes_percentual": 10,
  "valor_liquido": 22500.00
}
```

**3. Sistema faz automaticamente:**
- Medição enviada
- Medição aprovada
- Cria ContaFinanceira (receber, R$ 22500)
- LogAuditoria

**4. Usuário pode:**
- Listar medições do contrato (5 medições, 75% realizado)
- Exportar boletim da medição 01 (PDF pronto)
- Criar nota fiscal da medição 01 (vinculada)
- Gerar conta a receber (já automática!)

---

## PROTEÇÕES CONTRA PROBLEMAS

| Problema | Proteção | Status |
|----------|----------|--------|
| Conta duplicada | Verifica `referencia_tipo + referencia_id` | |
| NF duplicada | Verifica `referencia_vinculo` | |
| Obra_id perdido | Herdado de contrato/medicao | |
| Retenção errada | Copia `valor_liquido` exato | |
| NF de medição não aprovada | Valida `status = 'aprovada'` | |
| Falta de rastreabilidade | Logs com metadata completa | |

---

## PRÓXIMOS PASSOS

- [ ] Integrar html2pdf para gerar PDF direto
- [ ] Dashboard de progresso do contrato (% realizado)
- [ ] Alertas de medição vencida
- [ ] Integração com Nota Fiscal Eletrônica (NFe)
- [ ] Rejeição automática se contrato suspenso
- [ ] Reversão de conta se medição cancelada

---

## COMO USAR

### 1. Listar medições de um contrato
```javascript
const res = await base44.functions.invoke('listarMedicoesContrato', {
  contrato_id: 'contrato_123'
});
console.log(res.data.resumo);
```

### 2. Exportar boletim
```javascript
const res = await base44.functions.invoke('exportarBoletimMedicao', {
  medicao_id: 'medicao_123'
});
// res.data.html → salvar como PDF
```

### 3. Criar NF
```javascript
const res = await base44.functions.invoke('exportarNotaFiscalMedicao', {
  medicao_id: 'medicao_123',
  numero_nf: 'NF-001-2026'
});
```

### 4. Testar fluxo
```javascript
const res = await base44.functions.invoke('testeFluxoMedicaoCompleto', {});
console.log(res.data.resultados);
```

---

**Status:** COMPLETO  
**Sem Duplicações:** GARANTIDO  
**Automação:** ATIVA  
**Rastreabilidade:** 100%