import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Dispara quando um novo usuário é criado
    if (event.type === 'create' && event.entity_name === 'User') {
      const novoUsuario = data;

      // Verifica se já existe permissão
      const permissaoExistente = await base44.asServiceRole.entities.PermissaoUsuario.filter({
        user_email: novoUsuario.email
      });

      if (permissaoExistente.length === 0) {
        // Cria permissão padrão para novo usuário
        await base44.asServiceRole.entities.PermissaoUsuario.create({
          user_email: novoUsuario.email,
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

    return Response.json({ status: 'ok' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});