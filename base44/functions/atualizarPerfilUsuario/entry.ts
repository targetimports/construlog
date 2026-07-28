import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Atualiza perfil_sistema de um usuário
 * Pode ser chamado no onboarding ou por admin
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const userAuth = await base44.auth.me();
    
    if (!userAuth) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { user_email, perfil_sistema, cargo } = await req.json();

    // Validar perfil
    const perfisValidos = ['admin', 'engenharia', 'compras', 'almoxarifado', 'logistica', 'financeiro', 'diretoria', 'campo'];
    
    if (perfil_sistema && !perfisValidos.includes(perfil_sistema)) {
      return Response.json({ 
        error: 'Perfil inválido',
        perfis_validos: perfisValidos
      }, { status: 400 });
    }

    // Buscar usuário
    const usuarios = await base44.asServiceRole.entities.User.filter({ email: user_email });
    if (usuarios.length === 0) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const user = usuarios[0];

    // Se não forneceu perfil mas forneceu cargo, mapear
    let perfilFinal = perfil_sistema;
    
    if (!perfilFinal && cargo) {
      // Mapear cargo → perfil
      const { mapearPerfilPorCargo } = await import('./_lib/mapearPerfilPorCargo.js');
      perfilFinal = mapearPerfilPorCargo(cargo);
    }

    // Atualizar
    const dadosUpdate = {};
    if (perfilFinal) dadosUpdate.perfil_sistema = perfilFinal;
    if (cargo) dadosUpdate.cargo = cargo;

    await base44.asServiceRole.entities.User.update(user.id, dadosUpdate);

    return Response.json({
      success: true,
      user_email,
      perfil_atualizado: perfilFinal,
      cargo_atualizado: cargo
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});