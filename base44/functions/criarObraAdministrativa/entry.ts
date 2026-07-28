import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Apenas admins podem criar Obra Administrativa' }, { status: 403 });
    }

    // Verificar se já existe
    const existente = await base44.asServiceRole.entities.Obra.filter(
      { codigo_obra: 'ADMIN' }
    );

    if (existente && existente.length > 0) {
      return Response.json({
        success: true,
        obra_id: existente[0].id,
        mensagem: 'Obra Administrativa já existe'
      });
    }

    // Criar Obra ADMINISTRATIVO / CENTRAL
    const obra = await base44.asServiceRole.entities.Obra.create({
      nome_obra: 'ADMINISTRATIVO / CENTRAL',
      codigo_obra: 'ADMIN',
      status: 'em_execucao',
      descricao: 'Obra padrão para lançamentos administrativos sem vinculação específica',
      data_inicio: new Date().toISOString().split('T')[0]
    });

    return Response.json({
      success: true,
      obra_id: obra.id,
      mensagem: 'Obra Administrativa criada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao criar Obra Administrativa:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});