import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
// redeploy: 2026-02-27T14:08

async function safeJson(req, fallback = {}) {
  const method = (req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return fallback;
  try {
    const text = await req.text();
    if (!text || text.trim() === '') return fallback;
    return JSON.parse(text);
  } catch (_) { return fallback; }
}

/**
 * Backend retorna APENAS IDs - frontend importa menuItems e filtra
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      // Retornar menu mínimo em vez de 401 para não quebrar o boot
      const fallbackMenuIds = ['dashboard', 'ajuda', 'atalhos', 'notificacoes'];
      return Response.json({
        menuIds: fallbackMenuIds,
        user: { email: 'guest', role: 'guest' },
        isSuperAdmin: false,
        isCompanyAdmin: false,
        source: 'guest_fallback',
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    const { isSuperAdmin, isCompanyAdmin } = await safeJson(req, {});

    // Menu IDs (frontend importa menuItems e filtra com getMenuForRole)
    const allMenuIds = [
      'dashboard', 'obras', 'calendario', 'suprimentos', 'notas-fiscais', 'estoque', 'estoques',
      'logistica', 'equipamentos', 'financeiro', 'executivo', 'cadastros', 'rh', 
      'relatorios', 'administracao', 'ativos', 'implementacoes', 'ti',
      'ajuda', 'assistentes-ia', 'atalhos', 'notificacoes-usuario',
      'configuracoes', 'ajustes-pessoais', 'ajustes-globais'
    ];

    // Bloquear TI para admin_empresa
    const menuIds = isCompanyAdmin 
      ? allMenuIds.filter(id => id !== 'ti')
      : allMenuIds;

    return Response.json({
      menuIds,
      user: { email: user.email, role: user.role, cargo: user.cargo },
      isSuperAdmin,
      isCompanyAdmin,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[getMenuForBootstrap] FALLBACK:', error);
    const fallbackMenuIds = [
      'dashboard', 'obras', 'calendario', 'suprimentos', 'notas-fiscais', 'estoque', 'estoques',
      'logistica', 'equipamentos', 'financeiro', 'executivo', 'cadastros', 'rh', 
      'relatorios', 'ajuda', 'atalhos', 'notificacoes-usuario',
      'configuracoes', 'ajustes-pessoais', 'ajustes-globais'
    ];
    return Response.json({
      menuIds: fallbackMenuIds,
      user: { email: 'unknown', role: 'user' },
      isSuperAdmin: false,
      isCompanyAdmin: false,
      source: 'fallback_error',
      timestamp: new Date().toISOString()
    }, { status: 200 });
  }
});