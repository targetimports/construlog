import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contrato_id, titulo, tipo, valor_total_aditivos, valor_total, data_fim_prevista, prazo_dias, retencoes_padrao, observacoes, status } = await req.json();

    if (!contrato_id) return Response.json({ error: 'contrato_id obrigatório' }, { status: 400 });

    const contratos = await base44.entities.Contrato.filter({ id: contrato_id });
    if (contratos.length === 0) return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });

    const contratoAtual = contratos[0];

    // Impede remover obra_id, fornecedor_id, categoria_id
    const updateData = {};
    if (titulo !== undefined) updateData.titulo = titulo;
    if (tipo !== undefined) updateData.tipo = tipo;
    if (valor_total_aditivos !== undefined) updateData.valor_total_aditivos = valor_total_aditivos;
    if (valor_total !== undefined) updateData.valor_total = valor_total;
    if (data_fim_prevista !== undefined) updateData.data_fim_prevista = data_fim_prevista;
    if (prazo_dias !== undefined) updateData.prazo_dias = prazo_dias;
    if (retencoes_padrao !== undefined) updateData.retencoes_padrao = retencoes_padrao;
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (status !== undefined) updateData.status = status;

    const contratoAtualizado = await base44.entities.Contrato.update(contrato_id, updateData);

    // Auditoria
    await base44.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'atualizar',
      modulo: 'contratos',
      entidade: 'Contrato',
      entidade_id: contrato_id,
      dados_anteriores: contratoAtual,
      dados_novos: contratoAtualizado,
      detalhes: `Contrato atualizado: ${contratoAtualizado.titulo}`,
      sucesso: true
    });

    return Response.json({ ok: true, contrato: contratoAtualizado });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});