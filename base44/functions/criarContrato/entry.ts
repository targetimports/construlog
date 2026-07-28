import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id, fornecedor_id, categoria_id, numero, titulo, tipo, contratante, contratado, objeto, valor_inicial, valor_total_aditivos, valor_total, data_assinatura, data_inicio, data_fim_prevista, prazo_dias, retencoes_padrao, observacoes } = await req.json();

    // Validações obrigatórias
    if (!obra_id) return Response.json({ error: 'obra_id obrigatório', field: 'obra_id' }, { status: 400 });
    if (!fornecedor_id) return Response.json({ error: 'fornecedor_id obrigatório', field: 'fornecedor_id' }, { status: 400 });
    if (!categoria_id) return Response.json({ error: 'categoria_id obrigatório', field: 'categoria_id' }, { status: 400 });
    if (valor_total === undefined || valor_total < 0) return Response.json({ error: 'valor_total obrigatório e >= 0' }, { status: 400 });
    if (!data_assinatura) return Response.json({ error: 'data_assinatura obrigatório' }, { status: 400 });

    const contrato = await base44.entities.Contrato.create({
      obra_id,
      fornecedor_id,
      categoria_id,
      numero: numero || '',
      titulo: titulo || '',
      tipo: tipo || 'fornecimento',
      contratante: contratante || '',
      contratado: contratado || '',
      objeto: objeto || '',
      valor_inicial: valor_inicial || 0,
      valor_total_aditivos: valor_total_aditivos || 0,
      valor_total,
      data_assinatura,
      data_inicio: data_inicio || null,
      data_fim_prevista: data_fim_prevista || null,
      prazo_dias: prazo_dias || 0,
      status: 'ativo',
      retencoes_padrao: retencoes_padrao || [],
      observacoes: observacoes || ''
    });

    // Auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'criar',
      modulo: 'contratos',
      entidade: 'Contrato',
      entidade_id: contrato.id,
      dados_novos: contrato,
      detalhes: `Contrato criado: ${titulo || numero}`,
      sucesso: true
    });

    return Response.json({ ok: true, contrato_id: contrato.id, contrato });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});