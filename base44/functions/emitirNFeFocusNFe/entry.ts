import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BASE_URL = 'https://homologacao.focusnfe.com.br';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = Deno.env.get('FOCUS_NFE_TOKEN');
    if (!token) {
      return Response.json({ error: 'FOCUS_NFE_TOKEN não configurado. Configure nas variáveis de ambiente.' }, { status: 500 });
    }

    const AUTH = 'Basic ' + btoa(`${token}:`);
    const { action, ref, body } = await req.json();

    if (action === 'emitir') {
      if (!ref || !body) {
        return Response.json({ error: 'ref e body são obrigatórios' }, { status: 400 });
      }

      const r = await fetch(`${BASE_URL}/v2/nfe?ref=${ref}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: AUTH },
        body: JSON.stringify(body),
      });

      const data = await r.json();
      return Response.json({ status: r.status, data });
    }

    if (action === 'consultar') {
      if (!ref) {
        return Response.json({ error: 'ref é obrigatório' }, { status: 400 });
      }

      const r = await fetch(`${BASE_URL}/v2/nfe/${ref}`, {
        headers: { Authorization: AUTH },
      });

      const data = await r.json();
      return Response.json({ status: r.status, data });
    }

    return Response.json({ error: 'action inválida. Use "emitir" ou "consultar".' }, { status: 400 });

  } catch (error) {
    console.error('[emitirNFeFocusNFe] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});