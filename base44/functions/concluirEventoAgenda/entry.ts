import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { evento_id } = await req.json();

    if (!evento_id) {
      return Response.json({ error: 'evento_id obrigatório' }, { status: 400 });
    }

    // Buscar
    const eventos = await base44.asServiceRole.entities.AgendaEvento.filter({ id: evento_id });
    if (eventos.length === 0) {
      return Response.json({ error: 'Evento não encontrado' }, { status: 404 });
    }

    const eventoAtual = eventos[0];

    // Atualizar
    const eventoAtualizado = await base44.asServiceRole.entities.AgendaEvento.update(evento_id, {
      status: 'concluido',
      data_fim: eventoAtual.data_fim || new Date().toISOString().split('T')[0]
    });

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'concluir',
      modulo: 'agenda',
      entidade: 'AgendaEvento',
      entidade_id: evento_id,
      dados_anteriores: eventoAtual,
      dados_novos: eventoAtualizado,
      detalhes: `Evento concluído: ${eventoAtual.titulo}`,
      sucesso: true
    });

    return Response.json({ ok: true, evento: eventoAtualizado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});