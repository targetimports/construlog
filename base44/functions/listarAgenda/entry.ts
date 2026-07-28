import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let bodyParsed = {};
    try {
      const method = (req.method || '').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD') {
        const txt = await req.text();
        if (txt && txt.trim()) bodyParsed = JSON.parse(txt);
      }
    } catch (_) {}
    const { de, ate, obra_id, tipos, status, busca, prioridade, pagina = 0, limit = 50 } = bodyParsed;

    // Montar query
    const query = {};

    if (de && ate) {
      query.data_inicio = { '$gte': de, '$lte': ate };
    }

    if (obra_id) {
      query.obra_id = obra_id;
    }

    if (tipos && tipos.length > 0) {
      query.tipo = { '$in': tipos };
    }

    if (status && status.length > 0) {
      query.status = { '$in': status };
    }

    if (prioridade) {
      query.prioridade = prioridade;
    }

    // TODO: busca em titulo/descricao se implementado no SDK

    // Listar - usar base44 user, não service role para respeitar permissões
    const eventos = await base44.entities.AgendaEvento.filter(query, '-data_inicio', limit, pagina * limit);

    // Contadores
    const contadores = {
      total: eventos.length,
      por_status: {},
      por_tipo: {}
    };

    eventos.forEach(e => {
      contadores.por_status[e.status] = (contadores.por_status[e.status] || 0) + 1;
      contadores.por_tipo[e.tipo] = (contadores.por_tipo[e.tipo] || 0) + 1;
    });

    return Response.json({
      ok: true,
      eventos,
      contadores,
      pagina,
      limit
    });
  } catch (error) {
    console.error('[listarAgenda] erro:', error.message);
    return Response.json({ ok: false, error: error.message, eventos: [], contadores: { total: 0, por_status: {}, por_tipo: {} } }, { status: 200 });
  }
});