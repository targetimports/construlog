# TESTE DE ACEITE - INTEGRAÇÃO NF COMPLETA (PARTE 12/12)

## Cenários de Teste Obrigatórios

### CENÁRIO 1: CONTAS A PAGAR + NF + IA + EDIÇÃO + AUDITORIA

**Fluxo:**
1. Abrir **Contas a Pagar** → criar nova conta
2. Preencher: Fornecedor, Descrição, Data Vencimento
3. Clicar em **"Anexar NF"**
4. Upload de arquivo (PDF/Imagem/XML)
5. IA analisa e extrai valores
6. **Revisar valores sugeridos** (podem estar errados)
7. **Editar se necessário** (apenas Financeiro/Diretoria/Admin)
8. Se não tiver permissão → campo bloqueado com 
9. Clicar **"Confirmar e Anexar"**
10. **Verificar na auditoria:**
    - Campo alterado: sim/não
    - Valor anterior vs novo
    - Usuário que fez alteração
    - Data/hora
    - Motivo (se aplicável)
11. Valor `valor_final_ajustado` fica salvo na NF
12. Sugerir esse valor para preencher a conta (opcional)
13. Confirmar conta com valor da NF

**Validações:**
- [ ] IA conseguiu extrair valores corretamente
- [ ] Usuário conseguiu editar valores
- [ ] Se sem permissão, campos ficam bloqueados
- [ ] Auditoria registrou as alterações
- [ ] `valor_final_ajustado` está correto (total - desconto + frete + outros)
- [ ] Histórico de alterações mostra quem mudou e quando

---

### CENÁRIO 2: GASTO DA OBRA + NF + CUSTO AUTOMÁTICO

**Fluxo:**
1. Abrir **Obra > Custos/Despesas** (ex: Alimentação)
2. Clicar em **"Adicionar Custo"** ou **"Anexar NF"**
3. Upload de NF
4. IA analisa (ou usuário preenche manualmente)
5. **Confirmar NF** → valor_final_ajustado extraído
6. Sistema **sugere preencher custo com esse valor**
7. Usuário pode:
   - Aceitar o valor sugerido ✓
   - Editar antes de confirmar ✓
   - Rejeitar e digitar outro valor ✓
8. Confirmar gasto
9. Verificar que:
   - Gasto foi criado com valor correto
   - NF vinculada com `referencia_tipo='GASTO_OBRA'`
   - `obra_id` foi preenchido
   - Auditoria registrou

**Validações:**
- [ ] NF foi vinculada corretamente (GASTO_OBRA + obra_id)
- [ ] Custo foi criado com valor_final_ajustado
- [ ] Usuário conseguiu editar antes de confirmar
- [ ] Histórico mostra tudo

---

### CENÁRIO 3: RECEBIMENTO DE COMPRA + NF → CONTA A PAGAR

**Fluxo:**
1. Abrir **Suprimentos > Recebimentos**
2. Criar novo recebimento de um pedido
3. Preencher: Pedido, Local, Data
4. Clicar em **"Anexar NF"**
5. Upload da NF (deve ser mesma NF do pedido se possível)
6. IA extrai valores (ou usuário preenche)
7. **Confirmar NF**
8. Sistema detecta: "NF confirmada com valor R$ X,XX"
9. Oferecer: **"Gerar Conta a Pagar com esse valor?"**
10. Usuário clica **"Gerar Conta a Pagar"**
11. Conta é criada com:
    - `valor_total = valor_final_ajustado` da NF
    - Fornecedor (extraído da NF ou do pedido)
    - Status: PENDENTE
    - Vinculada à NF
12. Verificar auditoria

**Validações:**
- [ ] Recebimento foi criado
- [ ] NF foi anexada corretamente
- [ ] Conta a Pagar foi gerada com valor certo
- [ ] Conta está vinculada à NF
- [ ] Auditoria registrou tudo

---

### CENÁRIO 4: AUDITORIA COMPLETA

**Testes diretos na tabela `NotaFiscalAuditoria`:**

1. **Campo `valor_total` alterado:**
   - [ ] Registro de auditoria criado
   - [ ] `campo_alterado = 'valor_total'`
   - [ ] `valor_antigo` e `valor_novo` preenchidos
   - [ ] `user_id` = email do usuário
   - [ ] `user_nome` preenchido
   - [ ] `acao = 'EDICAO'`
   - [ ] `created_date` correto

2. **Campo `valor_desconto` alterado:**
   - [ ] Mesmo registrado

