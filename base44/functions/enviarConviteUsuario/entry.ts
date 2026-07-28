import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode criar usuários aguardando aprovação
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, perfil, full_name, cpf_cnpj, cargo, tipo_pessoa } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email é obrigatório' }, { status: 400 });
    }

    // Verifica se usuário já existe
    const usuariosExistentes = await base44.asServiceRole.entities.User.filter({ email });
    if (usuariosExistentes.length > 0) {
      return Response.json({ error: 'Usuário com este email já existe' }, { status: 400 });
    }

    // Cria registro de usuário pendente (sem convite automático)
    const novoUsuario = await base44.asServiceRole.entities.User.create({
      email,
      full_name: full_name || email.split('@')[0],
      perfil,
      cpf_cnpj,
      cargo,
      tipo_pessoa,
      status: 'aguardando_aprovacao'
    });

    return Response.json({ 
      sucesso: true,
      id: novoUsuario.id,
      mensagem: 'Usuário adicionado aguardando aprovação'
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});