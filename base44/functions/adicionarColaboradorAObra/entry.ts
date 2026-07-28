import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para adicionar um colaborador a uma obra
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { obra_id, colaborador_id, funcao_na_obra, data_inicio } = await req.json();

    if (!obra_id || !colaborador_id) {
      return Response.json({ 
        error: 'obra_id e colaborador_id são obrigatórios' 
      }, { status: 400 });
    }

    // Verificar se obra existe
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Verificar se colaborador existe
    const colaborador = await base44.entities.Colaborador.get(colaborador_id);
    if (!colaborador) {
      return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    // Verificar se já existe vínculo (ativo ou inativo)
    const vinculoExistente = await base44.entities.ObraColaborador.filter({
      obra_id: obra_id,
      colaborador_id: colaborador_id
    });

    if (vinculoExistente && vinculoExistente.length > 0) {
      const vínculo = vinculoExistente[0];
      
      // Se inativo, reativar
      if (!vínculo.ativo) {
        await base44.entities.ObraColaborador.update(vínculo.id, {
          ativo: true,
          data_inicio: data_inicio || new Date().toISOString().split('T')[0],
          data_fim: null
        });
        return Response.json({
          message: 'Colaborador reativado na obra',
          vínculo: await base44.entities.ObraColaborador.get(vínculo.id)
        });
      }
      
      // Se já ativo, retornar erro
      return Response.json({ 
        error: 'Colaborador já está vinculado a esta obra' 
      }, { status: 409 });
    }

    // Criar novo vínculo
    const novoVinculo = await base44.entities.ObraColaborador.create({
      obra_id,
      colaborador_id,
      funcao_na_obra: funcao_na_obra || null,
      data_inicio: data_inicio || new Date().toISOString().split('T')[0],
      ativo: true
    });

    return Response.json({
      message: 'Colaborador adicionado à obra',
      vínculo: novoVinculo
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});