3. **Campo `valor_frete` alterado:**
   - [ ] Mesmo registrado

4. **Campo `valor_outros` alterado:**
   - [ ] Mesmo registrado

5. **Painel "Histórico de Alterações":**
   - [ ] Mostra todas as alterações
   - [ ] Agrupa por data
   - [ ] Mostra quem fez
   - [ ] Mostra valores antes/depois
   - [ ] Expandível/Retrátil

---

### CENÁRIO 5: FALLBACK MANUAL (IA FALHA)

**Fluxo:**
1. Abrir modal de anexar NF
2. Upload de arquivo ruim/ilegível
3. IA falha na extração
4. Sistema exibe: "Não consegui extrair valores com certeza"
5. **Usuário consegue preencher manualmente:**
   - [ ] Campo Número
   - [ ] Campo Chave Acesso
   - [ ] Campo Data Emissão
   - [ ] Campo Emissor
   - [ ] Campo Valor Total
   - [ ] Campo Desconto
   - [ ] Campo Frete
   - [ ] Campo Outros
6. Usuário clica **"Confirmar"**
7. NF é criada e confirmada mesmo com IA falhando
8. Auditoria mostra: `acao = 'CRIACAO'` (não alteração)

**Validações:**
- [ ] Usuário consegue confirmar sem IA
- [ ] Todos os campos obrigatórios foram preenchidos
- [ ] NF foi criada com status CONFIRMADO
- [ ] Auditoria registrou como CRIACAO

---

## Teste Rápido (5 min)

Execute esta sequência mínima:

1. **Contas a Pagar:**
   - Criar conta → Anexar NF → IA lê → Editar valor → Confirmar
   - Verificar auditoria tem o registro

2. **Gasto da Obra:**
   - Alimentação → Anexar NF → Confirmar → Criar gasto com valor_final_ajustado
   - Verificar auditoria

3. **Permissões:**
   - Fazer login com usuário SEM role financeiro
   - Tentar editar valor em NF → deve ser bloqueado
   - Verificar ícone nos campos

4. **Fallback:**
   - Fazer upload de imagem ruim
   - Preencher manualmente
   - Confirmar sem IA → deve funcionar

---

## Checklist Final

- [ ] IA consegue extrair valores (cenário feliz)
- [ ] Usuário consegue editar (se tiver permissão)
- [ ] Auditoria registra TODAS as edições
- [ ] Sem permissão = campos bloqueados
- [ ] Histórico de alterações funciona
- [ ] NF vinculada corretamente (referencia_tipo + obra_id)
- [ ] Contas a Pagar usa valor_final_ajustado
- [ ] Recebimento gera Conta a Pagar com valor certo
- [ ] Fallback manual funciona mesmo com IA falhando
- [ ] Tudo está em português

---

## URLs dos Componentes Testados

- `components/documentos-fiscais/AnexarNotaFiscalModal.jsx` - Modal principal
- `components/documentos-fiscais/PainelHistoricoNF.jsx` - Painel de auditoria
- `functions/registrarAlteracaoNFAuditoria.js` - Backend de auditoria
- `components/documentos-fiscais/BotaoAnexarNFGasto.jsx` - Integração
- `components/financeiro/ContaPagarModal.jsx` - Contas a Pagar
- `components/obra/CustoComNF.jsx` - Gastos da Obra
- `components/suprimentos/RecebimentoModal.jsx` - Recebimento

---

## Dados de Teste Sugeridos

**Nota Fiscal Teste (Válida):**
```
Número: 123456
Chave: 12345678901234567890123456789012345678901234 (44 dígitos)
Data Emissão: 2026-02-22
Emissor: FORNECEDOR TESTE LTDA
CNPJ: 12345678000198
Valor Total: R$ 1.000,00
Desconto: R$ 100,00
Frete: R$ 50,00
Outros: R$ 0,00
Valor Final: R$ 950,00
```

**Nota Fiscal Teste (Ruim - para fallback):**
- Usar imagem desfocada ou scanner de má qualidade
- Usuário preenche manualmente
- Sistema aceita e cria NF

---

## Resultado Esperado

Todas as 5 funcionalidades funcionando:
1. Contas a Pagar + NF + IA + Auditoria
2. Gasto da Obra + NF + Custo Automático
3. Recebimento + NF → Conta a Pagar
4. Auditoria com Histórico
5. Fallback Manual

**Status:** Pronto para produção (PARTE 12/12 concluída)