import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contrato_id, obra_id } = await req.json();

    if (!contrato_id) {
      return Response.json({ error: 'contrato_id é obrigatório' }, { status: 400 });
    }

    // Buscar contrato
    const contrato = await base44.entities.Contrato.get(contrato_id);
    if (!contrato) {
      return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    // Buscar todas as medições do contrato
    const medicoes = await base44.entities.Medicao.filter({
      contrato_id: contrato_id
    }, '-data_medicao');

    // Calcular resumo
    const resumo = {
      contrato_id,
      numero_contrato: contrato.numero,
      titulo_contrato: contrato.titulo,
      fornecedor_id: contrato.fornecedor_id,
      obra_id: contrato.obra_id,
      valor_total_contrato: contrato.valor_total,
      total_medicoes: medicoes.length,
      valor_total_medido: medicoes.reduce((sum, m) => sum + (m.valor_liquido || 0), 0),
      percentual_medio_realisado: ((medicoes.reduce((sum, m) => sum + (m.valor_liquido || 0), 0) / contrato.valor_total) * 100).toFixed(2) + '%',
      status_breakdown: {
        rascunho: medicoes.filter(m => m.status === 'rascunho').length,
        enviada: medicoes.filter(m => m.status === 'enviada').length,
        aprovada: medicoes.filter(m => m.status === 'aprovada').length,
        reprovada: medicoes.filter(m => m.status === 'reprovada').length,
        faturada: medicoes.filter(m => m.status === 'faturada').length
      }
    };

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'listarMedicoesContrato',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ contrato_id, obra_id }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        contrato_id,
        medicoes_encontradas: medicoes.length,
        valor_total_medido: resumo.valor_total_medido
      }
    });

    return Response.json({
      success: true,
      resumo,
      medicoes
    });

  } catch (error) {
    console.error('Erro ao listar medições:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});