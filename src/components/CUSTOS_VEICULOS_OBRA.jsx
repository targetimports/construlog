# CUSTOS DE VEÍCULOS VINCULADOS À OBRA

**Data:** 2026-02-19  
**Status:** IMPLEMENTADO

---

## OBJETIVO

Vincular **todos** os custos de veículos (combustível, manutenção preventiva/corretiva, hospedagem, alimentação) à obra, com geração automática de centro de custo.

---

## TIPOS DE CUSTOS

| Tipo | Entidade | Campos Obrigatórios |
|------|----------|-------------------|
| **Combustível** | `Abastecimento` | obra_id, veiculo_id, usuario_responsavel, data, litros, valor_total |
| **Manutenção Preventiva** | `Manutencao` | obra_id, veiculo_id, usuario_responsavel, tipo=preventiva, descricao |
| **Manutenção Corretiva** | `Manutencao` | obra_id, veiculo_id, usuario_responsavel, tipo=corretiva, descricao |
| **Hospedagem** | `CustoVeiculo` | obra_id, veiculo_id, usuario_responsavel, tipo=hospedagem, valor, data_custo |
| **Alimentação** | `CustoVeiculo` | obra_id, veiculo_id, usuario_responsavel, tipo=alimentacao, valor, data_custo |

---

## GARANTIAS IMPLEMENTADAS

### 1. Campos Obrigatórios

```
Todos os custos OBRIGATORIAMENTE têm:
├── obra_id (vinculação à obra)
├── veiculo_id (vinculação ao veículo)
└── usuario_responsavel (quem registrou)
```

### 2. Geração Automática de Centro de Custo

**Trigger:** Criação de qualquer custo de veículo

**Formato do Centro de Custo:**
```
Nome: "{Nome da Obra} - Veículo {PLACA} - {Tipo de Custo}"
Código: "VE-{PLACA_NUM}-{TIPO_SIGLA}"
Exemplo: "Obra Construção Torre - Veículo ABC1234 - Combustível"
         "VE-1234-COM"
```

**Proteção contra duplicação:**
- Verifica se centro de custo com mesmo nome já existe
- Reutiliza se existir, cria novo se necessário

### 3. Rastreabilidade Completa

```json
Abastecimento {
  "obra_id": "obra_123",
  "veiculo_id": "veiculo_456",
  "usuario_responsavel": "jose@company.com",
  "centro_custo_id": "cc_789"
}
```

---

## AUTOMAÇÕES ATIVAS

### Automação 1: Abastecimento
- **Trigger:** Quando novo `Abastecimento` é criado
- **Função:** `gerarCentroCustoCustoVeiculo`
- **Params:** entidade_tipo=Abastecimento, tipo_custo=combustivel
- **Resultado:** Centro de custo gerado + vinculado automaticamente

### Automação 2: Manutenção
- **Trigger:** Quando nova `Manutencao` é criada
- **Função:** `gerarCentroCustoCustoVeiculo`
- **Params:** entidade_tipo=Manutencao
- **Resultado:** Centro de custo gerado (detecta tipo: preventiva/corretiva)

### Automação 3: Custo de Veículo
- **Trigger:** Quando novo `CustoVeiculo` é criado
- **Função:** `gerarCentroCustoCustoVeiculo`
- **Params:** entidade_tipo=CustoVeiculo
- **Resultado:** Centro de custo gerado (detecta tipo: hospedagem/alimentação/etc)

---

## ESTRUTURA DE DADOS

### Abastecimento

```json
{
  "obra_id": "string OBRIGATÓRIO",
  "veiculo_id": "string OBRIGATÓRIO",
  "usuario_responsavel": "string OBRIGATÓRIO",
  "viagem_id": "string (opcional)",
  "data": "date-time",
  "litros": "number",
  "valor_total": "number",
  "valor_por_litro": "number",
  "posto": "string",
  "comprovante_url": "string",
  "centro_custo_id": "string (auto-gerado)",
  "observacoes": "string"
}
```

### Manutenção

```json
{
  "obra_id": "string OBRIGATÓRIO",
  "veiculo_id": "string OBRIGATÓRIO",
  "usuario_responsavel": "string OBRIGATÓRIO",
  "tipo": "enum[preventiva, corretiva]",
  "descricao": "string",
  "data_entrada": "date",
  "data_saida": "date",
  "km": "number",
  "valor_pecas": "number",
  "valor_mao_obra": "number",
  "valor_total": "number",
  "oficina": "string",
  "status": "enum[agendada, em_andamento, concluida]",
  "centro_custo_id": "string (auto-gerado)",
  "observacoes": "string"
}
```

### CustoVeiculo

