import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Limpar avatar_url do banco
    await base44.auth.updateMe({
      avatar_url: null
    });

    return Response.json({ 
      ok: true,
      message: 'Avatar removed successfully'
    });

  } catch (error) {
    console.error('Avatar remove error:', error);
    return Response.json({ 
      error: error.message || 'Remove failed' 
    }, { status: 500 });
  }
});