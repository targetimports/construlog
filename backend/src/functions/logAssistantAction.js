import { store } from '../entityStore.js';

// Registra a ação do assistente em LogAcaoIA (auditoria + histórico da tela,
// com suporte a "Desfazer" quando há valor_anterior).

export default async function logAssistantAction({ body, user }) {
  const draft = body?.actionDraft || {};
  const result = body?.result || {};
  const status = body?.status || 'executado';

  try {
    const rec = await store.create('LogAcaoIA', {
      acao_realizada: draft.acao || null,
      comando_original: draft.comando_original || '',
      entidade_afetada: result.entidade || draft.entidade_alvo || null,
      registro_id: result.registro_id || null,
      valor_novo: { valor: draft?.dados?.valor ?? null },
      valor_anterior: result.valor_anterior || null,
      status,
      usuario_email: user?.email || null,
    }, user?.email || null);
    return { ok: true, id: rec.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
