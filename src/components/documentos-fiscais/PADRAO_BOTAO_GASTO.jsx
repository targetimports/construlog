# Padrão Global: Botão "Anexar NF" em Registros de Gasto

## Visão Geral

Todos os registros que representam **gastos, custos, pagamentos ou receitas** devem incluir o componente `BotaoAnexarNFGasto` para permitir anexação de nota fiscal.

## Componentes Padrão

### 1. `BotaoAnexarNFGasto`
Botão principal que:
- Exibe "Anexar NF" quando não há NF vinculada
- Mostra badge com status quando tem NF
- Permite abrir modal para edição/visualização
- Respeita permissões (desabilitado se `podeEditar=false`)

### 2. `BadgeStatusNF`
Badge que exibe:
- Status: ENVIADO | ANALISADO_IA | CONFIRMADO | CANCELADO
- Ícone e cores visuais para cada status
- Valor final ajustado (quando confirmada)

## Integração em Telas de Gasto

### Template Básico

```jsx
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function TelaDespesa() {
  const { data: despesa } = useQuery({
    queryKey: ['despesa', despesaId],
    queryFn: () => base44.entities.Despesa.list().then(d => d.find(x => x.id === despesaId)),
  });

  // Verificar se usuário pode editar (exemplo com RBAC)
  const podeEditar = user.role === 'admin' || user.role === 'gerente_financeiro';

  return (
    <div>
      {/* ... outros campos ... */}
      
      {/* Botão de Anexar NF */}
      <BotaoAnexarNFGasto
        referencia_tipo="DESPESA"
        referencia_id={despesa.id}
        referencia_nome={despesa.numero}
        obra_id={despesa.obra_id}
        podeEditar={podeEditar}
        onSuccess={() => {
          // Recarregar dados se necessário
          queryClient.invalidateQueries(['despesa']);
        }}
      />
    </div>
  );
}
```

## Casos de Uso por Módulo

### Contas a Pagar
```jsx
<BotaoAnexarNFGasto
  referencia_tipo="CONTAS_PAGAR"
  referencia_id={contaPagar.id}
  referencia_nome={contaPagar.numero}
  obra_id={contaPagar.obra_id}
  podeEditar={canEdit}
/>
```

### Compras / Requisições
```jsx
<BotaoAnexarNFGasto
  referencia_tipo="COMPRA"
  referencia_id={requisicao.id}
  referencia_nome={requisicao.numero}
  obra_id={requisicao.obra_id}
  podeEditar={canEdit}
/>
```

### Recebimentos
```jsx
<BotaoAnexarNFGasto
  referencia_tipo="RECEBIMENTO"
  referencia_id={recebimento.id}
  referencia_nome={recebimento.numero}
  obra_id={recebimento.obra_id}
  podeEditar={canEdit}
/>
```

### Despesas de Obra
```jsx
<BotaoAnexarNFGasto
  referencia_tipo="GASTO_OBRA"
  referencia_id={gasto.id}
  referencia_nome={gasto.descricao}
  obra_id={gasto.obra_id}
  podeEditar={canEdit}
/>
```

### Viagens / Transportes
```jsx
<BotaoAnexarNFGasto
  referencia_tipo="VIAGEM"
  referencia_id={viagem.id}
  referencia_nome={viagem.numero}
  obra_id={viagem.obra_id}
  podeEditar={canEdit}
/>
```

## Posicionamento na Tela

Recomendações de layout:

### Em Cards de Resumo
```
┌─────────────────────┐
│ Número: CP-2026-001 │
│ Valor: R$ 5.000,00  │
│ ┌──────────────────┐│
│ │[NF Confirmada] ││
│ │  R$ 5.000,00   ││  ← Badge + Valor
│ │ [Ver/Editar]   ││  ← Botão de ação
│ └──────────────────┘│
└─────────────────────┘
```

### Em Linhas de Tabela
```
│ CP-001 │ R$ 1.000 │ [Anexar NF] │ [Editar]
│ CP-002 │ R$ 2.000 │ [✓ Confirmada] R$ 2.000 [Ver/Editar]
```

