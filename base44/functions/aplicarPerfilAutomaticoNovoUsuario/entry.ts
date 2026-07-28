import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Aplicar perfil padrão a usuário
 * Automático: Trigger onCreate de User (recebe { data: novoUsuario })
 * Manual: Chamada via frontend (recebe { user_id })
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    
    // Detectar se é automático (trigger) ou manual (frontend)
    const novoUsuario = body.data;
    const userId = body.user_id;

    const usuarioId = novoUsuario?.id || userId;
    const userEmail = novoUsuario?.email;

    if (!usuarioId) {
      return Response.json({ error: 'Usuário não identificado' }, { status: 400 });
    }

    // Buscar configuração de perfil padrão
    const configs = await base44.asServiceRole.entities.ConfiguracaoSistema.filter({
      chave: 'perfil_padrao_novos_usuarios'
    });
    
    const perfilPadrao = configs?.[0]?.valor || 'campo';

    // Atualizar o usuário com o perfil padrão
    await base44.asServiceRole.entities.User.update(usuarioId, {
      perfil_sistema: perfilPadrao,
      status: 'ativo'
    });

    console.log(`✅ Perfil "${perfilPadrao}" aplicado ao usuário ${userEmail || usuarioId}`);

    return Response.json({
      success: true,
      usuario: userEmail || usuarioId,
      perfil_aplicado: perfilPadrao
    });

  } catch (error) {
    console.error('❌ Erro ao aplicar perfil:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});