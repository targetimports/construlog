import { store } from '../entityStore.js';

// Edita um evento da agenda (só os campos enviados).
export default async function editarEventoAgenda({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { evento_id, titulo, tipo, data_inicio, data_fim, dia_todo, responsavel_id, local, descricao, tags, prioridade, status } = body || {};
  if (!evento_id) throw Object.assign(new Error('evento_id obrigatório'), { status: 400 });

  const [eventoAtual] = await store.filter('AgendaEvento', { id: evento_id }, null, 1);
  if (!eventoAtual) throw Object.assign(new Error('Evento não encontrado'), { status: 404 });

  const patch = {};
  if (titulo) patch.titulo = titulo;
  if (tipo) patch.tipo = tipo;
  if (data_inicio) patch.data_inicio = data_inicio;
  if (data_fim !== undefined) patch.data_fim = data_fim;
  if (dia_todo !== undefined) patch.dia_todo = dia_todo;
  if (responsavel_id !== undefined) patch.responsavel_id = responsavel_id;
  if (local !== undefined) patch.local = local;
  if (descricao !== undefined) patch.descricao = descricao;
  if (tags) patch.tags = tags;
  if (prioridade) patch.prioridade = prioridade;
  if (status) patch.status = status;

  const eventoAtualizado = await store.update('AgendaEvento', evento_id, patch);

  try {
    await store.create('LogAuditoria', { user_email: user.email, acao: 'atualizar', modulo: 'agenda', entidade: 'AgendaEvento', entidade_id: evento_id, detalhes: `Evento atualizado: ${titulo || eventoAtual.titulo}`, sucesso: true });
  } catch { /* auditoria best-effort */ }

  return { ok: true, evento: eventoAtualizado };
}
