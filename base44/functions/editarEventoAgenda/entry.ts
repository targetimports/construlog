import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { evento_id, titulo, tipo, data_inicio, data_fim, dia_todo, responsavel_id, local, descricao, tags, prioridade, status } = await req.json();

    if (!evento_id) {
      return Response.json({ error: 'evento_id obrigatório' }, { status: 400 });
    }

    // Buscar evento atual - usar base44 direto pois já tem ID do evento
    const eventos = await base44.entities.AgendaEvento.filter({ id: evento_id });
    if (eventos.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const eventoAtual = eventos[0];

    // Proteção: tipo=prazo não pode perder obra_id
    if (eventoAtual.tipo === 'prazo' && tipo === 'prazo' && !eventoAtual.obra_id && !req.json.obra_id) {
      return Response.json({ error: 'Evento tipo prazo não pode ficar sem obra_id' }, { status: 400 });
    }

    // Atualizar
    const eventoAtualizado = await base44.asServiceRole.entities.AgendaEvento.update(evento_id, {
      ...(titulo && { titulo }),
      ...(tipo && { tipo }),
      ...(data_inicio && { data_inicio }),
      ...(data_fim !== undefined && { data_fim }),
      ...(dia_todo !== undefined && { dia_todo }),
      ...(responsavel_id !== undefined && { responsavel_id }),
      ...(local !== undefined && { local }),
      ...(descricao !== undefined && { descricao }),
      ...(tags && { tags }),
      ...(prioridade && { prioridade }),
      ...(status && { status })
    });

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'atualizar',
      modulo: 'agenda',
      entidade: 'AgendaEvento',
      entidade_id: evento_id,
      dados_anteriores: eventoAtual,
      dados_novos: eventoAtualizado,
      detalhes: `Evento atualizado: ${titulo || eventoAtual.titulo}`,
      sucesso: true
    });

    return Response.json({ ok: true, evento: eventoAtualizado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});