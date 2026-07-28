import { store } from '../entityStore.js';

// Cria um evento na agenda (status agendado).
export default async function criarEventoAgenda({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { titulo, tipo, data_inicio, data_fim, dia_todo, obra_id, responsavel_id, local, descricao, tags, origem, referencia_tipo, referencia_id, prioridade } = body || {};

  if (!titulo || !data_inicio) throw Object.assign(new Error('titulo e data_inicio são obrigatórios'), { status: 400 });
  if (tipo === 'prazo' && !obra_id) throw Object.assign(new Error('tipo=prazo requer obra_id'), { status: 400 });
  if (origem && origem !== 'manual' && (!referencia_tipo || !referencia_id)) {
    throw Object.assign(new Error(`origem=${origem} requer referencia_tipo e referencia_id`), { status: 400 });
  }

  const evento = await store.create('AgendaEvento', {
    titulo,
    tipo: tipo || 'reuniao',
    data_inicio,
    data_fim: data_fim || null,
    dia_todo: dia_todo || false,
    status: 'agendado',
    obra_id: obra_id || null,
    responsavel_id: responsavel_id || null,
    local: local || null,
    descricao: descricao || null,
    tags: tags || [],
    origem: origem || 'manual',
    referencia_tipo: referencia_tipo || null,
    referencia_id: referencia_id || null,
    prioridade: prioridade || 'media'
  });

  try {
    await store.create('LogAuditoria', { user_email: user.email, acao: 'criar', modulo: 'agenda', entidade: 'AgendaEvento', entidade_id: evento.id, dados_novos: evento, detalhes: `Criado evento: ${titulo}`, sucesso: true });
  } catch { /* auditoria best-effort */ }

  return { ok: true, evento };
}
