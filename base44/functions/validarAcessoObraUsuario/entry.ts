import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Valida se usuário tem permissão para acessar uma obra
 * Retorna: permissão, perfil, lista de obras acessíveis
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id } = await req.json();

    // Super admin (role=admin/programador) tem acesso a TUDO
    if (user.role === 'admin' || user.role === 'programador') {
      return Response.json({
        success: true,
        tem_acesso: true,
        motivo: 'super_admin',
        perfil: 'administrador',
        user_email: user.email
      });
    }

    // Se obra_id foi passado, validar acesso específico
    if (obra_id) {
      const vinculo = await base44.entities.UsuarioObra.filter({
        user_email: user.email,
        obra_id: obra_id,
        ativo: true
      });

      if (vinculo.length === 0) {
        return Response.json({
          success: true,
          tem_acesso: false,
          motivo: 'sem_vinculo_obra',
          obra_id
        }, { status: 403 });
      }

      const v = vinculo[0];

      // Validar se ainda está dentro do período de acesso
      const agora = new Date();
      if (v.data_fim && new Date(v.data_fim) < agora) {
        return Response.json({
          success: true,
          tem_acesso: false,
          motivo: 'acesso_expirado',
          data_fim: v.data_fim
        }, { status: 403 });
      }

      return Response.json({
        success: true,
        tem_acesso: true,
        motivo: 'vinculo_valido',
        perfil: v.perfil,
        obra_id,
        data_inicio: v.data_inicio,
        data_fim: v.data_fim
      });
    }

    // Listar todas as obras que o usuário pode acessar
    const vinculos = await base44.entities.UsuarioObra.filter({
      user_email: user.email,
      ativo: true
    });

    // Filtrar por data de expiração
    const agora = new Date();
    const obrasValidas = vinculos.filter(v => !v.data_fim || new Date(v.data_fim) >= agora);

    // Agrupar por perfil
    const obrasPorPerfil = {
      administrador: [],
      mestre_de_obras: [],
      encarregado: [],
      funcionario: []
    };

    obrasValidas.forEach(v => {
      obrasPorPerfil[v.perfil] = obrasPorPerfil[v.perfil] || [];
      obrasPorPerfil[v.perfil].push({
        obra_id: v.obra_id,
        data_inicio: v.data_inicio,
        data_fim: v.data_fim
      });
    });

    return Response.json({
      success: true,
      user_email: user.email,
      total_obras: obrasValidas.length,
      obras_por_perfil: obrasPorPerfil,
      all_obras: obrasValidas.map(v => v.obra_id)
    });

  } catch (error) {
    console.error('Erro ao validar acesso:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});