### Em Detalhes Expandido
```
Conta a Pagar #CP-2026-001
├─ Valor: R$ 5.000,00
├─ Status: Aberta
└─ Documento Fiscal
   ├─ [Anexar NF]  ou  [✓ NF Confirmada - R$ 5.000,00] [Ver/Editar]
   └─ Auditoria...
```

## Controle de Permissões

### Sempre Visível
- Badge de status (informação)
- Histórico de auditoria
- Valor da NF confirmada

### Condicional em `podeEditar`
- Botão "Anexar NF" (desabilitado se false)
- Botão "Ver/Editar" (desabilitado se false)
- Modal de edição

### Exemplo com RBAC
```jsx
const podeEditarNF = 
  user.role === 'admin' || 
  user.role === 'gerente_financeiro' ||
  (user.role === 'usuario_obra' && despesa.obra_id === user.obra_principal?.id);

<BotaoAnexarNFGasto
  {...props}
  podeEditar={podeEditarNF}
/>
```

## Estados do Botão

### Estado 1: Sem NF
```
┌──────────────┐
│ + Anexar NF  │  ← Clicável (se podeEditar)
└──────────────┘
```

### Estado 2: Com NF (não confirmada)
```
┌──────────────────────────┐
│ [NF Enviada]           │
│ [Ver/Editar]          │  ← Clicável (se podeEditar)
└──────────────────────────┘
```

### Estado 3: Com NF Confirmada
```
┌──────────────────────────────────┐
│ [✓ NF Confirmada] R$ 2.000,00    │
│ [Ver/Editar]                  │  ← Clicável (se podeEditar)
└──────────────────────────────────┘
```

### Estado 4: Sem Permissão de Edição
```
┌──────────────────────────────────┐
│ [✓ NF Confirmada] R$ 2.000,00    │
│ Visualização apenas              │  ← Botão desabilitado
└──────────────────────────────────┘
```

## Fluxo Completo

```
┌─────────────────────────────────┐
│ Tela de Gasto (Contas a Pagar) │
└────────────┬────────────────────┘
             │
             ├─ Sem NF:
             │  └─ [+ Anexar NF] → Abre Modal
             │
             ├─ Com NF (ENVIADO):
             │  ├─ Mostra: [NF Enviada]
             │  └─ Clique: Abre Modal (editar/confirmar)
             │
             ├─ Com NF (ANALISADO_IA):
             │  ├─ Mostra: [Analisada (IA)]
             │  └─ Clique: Abre Modal (revisar/confirmar)
             │
             └─ Com NF (CONFIRMADO):
                ├─ Mostra: [✓ NF Confirmada] R$ 5.000,00
                └─ Clique: Abre Modal (visualizar/auditar)
```

## Props e Tipos

### BotaoAnexarNFGasto

```typescript
interface BotaoAnexarNFGastoProps {
  // Identificação do registro
  referencia_tipo: string; // CONTAS_PAGAR | COMPRA | RECEBIMENTO | ...
  referencia_id: string;   // ID do registro
  referencia_nome?: string;// Para exibição (número, descrição, etc)
  obra_id?: string;        // Obra associada (opcional)
  
  // Permissões
  podeEditar?: boolean;    // Se false, modo apenas leitura
  
  // Callbacks
  onSuccess?: () => void;  // Chamado quando NF é vinculada com sucesso
}
```

### BadgeStatusNF

```typescript
interface BadgeStatusNFProps {
  status: 'ENVIADO' | 'ANALISADO_IA' | 'CONFIRMADO' | 'CANCELADO';
  valor_final_ajustado?: number;
  showValor?: boolean; // Mostrar valor (padrão: true)
}
```

## Boas Práticas

1. **Sempre incluir `obra_id`** para rastreabilidade
2. **Verificar permissões antes de renderizar** botões de edição
3. **Usar `onSuccess` para recarregar dados** se necessário
4. **Manter estado sincronizado** entre tela e modal
5. **Respeitar fluxo de aprovação** da sua organização

## Checklist de Implementação

- [ ] Importar `BotaoAnexarNFGasto`
- [ ] Determinar `referencia_tipo` correto
- [ ] Passar `referencia_id` do registro
- [ ] Implementar lógica de `podeEditar`
- [ ] Adicionar `onSuccess` para sincronização
- [ ] Testar em tela de visualização e edição
- [ ] Testar sem permissão (desabilitado)
- [ ] Validar responsividade