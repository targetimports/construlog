import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Middleware de validação: bloqueia operações sem obra
 * Usado em: criar orçamento, medição, financeiro
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { entidade, obra_id, centro_custo_id } = await req.json();

    // Validar obrigatoriedade de obra
    if (!obra_id) {
      return Response.json({ 
        error: `Obra é obrigatória para ${entidade}`,
        code: 'OBRA_REQUIRED'
      }, { status: 422 });
    }

    // Validar se obra existe e user tem acesso
    const obra = await base44.entities.Obra.read(obra_id).catch(() => null);
    if (!obra) {
      return Response.json({ 
        error: 'Obra não encontrada',
        code: 'OBRA_NOT_FOUND'
      }, { status: 404 });
    }

    // Validar centro de custo se informado
    if (centro_custo_id) {
      const cc = await base44.entities.CentroCusto.read(centro_custo_id).catch(() => null);
      if (!cc || cc.obra_id !== obra_id) {
        return Response.json({ 
          error: 'Centro de custo inválido ou não pertence à obra',
          code: 'CC_INVALID'
        }, { status: 422 });
      }

      if (!cc.ativo) {
        return Response.json({ 
          error: 'Centro de custo inativo',
          code: 'CC_INACTIVE'
        }, { status: 422 });
      }
    }

    // Validar permissões do usuário na obra
    const permissoes = await base44.asServiceRole.entities.PermissaoObra
      .filter({ obra_id, usuario_email: user.email })
      .catch(() => []);

    if (permissoes.length === 0 && user.role !== 'admin') {
      return Response.json({ 
        error: 'Sem permissão para acessar esta obra',
        code: 'NO_PERMISSION'
      }, { status: 403 });
    }

    return Response.json({ 
      ok: true,
      obra_id,
      centro_custo_id,
      user_email: user.email
    });

  } catch (error) {
    console.error('Validador erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});