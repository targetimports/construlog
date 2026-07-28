import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        autorizado: false, 
        motivo: 'Usuário não autenticado' 
      }, { status: 401 });
    }

    // Roles permitidos para importar composições
    const rolesPermitidos = ['admin', 'engenharia', 'orcamento'];
    const userRole = user.role?.toLowerCase() || '';
    
    const autorizado = rolesPermitidos.includes(userRole);

    if (autorizado) {
      // Log de acesso autorizado
      await base44.asServiceRole.entities.LogAuditoria.create({
        usuario_email: user.email,
        acao: 'acesso_importacao_composicoes',
        modulo: 'orcamentos',
        detalhes: 'Acesso autorizado para importar planilha de composições',
        data_hora: new Date().toISOString()
      });
    } else {
      // Log de tentativa não autorizada
      await base44.asServiceRole.entities.LogAuditoria.create({
        usuario_email: user.email,
        acao: 'tentativa_nao_autorizada_importacao',
        modulo: 'orcamentos',
        detalhes: `Usuário com role '${userRole}' tentou acessar importação de composições`,
        data_hora: new Date().toISOString()
      });
    }

    return Response.json({
      autorizado,
      usuario: user.email,
      role: userRole,
      rolesPermitidos,
      motivo: autorizado ? 'OK' : `Role '${userRole}' não tem permissão. Roles permitidos: ${rolesPermitidos.join(', ')}`
    });
  } catch (error) {
    return Response.json({ 
      autorizado: false, 
      motivo: error.message 
    }, { status: 500 });
  }
});