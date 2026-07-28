import { store } from '../entityStore.js';

// Marca um evento da agenda como concluído.
export default async function concluirEventoAgenda({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { evento_id } = body || {};
  if (!evento_id) throw Object.assign(new Error('evento_id obrigatório'), { status: 400 });

  const [eventoAtual] = await store.filter('AgendaEvento', { id: evento_id }, null, 1);
  if (!eventoAtual) throw Object.assign(new Error('Evento não encontrado'), { status: 404 });

  const eventoAtualizado = await store.update('AgendaEvento', evento_id, {
    status: 'concluido',
    data_fim: eventoAtual.data_fim || new Date().toISOString().split('T')[0]
  });

  try {
    await store.create('LogAuditoria', {
      user_email: user.email, acao: 'concluir', modulo: 'agenda',
      entidade: 'AgendaEvento', entidade_id: evento_id,
      detalhes: `Evento concluído: ${eventoAtual.titulo}`, sucesso: true
    });
  } catch { /* auditoria best-effort */ }

  return { ok: true, evento: eventoAtualizado };
}
