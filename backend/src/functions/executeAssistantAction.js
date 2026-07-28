import { requirePermission } from '../rbac.js';
import { store } from '../entityStore.js';
import { ACTION_SPEC, ENTIDADES_PERMITIDAS, num, hoje } from './_assistenteOperacional.js';

// Passo 3: executa a ação confirmada. Recheca a permissão (defesa em
// profundidade) e opera apenas em entidades da whitelist. Retorna
// { success, entidade, registro_id, valor_anterior } ou { success:false, error }.

export default async function executeAssistantAction({ body, user }) {
  const draft = body?.actionDraft || {};
  const spec = ACTION_SPEC[draft.acao];

  if (!spec || !ENTIDADES_PERMITIDAS.has(draft.entidade_alvo)) {
    return { success: false, error: 'Ação não suportada pelo assistente.' };
  }
  try {
    requirePermission(user, spec.perm); // 403 se não tiver permissão
  } catch (e) {
    return { success: false, error: e.message };
  }

  const entidade = spec.entidade;
  const dados = { ...(draft.dados || {}) };
  delete dados.registro_id;
  if (dados.valor != null) dados.valor = num(dados.valor);

  try {
    if (spec.op === 'create') {
      const payload = { ...spec.base, ...dados, obra_id: draft.obra_id || dados.obra_id || null };
      if (spec.base?.status === 'pago') payload.data_pagamento = dados.data || hoje();
      if (spec.base?.status === 'recebido') payload.data_recebimento = dados.data || hoje();
      const rec = await store.create(entidade, payload, user?.email || null);
      return { success: true, entidade, registro_id: rec.id };
    }

    if (spec.op === 'update') {
      const old = (await store.filter(entidade, { id: draft.registro_id }))[0];
      if (!old) return { success: false, error: 'Registro não encontrado.' };
      // PAY_AP/RECEIVE_AR: só altera status (+ data), nunca reescreve descrição/valor.
      // EDIT_RECORD: aplica os campos informados pelo usuário.
      let patch;
      if (spec.patch) {
        patch = { ...spec.patch };
        if (spec.patch.status === 'pago') patch.data_pagamento = hoje();
        if (spec.patch.status === 'recebido') patch.data_recebimento = hoje();
      } else {
        patch = { ...dados };
      }
      // Snapshot dos campos que mudam → permite "Desfazer" pela tela.
      const valor_anterior = {};
      for (const k of Object.keys(patch)) valor_anterior[k] = old[k] ?? null;
      await store.update(entidade, draft.registro_id, patch);
      return { success: true, entidade, registro_id: draft.registro_id, valor_anterior };
    }

    if (spec.op === 'delete') {
      const old = (await store.filter(entidade, { id: draft.registro_id }))[0];
      if (!old) return { success: false, error: 'Registro não encontrado.' };
      await store.delete(entidade, draft.registro_id);
      // Sem valor_anterior: exclusão não é desfeita via update (registro removido).
      return { success: true, entidade, registro_id: draft.registro_id };
    }
  } catch (e) {
    return { success: false, error: 'Falha ao executar a ação.', details: e.message };
  }

  return { success: false, error: 'Operação desconhecida.' };
}
