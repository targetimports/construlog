import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contratoId, permitirEdicao } = await req.json();

    // 1. Validar permissão - usuário precisa de alçada ou ser admin
    if (user.role !== 'admin') {
      const alcadas = await base44.asServiceRole.entities.Alcada?.filter?.({
        usuario_email: user.email,
        modulo_contrato: true
      }) || [];

      if (alcadas.length === 0) {
        return Response.json({ 
          error: 'Você não tem alçada para alterar permissões de edição',
          requiresAlcada: true
        }, { status: 403 });
      }
    }

    // 2. Atualizar contrato
    await base44.entities.Contrato.update(contratoId, {
      edicao_habilitada: permitirEdicao,
      ultima_alteracao_edicao: new Date().toISOString(),
      ultimo_usuario_alteracao: user.email
    });

    // 3. Registrar no log
    const acao = permitirEdicao ? 'BLOQUEOU' : 'LIBEROU';
    await base44.asServiceRole.entities.LogAuditoria?.create?.({
      modulo: 'Contratos',
      acao: `${acao} edição do contrato`,
      usuario_email: user.email,
      data_hora: new Date().toISOString(),
      entidade_id: contratoId,
      entidade_tipo: 'Contrato'
    });

    return Response.json({
      sucesso: true,
      mensagem: `Edição ${permitirEdicao ? 'bloqueada' : 'liberada'} com sucesso`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});