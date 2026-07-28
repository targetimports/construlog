import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// SHA256 hash
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { token_plain } = body;

    if (!token_plain) {
      return Response.json({ error: 'token_plain is required', field: 'token_plain' }, { status: 400 });
    }

    // Hash do token
    const token_hash = await sha256(token_plain);

    // Procurar token válido
    const tokens = await base44.asServiceRole.entities.BreakGlassToken.filter({
      token_hash_sha256: token_hash,
      used: false
    });

    if (!tokens || tokens.length === 0) {
      return Response.json({ error: 'Invalid or already used token', reason: 'INVALID_TOKEN' }, { status: 403 });
    }

    const bgToken = tokens[0];

    // Validar expiração
    const now = new Date();
    const expires = new Date(bgToken.expires_at_iso);
    if (now > expires) {
      return Response.json({ error: 'Token expired', reason: 'TOKEN_EXPIRED' }, { status: 403 });
    }

    // Marcar como usado
    await base44.asServiceRole.entities.BreakGlassToken.update(bgToken.id, {
      used: true,
      used_at_iso: now.toISOString(),
      used_by_email: user.email
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'USAR_BREAKGLASS_TOKEN',
        modulo: 'ops',
        entidade: 'BreakGlassToken',
        entidade_id: bgToken.id,
        sucesso: true
      });
    } catch (e) {
      // Ignorar
    }

    return Response.json({
      ok: true,
      build_id: `VALIDATE-BG-${Date.now()}`,
      valid: true,
      token_id: bgToken.id,
      scope: bgToken.scope
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});