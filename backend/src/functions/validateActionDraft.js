import { can } from '../rbac.js';
import { store } from '../entityStore.js';
import { ACTION_SPEC, ENTIDADES_PERMITIDAS, APPROVAL_THRESHOLD, num } from './_assistenteOperacional.js';

// Passo 2: valida o rascunho ANTES de mostrar o preview/executar.
// Verifica ação suportada, permissão (RBAC), campos obrigatórios e existência
// do registro alvo. Retorna { valid, errors, warnings, permissao_negada }.

export default async function validateActionDraft({ body, user }) {
  const draft = body?.actionDraft || {};
  const spec = ACTION_SPEC[draft.acao];

  if (!spec || !ENTIDADES_PERMITIDAS.has(draft.entidade_alvo)) {
    return { valid: false, errors: ['Ação não suportada pelo assistente.'] };
  }
  if (!can(user, spec.perm)) {
    return { valid: false, permissao_negada: true, errors: [`Seu perfil não pode executar "${draft.acao}".`] };
  }

  const errors = [];
  const warnings = [];
  const dados = draft.dados || {};

  if (spec.op === 'create') {
    if (!(num(dados.valor) > 0)) errors.push('Informe um valor maior que zero.');
  } else {
    if (!draft.registro_id) {
      errors.push('Registro alvo não informado.');
    } else {
      const rec = (await store.filter(spec.entidade, { id: draft.registro_id }).catch(() => []))[0];
      if (!rec) errors.push('Registro não encontrado.');
    }
  }

  if (errors.length) return { valid: false, errors };

  if (draft.requires_approval || num(dados.valor) >= APPROVAL_THRESHOLD) {
    warnings.push('Valor alto — confira os dados antes de confirmar.');
  }
  if ((draft.confidence ?? 1) < 0.5) {
    warnings.push('Interpretação com baixa confiança — revise os campos antes de confirmar.');
  }

  return { valid: true, actionDraft: draft, warnings };
}
