# GUIA DE VALIDAÇÃO COMPLETA DO SISTEMA

## Como Executar

### Via Dashboard
1. Abrir **Ops Console** ou **Status Sistema**
2. Executar função: `validadorSistemaCompleto`
3. Aguardar resultado

### Via cURL
```bash
curl -X POST http://localhost:8000/api/functions/validadorSistemaCompleto \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{}'
```

### Via Frontend (React)
```typescript
import { base44 } from '@/api/base44Client';

const resultado = await base44.functions.invoke('validadorSistemaCompleto', {});
console.log(resultado.data);
```

---

## O que é Validado

### ETAPA 1- Validar Functions
- 14 functions críticas estão disponíveis
- Todas compilam corretamente
- Imports não estão quebrados
- Dependências existem

**Functions Validadas:**
1. `criarOrdemCompra`
2. `gerarOCDaCotacao`
3. `processarMovimentacaoEstoque`
4. `pagarConta`
5. `getFinanceKPIs`
6. `conciliarDadosInsumos`
7. `listarOpsOutbox`
8. `fecharPeriodo`
9. `reabrirPeriodo`
10. `statusPeriodo`
11. `aprovarOrdemCompraComAlcada`
12. `criarMedicaoObra`
13. `aprovarMedicaoObra`
14. `gerarFolhaPagamento`

---

### ETAPA 2- Integração Frontend ↔ Backend
- Todas as funções retornam JSON
- Nenhuma retorna HTML
- Payloads correspondem aos esperados
- Erros são tratados corretamente

**Validações:**
- Resposta é sempre um objeto JSON
- Nunca `Unexpected token '<'`
- Nunca `Failed to fetch` (sem tratamento)
- Nunca `fetchJson is not defined`

---

### ETAPA 3- Fluxos Reais
- Fluxo Compras (Req → OC → Receb → Estoque)
- Fluxo Financeiro (Conta → Conciliação → DRE)
- Fluxo Medição (Criação → Aprovação → Faturamento)
- Fluxo RH (Apontamento → Folha)
- Fluxo Obra (Cronograma → Avanço → KPI)

**Dados Verificados:**
- Obras criadas
- Fornecedores cadastrados
- Contas financeiras
- Medições
- Colaboradores

---

### ETAPA 4- Segurança
- Autenticação ativa
- RBAC funcionando
- Escopo de obra aplicado
- Service role isolado
- Auditoria registrada

**Verificações:**
- `user.email` não é nulo
- `user.role` está definido
- Permissões mapeadas corretamente
- LogAuditoria registra ações

---

### ETAPA 5- Estabilidade
- Response Handler em todas as functions
- Error Handler trata exceções
- Service role nunca exposto
- OpsOutbox funcional
- Notificações não quebram

**Checklist:**
- [ ] Nenhuma function retorna `undefined`
- [ ] Todos erros têm `code` e `message`
- [ ] Logs não mostram erros não tratados
- [ ] Outbox processa itens

---

## Interpretando Resultados

### APTO PARA PRODUÇÃO
Score geral ≥ 80%
- Sistema pronto para uso em construtora
- Todos os fluxos funcionam
- Segurança validada
- Estabilidade garantida

### PRECISA DE CORREÇÕES
Score geral < 80%
- Revisar problemas críticos listados
- Executar correções sugeridas
- Rodar validação novamente

---

## Problemas Comuns e Soluções

### "Function indisponível"
**Problema:** Function não compila ou tem erro
**Solução:** 
```bash
# 1. Verificar logs da function
# 2. Procurar erros de sintaxe
# 3. Verificar imports
```

### "FAIL - Resposta não é JSON"
**Problema:** Function retorna HTML (erro 500)
**Solução:** 
```typescript
// Usar responseHandler em TODA function
import { successResponse, errorResponse } from './_shared/responseHandler.ts';
return successResponse({ data: 'valor' });
```

### "Escopo não aplicado"
**Problema:** User está vendo dados de outras obras
**Solução:**
```typescript
// Adicionar filtro de obra_id
const items = await base44.entities.Entity.filter({ 
  obra_id: user.obra_id // ou payload.obra_id
});
```

### "Auditoria não registrada"
**Problema:** LogAuditoria vazio
**Solução:**
```typescript
await base44.asServiceRole.entities.LogAuditoria.create({
  user_email: user.email,
  entidade: 'Entity',
  acao: 'ACAO',
  sucesso: true
});
```

---

## Checklist Pré-Produção

- [ ] Score geral ≥ 80%
- [ ] 0 problemas críticos
- [ ] Dados de teste removidos
- [ ] BREAK_GLASS tokens criados
- [ ] Períodos fechados testados
- [ ] Auditoria auditada
- [ ] Backup feito
- [ ] Documentação atualizada

---

## Performance Esperada

| Operação | Tempo Esperado |
|----------|---|
| Criar OC | 100-200ms |
| Aprovar OC | 150-250ms |
| Fechar período | 500-1000ms |
| Gerar KPIs | 200-500ms |
| Validação completa | 10-30s |

---

## Contatos e Escalação

- **Erro crítico**: Contactar @support
- **Pergunta técnica**: Documentação em `/functions` 
- **Bug encontrado**: Report em `components/BUGS.md