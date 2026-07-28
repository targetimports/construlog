import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para remover um colaborador de uma obra (soft delete)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { vínculo_id } = await req.json();

    if (!vínculo_id) {
      return Response.json({ error: 'vínculo_id é obrigatório' }, { status: 400 });
    }

    // Obter vínculo
    const vínculo = await base44.entities.ObraColaborador.get(vínculo_id);
    if (!vínculo) {
      return Response.json({ error: 'Vínculo não encontrado' }, { status: 404 });
    }

    // Desativar vínculo (soft delete)
    const vinculoAtualizado = await base44.entities.ObraColaborador.update(vínculo_id, {
      ativo: false,
      data_fim: new Date().toISOString().split('T')[0]
    });

    return Response.json({
      message: 'Colaborador removido da obra',
      vínculo: vinculoAtualizado
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});