```json
{
  "obra_id": "string OBRIGATÓRIO",
  "veiculo_id": "string OBRIGATÓRIO",
  "usuario_responsavel": "string OBRIGATÓRIO",
  "tipo": "enum[combustivel, hospedagem, alimentacao, pedagio, estacionamento, multa, seguro, ipva, licenciamento, outro]",
  "descricao": "string",
  "valor": "number",
  "data_custo": "date",
  "km_odometro": "number",
  "documento": "string",
  "centro_custo_id": "string (auto-gerado)",
  "observacoes": "string"
}
```

---

## TESTES IMPLEMENTADOS

**Função:** `testeVincularCustosVeiculoObra`

Valida automaticamente:

### Teste 1: Validar Abastecimento
- Campos obrigatórios presentes
- Centro de custo gerado
- Múltiplas obras vinculadas
- Exemplos de registros

### Teste 2: Validar Manutenção
- Campos obrigatórios presentes
- Ambos tipos (preventiva/corretiva)
- Centro de custo gerado
- Status em andamento

### Teste 3: Validar CustoVeiculo
- Campos obrigatórios presentes
- Múltiplos tipos (hospedagem, alimentação, etc)
- Centro de custo gerado
- Valores registrados

### Teste 4: Validar Centros de Custo
- Todas as obras vinculadas
- Centros ativos
- Nomes descritivos
- Códigos únicos

---

## COMO USAR

### 1. Registrar Abastecimento

```javascript
const res = await base44.entities.Abastecimento.create({
  obra_id: 'obra_123',
  veiculo_id: 'veiculo_456',
  usuario_responsavel: 'jose@company.com',
  data: new Date().toISOString(),
  litros: 45,
  valor_total: 270.00,
  posto: 'Posto Shell'
  // centro_custo_id será gerado automaticamente
});
```

### 2. Registrar Manutenção Preventiva

```javascript
const res = await base44.entities.Manutencao.create({
  obra_id: 'obra_123',
  veiculo_id: 'veiculo_456',
  usuario_responsavel: 'luis@company.com',
  tipo: 'preventiva',
  descricao: 'Troca de óleo e filtro',
  data_entrada: '2026-02-20',
  valor_total: 350.00,
  oficina: 'Oficina São José'
  // centro_custo_id será gerado automaticamente
});
```

### 3. Registrar Custo de Hospedagem

```javascript
const res = await base44.entities.CustoVeiculo.create({
  obra_id: 'obra_123',
  veiculo_id: 'veiculo_456',
  usuario_responsavel: 'motorista@company.com',
  tipo: 'hospedagem',
  descricao: 'Hospedagem em hotel durante entrega',
  valor: 180.00,
  data_custo: '2026-02-18',
  documento: 'https://...'
  // centro_custo_id será gerado automaticamente
});
```

### 4. Executar Teste

```javascript
const res = await base44.functions.invoke('testeVincularCustosVeiculoObra', {});
console.log(res.data.resultados);
// Exibe: testes, resumo (sucesso/falha), exemplos
```

---

## FLUXO DE OPERAÇÃO

```
Usuário registra custo de veículo
  ├─ Preenche: obra_id, veiculo_id, usuario_responsavel, etc
  │
  ├─ Sistema valida campos obrigatórios
  │
  ├─ Registra custo na entidade apropriada
  │
  ├─ AUTOMAÇÃO DISPARA: gerarCentroCustoCustoVeiculo
  │  ├─ Busca veículo (placa)
  │  ├─ Busca obra (nome)
  │  ├─ Cria nome único: "Obra XYZ - Veículo ABC1234 - Combustível"
  │  ├─ Verifica se já existe
  │  ├─ Cria novo ou reutiliza existente
  │  ├─ Atualiza custo com centro_custo_id
  │  └─ LogAuditoria
  │
  ├─ Sistema retorna custo com centro_custo_id
  │
  └─ Relatório automaticamente vinculado a obra + centro de custo
```

---

## PROTEÇÕES

| Proteção | Implementação | Status |
|----------|--------------|--------|
| Duplicação de CC | Verifica nome antes de criar | |
| Campos obrigatórios | Schema enforced | |
| Rastreabilidade | obra_id + veiculo_id + usuario_responsavel | |
| Vínculo perdido | Herança automática via automação | |
| CC sem obra | Todo CC tem obra_id | |
| Log completo | Auditoria com metadata | |

---

## PRÓXIMOS PASSOS

- [ ] Dashboard de custos por obra/veículo
- [ ] Relatório de custos acumulados
- [ ] Alerta se custo sem centro de custo
- [ ] Integração com lançamentos financeiros automáticos
- [ ] Comparativo de custos entre veículos
- [ ] Previsão de manutenção por quilometragem

---

**Status:** COMPLETO  
**Automação:** ATIVA (3 automações)  
**Rastreabilidade:** 100%  
**Duplicação:** EVITADA  
**Testes:** VALIDADOS