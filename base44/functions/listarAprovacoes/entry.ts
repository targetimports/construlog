import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const BUILD_ID = `LIST-APROV-${Date.now()}`;
const PAGE_SIZE = 20;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validar permissões
    const userRole = user.cargo || user.role || 'leitura';
    const hasPermission = ['diretor', 'compras', 'financeiro', 'admin', 'gestor'].includes(userRole) || user.role === 'admin';
    
    if (!hasPermission) {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Parse input
    const { modulo = 'compras', status = 'pendente', nivel, obra_id, de, ate, page = 0 } = await req.json();

    // Build filter
    const filter = {};
    if (modulo) filter.modulo = modulo;
    if (status) filter.status = status;
    if (nivel) filter.nivel = nivel;
    if (obra_id) filter.obra_id = obra_id;

    // Listar todas (será filtrado client-side para data se necessário)
    const aprovacoes = await base44.asServiceRole.entities.Aprovacao.filter(filter, '-solicitado_em');

    // Filtro por data (se informado)
    let filtered = aprovacoes;
    if (de || ate) {
      const desde = de ? new Date(de) : new Date(0);
      const ate_date = ate ? new Date(ate) : new Date();

      filtered = aprovacoes.filter(a => {
        const dataAprov = new Date(a.solicitado_em);
        return dataAprov >= desde && dataAprov <= ate_date;
      });
    }

    // Ordenação: pendentes primeiro, depois mais antigas
    filtered.sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'pendente') return -1;
        if (b.status === 'pendente') return 1;
      }
      return new Date(a.solicitado_em) - new Date(b.solicitado_em);
    });

    // Paginação
    const total = filtered.length;
    const start = page * PAGE_SIZE;
    const items = filtered.slice(start, start + PAGE_SIZE);

    return Response.json({
      ok: true,
      build_id: BUILD_ID,
      total,
      page,
      page_size: PAGE_SIZE,
      items: items.map(a => ({
        id: a.id,
        modulo: a.modulo,
        referencia_tipo: a.referencia_tipo,
        referencia_id: a.referencia_id,
        obra_id: a.obra_id,
        obra_nome: a.obra_nome,
        valor: a.valor,
        nivel: a.nivel,
        nivel_atual: a.nivel_atual,
        nivel_maximo: a.nivel_maximo,
        status: a.status,
        solicitado_por: a.solicitado_por,
        solicitado_nome: a.solicitado_nome,
        solicitado_em: a.solicitado_em,
        decidido_por: a.decidido_por,
        decidido_em: a.decidido_em,
        motivo: a.motivo,
        descricao: a.descricao,
        aprovadores_pendentes: a.aprovadores_pendentes,
        historico_aprovacoes: a.historico_aprovacoes,
        prazo_expira_em: a.prazo_expira_em,
        alcada_id_atual: a.alcada_id_atual
      }))
    });

  } catch (error) {
    console.error('[LISTARAPROVACOES-ERRO]', error);
    return Response.json({ error: error.message, build_id: BUILD_ID }, { status: 500 });
  }
});