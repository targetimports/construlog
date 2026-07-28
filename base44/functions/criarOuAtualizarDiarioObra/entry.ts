import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Função para criar ou atualizar um diário da obra
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const { obra_id, data, producao_texto, observacao_geral } = await req.json();

    if (!obra_id || !data) {
      return Response.json({ 
        error: 'obra_id e data são obrigatórios' 
      }, { status: 400 });
    }

    // Verificar se obra existe
    const obra = await base44.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada' }, { status: 404 });
    }

    // Buscar diário existente para a data
    const diarios = await base44.entities.DiarioObra.filter({
      obra_id: obra_id,
      data: data
    });

    let diario;

    if (diarios && diarios.length > 0) {
      // Atualizar diário existente
      diario = diarios[0];
      
      // Verificar se está aprovado (bloqueado para edição)
      if (diario.status_registro === 'CONCLUIDO' && user.role !== 'admin') {
        return Response.json({ 
          error: 'Diário aprovado não pode ser editado. Solicite ao admin para reabrir.' 
        }, { status: 403 });
      }

      // Atualizar
      diario = await base44.entities.DiarioObra.update(diario.id, {
        producao_texto,
        observacao_geral,
        status_registro: 'RASCUNHO' // Volta para rascunho ao editar
      });

      return Response.json({
        message: 'Diário atualizado com sucesso',
        diario
      });
    } else {
      // Criar novo diário
      diario = await base44.entities.DiarioObra.create({
        obra_id,
        data,
        producao_texto,
        observacao_geral,
        status_registro: 'RASCUNHO',
        qtd_funcionarios: 0
      });

      return Response.json({
        message: 'Diário criado com sucesso',
        diario
      });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});