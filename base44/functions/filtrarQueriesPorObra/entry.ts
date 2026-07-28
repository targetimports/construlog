import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Filtra queries automaticamente por obra baseado em permissões do usuário
 * Usada como middleware para garantir que usuário só acessa dados de suas obras
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entidade, filtro_original, usar_filtro_obra } = await req.json();

    if (!entidade) {
      return Response.json({
        error: 'Parâmetro obrigatório: entidade'
      }, { status: 400 });
    }

    // Super admin não precisa de filtro
    if (user.role === 'admin' || user.role === 'programador') {
      return Response.json({
        success: true,
        motivo: 'super_admin',
        filtro_final: filtro_original || {}
      });
    }

    // Se usar_filtro_obra = false, retornar sem filtro (para dados globais)
    if (usar_filtro_obra === false) {
      return Response.json({
        success: true,
        motivo: 'sem_filtro_obra',
        filtro_final: filtro_original || {}
      });
    }

    // Buscar obras que usuário pode acessar
    const vinculos = await base44.entities.UsuarioObra.filter({
      user_email: user.email,
      ativo: true
    });

    // Validar datas de acesso
    const agora = new Date();
    const obrasValidas = vinculos.filter(v => !v.data_fim || new Date(v.data_fim) >= agora);

    if (obrasValidas.length === 0) {
      return Response.json({
        success: true,
        motivo: 'usuario_sem_obras',
        filtro_final: { obra_id: null } // Nenhuma obra = sem acesso
      });
    }

    const obrasIds = obrasValidas.map(v => v.obra_id);

    // Construir filtro por obra
    const filtroObra = obrasIds.length === 1
      ? { obra_id: obrasIds[0] }
      : { obra_id: { $in: obrasIds } };

    // Mesclar com filtro original
    const filtroFinal = {
      ...filtro_original,
      ...filtroObra
    };

    // Log
    await base44.entities.LogAuditoria.create({
      function_name: 'filtrarQueriesPorObra',
      user_email: user.email,
      user_role: user.role,
      payload: JSON.stringify({ entidade, filtro_original }),
      result: 'success',
      timestamp: new Date().toISOString(),
      metadata: {
        entidade,
        obras_acessíveis: obrasIds.length,
        filtro_aplicado: true
      }
    });

    return Response.json({
      success: true,
      user_email: user.email,
      entidade,
      obras_acessiveis: obrasIds,
      total_obras: obrasIds.length,
      filtro_final: filtroFinal
    });

  } catch (error) {
    console.error('Erro ao filtrar queries:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});