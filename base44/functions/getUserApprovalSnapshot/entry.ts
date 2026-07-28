import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
    }

    const { email } = await req.json().catch(() => ({}));
    const emailToCheck = email || user.email;

    console.log(`[getUserApprovalSnapshot] Verificando: ${emailToCheck}`);

    // Buscar User direto (sem cache)
    const usuarios = await base44.asServiceRole.entities.User.filter({ email: emailToCheck });
    const userRecord = usuarios?.[0];

    if (!userRecord) {
      console.log(`[getUserApprovalSnapshot] Usuário não encontrado: ${emailToCheck}`);
      return Response.json({
        ok: false,
        error: 'Usuário não encontrado no banco de autenticação',
        snapshot: null
      }, { status: 404 });
    }

    // Buscar AprovacaoUsuario
    const aprovacoes = await base44.asServiceRole.entities.AprovacaoUsuario
      .filter({ user_email: emailToCheck });
    const aprovacao = aprovacoes?.[0] || null;

    const snapshot = {
      email: userRecord.email,
      id: userRecord.id,
      status: userRecord.status || 'pendente',
      status_acesso: userRecord.status_acesso || aprovacao?.status_acesso || 'pendente',
      approvedAt: userRecord.approvedAt || aprovacao?.data_aprovacao || null,
      approvedBy: userRecord.approvedBy || aprovacao?.aprovado_por || null,
      role: userRecord.role || 'user',
      cargo: userRecord.cargo || aprovacao?.cargo || '',
      companyId: userRecord.companyId || null,
      perfil_acesso: userRecord.perfil_acesso || aprovacao?.perfil_acesso || 'campo',
      full_name: userRecord.full_name || aprovacao?.full_name || '',
      created_at: userRecord.created_date
    };

    console.log(`[getUserApprovalSnapshot] Snapshot:`, snapshot);
    return Response.json({ ok: true, snapshot });
  } catch (error) {
    console.error('[getUserApprovalSnapshot] Error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});