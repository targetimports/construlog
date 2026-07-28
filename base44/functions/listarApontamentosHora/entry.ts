import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, colaborador_id, equipe_id, status, de, ate, origem, pagina = 1 } = body;

    // Construir filtro
    const filtro = {};
    if (obra_id) filtro.obra_id = obra_id;
    if (colaborador_id) filtro.colaborador_id = colaborador_id;
    if (equipe_id) filtro.equipe_id = equipe_id;
    if (status) filtro.status = status;
    if (origem) filtro.origem = origem;

    // Filtro de data (entre de e ate)
    // Base44 não suporta queries complexas, então usamos filter e filtramos em memória
    const apontamentos = await base44.asServiceRole.entities.ApontamentoHora.filter(
      filtro,
      '-data',
      500
    );

    let resultado = apontamentos || [];

    // Filtrar por período
    if (de || ate) {
      resultado = resultado.filter(ap => {
        const data = new Date(ap.data);
        if (de && data < new Date(de)) return false;
        if (ate && data > new Date(ate)) return false;
        return true;
      });
    }

    // Paginação
    const porPagina = 20;
    const total = resultado.length;
    const paginas = Math.ceil(total / porPagina);
    const inicio = (pagina - 1) * porPagina;
    const fim = inicio + porPagina;
    const paginado = resultado.slice(inicio, fim);

    return Response.json({
      ok: true,
      apontamentos: paginado,
      paginacao: {
        pagina,
        porPagina,
        total,
        paginas
      }
    }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});