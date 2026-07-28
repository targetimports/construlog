import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Gerar token humano: A1B2-C3D4-E5F6 (10-12 chars alphanumeric + hífens)
function generateHumanToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) token += '-';
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

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
    const { scope = 'OPS_PROD', expires_minutes, note } = body;

    // Ler config para expiração padrão
    const config = await base44.asServiceRole.entities.ConfiguracaoSistema.list();
    const defaultExpires = parseInt(
      config.find(c => c.chave === 'ops_breakglass_expires_minutes')?.valor || '10'
    );
    const expiresMin = expires_minutes !== undefined ? expires_minutes : defaultExpires;

    // Gerar token
    const token_plain = generateHumanToken();
    const token_hash = await sha256(token_plain);

    // Calcular expiração
    const now = new Date();
    const expires_at = new Date(now.getTime() + expiresMin * 60000);

    // Salvar somente o hash
    const bgToken = await base44.asServiceRole.entities.BreakGlassToken.create({
      token_hash_sha256: token_hash,
      created_by_email: user.email,
      created_at_iso: now.toISOString(),
      expires_at_iso: expires_at.toISOString(),
      used: false,
      scope,
      note,
      build_id_create: `BREAKGLASS-${Date.now()}`
    });

    // Auditoria
    try {
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'CRIAR_BREAKGLASS_TOKEN',
        modulo: 'ops',
        entidade: 'BreakGlassToken',
        entidade_id: bgToken.id,
        detalhes: { scope, expires_minutes: expiresMin, note },
        sucesso: true
      });
    } catch (e) {
      // Ignorar
    }

    // Retornar token SOMENTE UMA VEZ
    return Response.json({
      ok: true,
      build_id: `BREAKGLASS-${Date.now()}`,
      token_plain,
      token_id: bgToken.id,
      scope,
      expires_at_iso: expires_at.toISOString(),
      expires_minutes: expiresMin
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});