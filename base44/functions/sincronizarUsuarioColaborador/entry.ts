import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (!data || !data.email) {
      return Response.json({ error: 'Email não encontrado' }, { status: 400 });
    }

    // Verificar se já existe um colaborador com este email
    const colaboradoresExistentes = await base44.asServiceRole.entities.Colaborador.filter({
      user_email: data.email
    });

    const colaboradorData = {
      nome: data.full_name || data.email,
      email: data.email,
      user_email: data.email,
      cargo: data.cargo || 'Não definido',
      telefone: data.telefone || '',
      status: data.status_acesso === 'aprovado' ? 'ativo' : 'inativo'
    };

    if (colaboradoresExistentes && colaboradoresExistentes.length > 0) {
      // Atualizar colaborador existente
      await base44.asServiceRole.entities.Colaborador.update(
        colaboradoresExistentes[0].id,
        colaboradorData
      );
      console.log('Colaborador atualizado:', data.email);
    } else {
      // Criar novo colaborador
      await base44.asServiceRole.entities.Colaborador.create(colaboradorData);
      console.log('Novo colaborador criado:', data.email);
    }

    return Response.json({ 
      success: true,
      message: 'Colaborador sincronizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao sincronizar colaborador:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});