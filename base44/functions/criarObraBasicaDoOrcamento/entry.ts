import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id } = await req.json();

    if (!orcamento_id) {
      return Response.json({ error: 'orcamento_id é obrigatório' }, { status: 400 });
    }

    // Buscar orçamento
    const orcamento = await base44.asServiceRole.entities.OrcamentoObra.read(orcamento_id);
    if (!orcamento) {
      return Response.json({ error: 'Orçamento não encontrado' }, { status: 404 });
    }

    // Se já tem obra_id, retornar essa obra
    if (orcamento.obra_id) {
      const obra = await base44.asServiceRole.entities.Obra.read(orcamento.obra_id);
      return Response.json({
        success: true,
        obra_id: obra.id,
        obra,
        mensagem: 'Obra já existe para este orçamento'
      });
    }

    // Criar nova Obra
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome: orcamento.descricao || `Obra ${orcamento.numero}`,
      codigo: `OBR-${Date.now()}`,
      tipo: 'privada',
      tipo_obra: 'edificacao',
      cliente: 'A definir',
      fase: 'orcamento',
      orcamento_id: orcamento_id,
      status: 'orcamento',
      total_orcamento: orcamento.valor_total || 0,
      bdi_percent: orcamento.bdi_percent || 0,
      total_final_orcamento: orcamento.valor_final || 0
    });

    // Atualizar orçamento com obra_id
    await base44.asServiceRole.entities.OrcamentoObra.update(orcamento_id, {
      obra_id: obra.id
    });

    return Response.json({
      success: true,
      obra_id: obra.id,
      obra,
      mensagem: 'Obra criada com sucesso a partir do orçamento'
    });
  } catch (error) {
    console.error('Erro ao criar obra:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});