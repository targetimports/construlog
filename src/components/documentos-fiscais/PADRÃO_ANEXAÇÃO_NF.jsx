# Padrão Global de Anexação de Nota Fiscal

## Objetivo
Todo lançamento de gasto, pagamento ou custo no sistema deve suportar anexação de NF com:
- Upload de arquivo (PDF/imagem)
- Análise automática com IA
- Edição manual obrigatória
- Auditoria completa (antes/depois/usuário/data)

---

## Arquitetura

### Tabelas (Entidades)
- **NotaFiscal** — documentos fiscais
- **NotaFiscalVinculo** — vincula NF a qualquer módulo (PEDIDO, RECEBIMENTO, VIAGEM, PARADA, OBRA, CONTAS_PAGAR, etc)
- **NotaFiscalAuditoria** — histórico de alterações

### Componentes Reutilizáveis

#### 1. Modal Genérico
```jsx
import ModalAnexarNFGenerico from '@/components/documentos-fiscais/ModalAnexarNFGenerico';

<ModalAnexarNFGenerico
  open={open}
  referencia_tipo="PEDIDO"        // Tipo de entidade
  referencia_id={pedidoId}        // ID da entidade
  referencia_nome="PC-2026-001"   // Nome para exibição
  onClose={() => setOpen(false)}
  onSuccess={() => refetch()}     // Callback após sucesso
/>
```

#### 2. Hook Simplificado
```jsx
import { useAnexarNF } from '@/components/documentos-fiscais/useAnexarNF';

const { Modal, abrir } = useAnexarNF({
  referencia_tipo: 'PEDIDO',
  referencia_id: pedidoId,
  referencia_nome: 'PC-2026-001',
  onSuccess: () => refetch(),
});

return (
  <>
    <Button onClick={abrir}>Anexar NF</Button>
    {Modal}
  </>
);
```

---

## Fluxo de Uso

### Step 1: Upload
- Usuário seleciona PDF/imagem
- Sistema faz upload

### Step 2: Análise IA
- `processarNotaFiscalComIA()` extrai:
  - Número
  - Chave de acesso
  - Emissor
  - Data
  - Valores

### Step 3: Confirmação (obrigatória)
- Usuário vê dados sugeridos
- **PODE EDITAR TUDO**
- Usuário confirma

### Step 4: Salvamento + Auditoria
- NF criada em `NotaFiscal`
- Vinculada em `NotaFiscalVinculo` (referencia_tipo + referencia_id)
- Auditoria registrada em `NotaFiscalAuditoria`

---

## Integração em Módulos

### Exemplo: Pedido de Compra

```jsx
// Em PCModal.jsx ou DetalhesPC.jsx
import { useAnexarNF } from '@/components/documentos-fiscais/useAnexarNF';

export default function DetalhesPC({ pc_id }) {
  const { Modal, abrir } = useAnexarNF({
    referencia_tipo: 'PEDIDO',
    referencia_id: pc_id,
    referencia_nome: pc?.numero,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pc-nfs', pc_id] }),
  });

  return (
    <>
      <Button onClick={abrir} variant="outline" gap-2>
        <Paperclip className="w-4 h-4" />
        Anexar NF
      </Button>
      {Modal}
    </>
  );
}
```

### Exemplo: Recebimento

```jsx
import { useAnexarNF } from '@/components/documentos-fiscais/useAnexarNF';

export default function RecebimentoModal({ recebimento_id }) {
  const { Modal, abrir } = useAnexarNF({
    referencia_tipo: 'RECEBIMENTO',
    referencia_id: recebimento_id,
    referencia_nome: `Receb. ${recebimento_id}`,
    onSuccess: () => refetch(),
  });

  return (
    <>
      <Button onClick={abrir}>Anexar NF</Button>
      {Modal}
    </>
  );
}
```

### Exemplo: Viagem/Romaneio

```jsx
const { Modal, abrir } = useAnexarNF({
  referencia_tipo: 'VIAGEM',
  referencia_id: viagem_id,
  referencia_nome: `Viagem ${viagem_numero}`,
  onSuccess: () => refetch(),
});
```

---

## Tipos de Referência (NotaFiscalVinculo)

Ao anexar NF, defina `referencia_tipo` conforme a entidade:

| Tipo | Módulo | Exemplo |
|------|--------|---------|
| PEDIDO | Suprimentos | Pedido de Compra |
| RECEBIMENTO | Estoque | Recebimento de Material |
| VIAGEM | Logística | Viagem/Romaneio |
| PARADA | Logística | Parada de Viagem |
| OBRA | Obras | Obra (custos diretos) |
| CONTAS_PAGAR | Financeiro | Conta a Pagar |
| CONTRATO | Contratos | Contrato |
| MEDICAO | Medições | Medição de Obra |
| LANCAMENTO | Financeiro | Lançamento genérico |

---

## Auditoria

Toda alteração é registrada em `NotaFiscalAuditoria`:

```json
{
  "documento_fiscal_id": "nf-123",
  "user_id": "user@email.com",
  "user_nome": "João Silva",
  "campo_alterado": "valor_total",
  "valor_antigo": "5000.00",
  "valor_novo": "5100.00",
  "motivo": "Correção de valores",
  "acao": "EDICAO",
  "created_date": "2026-02-22T10:30:00Z"
}
```

---

## Checklist de Integração

Para cada módulo que precisar de NF:

- [ ] Importar `useAnexarNF` do hook
- [ ] Definir `referencia_tipo` correto
- [ ] Passar `referencia_id` e `referencia_nome`
- [ ] Adicionar callback `onSuccess` para refetch
- [ ] Colocar botão "Anexar NF" na UI
- [ ] Testar upload, análise IA e edição manual
- [ ] Verificar auditoria em `NotaFiscalAuditoria`

---

## Modelos de Componentes

### Botão Simples com Ícone
```jsx
<Button onClick={abrir} variant="outline" size="sm" className="gap-2">
  <Paperclip className="w-4 h-4" />
  Anexar NF
</Button>
```

### Botão no Card
```jsx
<Button 
  onClick={abrir} 
  className="w-full" 
  disabled={!podeAnexarNF}
>
  Anexar Nota Fiscal
</Button>
```

### Card com Lista de NFs
```jsx
<div className="space-y-2">
  <h4 className="font-semibold">Notas Fiscais Anexadas</h4>
  {nfs.map(nf => (
    <div key={nf.id} className="flex items-center justify-between p-2 border rounded">
      <span>{nf.numero}</span>
      <Button onClick={() => abrir()} size="sm">...</Button>
    </div>
  ))}
  <Button onClick={abrir} variant="outline" className="w-full">
    + Anexar Nova NF
  </Button>
</div>
```

---

## Funções Backend Necessárias

- `processarNotaFiscalComIA()` — extrai dados da NF com IA
- `salvarNotaFiscalCompleta()` — cria NF + vinculação + auditoria
- Eventualmente: `gerarContaPagarDeNotaFiscal()`, `calcularRateioNotaFiscal()`

---

## Status da Implementação

### Pronto
- ModalAnexarNFGenerico
- useAnexarNF hook
- NotaFiscal entity
- NotaFiscalVinculo entity
- NotaFiscalAuditoria entity

### A Integrar
- Pedido de Compra
- Recebimento
- Viagem/Romaneio
- Conta a Pagar
- Conta a Receber
- Contratos
- Medições
- Lançamentos Financeiros

### A Implementar
- Listagem de NFs anexadas por entidade
- Dashboard de NFs não confirmadas
- Relatório de NFs por módulo