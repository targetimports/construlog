# Como Usar o Modal de Anexação de NF (Reutilizável)

## Integração Básica

### Opção 1: Usando o Hook (RECOMENDADO)

```jsx
import { useModalNotaFiscal } from '@/components/documentos-fiscais/useModalNotaFiscal';
import { Button } from '@/components/ui/button';

export default function MinhaComponente() {
  const { abrir, fechar, Modal } = useModalNotaFiscal();

  const handleAnexarNF = () => {
    abrir(
      'CONTAS_PAGAR',      // tipo de referência
      'cp-123',            // ID do registro
      'CP-2026-001',       // nome/descrição (opcional)
      'obra-456'           // obra_id (opcional)
    );
  };

  return (
    <>
      <Button onClick={handleAnexarNF}>
        Anexar Nota Fiscal
      </Button>

      {/* Renderizar o modal */}
      <Modal 
        onSuccess={() => {
          // Callback quando NF foi vinculada com sucesso
          console.log('NF vinculada!');
        }}
      />
    </>
  );
}
```

### Opção 2: Usando o Componente Direto

```jsx
import ModalAnexarNotaFiscalUniversal from '@/components/documentos-fiscais/ModalAnexarNotaFiscalUniversal';
import { useState } from 'react';

export default function MinhaComponente() {
  const [modalAberto, setModalAberto] = useState(false);

  return (
    <>
      <Button onClick={() => setModalAberto(true)}>
        Anexar NF
      </Button>

      <ModalAnexarNotaFiscalUniversal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        referencia_tipo="CONTAS_PAGAR"
        referencia_id="cp-123"
        referencia_nome="CP-2026-001"
        obra_id="obra-456"
        onSuccess={() => {
          setModalAberto(false);
          // Recarregar dados se necessário
        }}
      />
    </>
  );
}
```

## Tipos de Referência Suportados

Os seguintes valores podem ser usados para `referencia_tipo`:

- `CONTAS_PAGAR` - Contas a Pagar
- `CONTAS_RECEBER` - Contas a Receber
- `GASTO_OBRA` - Gastos da Obra
- `COMPRA` - Compra / Requisição
- `RECEBIMENTO` - Recebimento de Material
- `CONTRATO` - Contrato
- `MEDICAO` - Medição
- `DESPESA` - Despesa
- `VIAGEM` - Viagem / Transporte
- `PARADA` - Parada de Viagem
- `OBRA` - Obra
- `LANCAMENTO` - Lançamento Financeiro
- `PEDIDO` - Pedido de Compra

## Fluxo do Modal

1. **Upload**: Usuário seleciona PDF, Imagem ou XML
2. **Análise com IA**: Clica em "Analisar com IA"
3. **Edição**: Revisa e ajusta campos sugeridos
   - Valores são recalculados automaticamente
   - Histórico de auditoria visível em abas
4. **Confirmação**: Confirma os dados da NF
5. **Vinculação**: Vincula ao registro original

## Campos Editáveis

### Tipo e Número
- **tipo**: NF, NFe, NFS, Recibo, Outro
- **numero**: Número da nota fiscal

### Identificação
- **chave_acesso**: Chave de acesso (44 dígitos)

### Dados do Emissor
- **emissor_nome**: Razão social
- **emissor_cnpj**: CNPJ (sem formatação)
- **data_emissao**: Data de emissão

### Valores
- **valor_total**: Valor total da NF
- **valor_desconto**: Desconto
- **valor_frete**: Frete
- **valor_outros**: Outros valores/acréscimos
- **valor_final_ajustado**: Calculado automaticamente (total - desconto + frete + outros)

## Auditoria

O modal exibe o histórico completo de alterações na aba "Histórico", mostrando:
- Usuário que fez a alteração
- Campo alterado
- Valor anterior → Novo valor
- Motivo da alteração
- Data/hora

## Eventos e Callbacks

### onSuccess
Chamado quando a NF foi vinculada com sucesso ao registro.

```jsx
<Modal 
  onSuccess={() => {
    // Recarregar dados
    queryClient.invalidateQueries(['contasPagar']);
  }}
/>
```

## Integração em Módulos Específicos

### Contas a Pagar
```jsx
const { abrir, Modal } = useModalNotaFiscal();

<Button onClick={() => abrir('CONTAS_PAGAR', contaPagar.id, contaPagar.numero, obra.id)}>
  Anexar NF
</Button>

<Modal onSuccess={() => refetch()} />
```

### Compras / Requisições
```jsx
const { abrir, Modal } = useModalNotaFiscal();

<Button onClick={() => abrir('COMPRA', requisicao.id, requisicao.numero, obra.id)}>
  Anexar NF
</Button>

<Modal onSuccess={() => refetch()} />
```

### Recebimentos
```jsx
const { abrir, Modal } = useModalNotaFiscal();

<Button onClick={() => abrir('RECEBIMENTO', recebimento.id, recebimento.numero, obra.id)}>
  Anexar NF
</Button>

<Modal onSuccess={() => refetch()} />
```

## Notas Importantes

- O modal cria automaticamente um registro `NotaFiscal` ao fazer upload
- A IA sugere valores baseada na análise do documento
- Todos os campos editados geram entradas de auditoria automáticas
- O valor final é recalculado automaticamente quando valores mudam
- A vinculação é idempotente (não cria duplicatas)