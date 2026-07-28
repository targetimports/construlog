// Spec compartilhado do Assistente Operacional (chat que executa ações).
// Escopo atual: registros financeiros (ContaFinanceira), conforme o propósito
// da tela ("Gerencie registros financeiros por comandos de texto").
//
// Toda ação tem permissão exigida (RBAC) verificada na VALIDAÇÃO e novamente na
// EXECUÇÃO (defesa em profundidade). Entidades fora da whitelist são recusadas.

export const num = (v) => Number(v) || 0;
export const hoje = () => new Date().toISOString().slice(0, 10);

export const APPROVAL_THRESHOLD = 50000; // acima disso, marca requires_approval

export const ENTIDADES_PERMITIDAS = new Set(['ContaFinanceira']);

// op: create | update | delete
// base: campos fixos aplicados na criação; patch: campos fixos no update.
export const ACTION_SPEC = {
  CREATE_EXPENSE: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'create', base: { tipo: 'pagar', status: 'pago' } },
  CREATE_INCOME: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'create', base: { tipo: 'receber', status: 'recebido' } },
  CREATE_AP: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'create', base: { tipo: 'pagar', status: 'pendente' } },
  CREATE_AR: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'create', base: { tipo: 'receber', status: 'pendente' } },
  PAY_AP: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'update', patch: { status: 'pago' } },
  RECEIVE_AR: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'update', patch: { status: 'recebido' } },
  EDIT_RECORD: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_EDIT', op: 'update' },
  DELETE_RECORD: { entidade: 'ContaFinanceira', perm: 'FINANCEIRO_APPROVE', op: 'delete' },
};
