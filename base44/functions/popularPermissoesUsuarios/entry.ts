import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Apenas admin pode executar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Busca todos os usuários
    const usuarios = await base44.asServiceRole.entities.User.list();
    
    // Busca permissões existentes
    const permissoesExistentes = await base44.asServiceRole.entities.PermissaoUsuario.list();
    const emailsComPermissao = permissoesExistentes.map(p => p.user_email);

    // Cria permissão padrão para usuários sem permissão
    const novasPermissoes = [];
    for (const usuario of usuarios) {
      if (!emailsComPermissao.includes(usuario.email)) {
        novasPermissoes.push({
          user_email: usuario.email,
          financeiro: false,
          compras: false,
          logistica: false,
          motorista: false,
          estoquista: false,
          almoxarife: false,
          mestre_obras: false,
          engenheiro: false,
          menus_visiveis: []
        });
      }
    }

    if (novasPermissoes.length > 0) {
      await base44.asServiceRole.entities.PermissaoUsuario.bulkCreate(novasPermissoes);
    }

    return Response.json({ 
      mensagem: 'Permissões criadas com sucesso',
      total_criadas: novasPermissoes.length 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});