import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('ORCAFACIL_API_KEY');
    const apiUrl = Deno.env.get('ORCAFACIL_API_URL') || 'https://api.orcafascio.com';

    if (!apiKey) {
      return Response.json({ error: 'ORCAFACIL_API_KEY não configurada' }, { status: 400 });
    }

    // Listar orçamentos disponíveis na API
    const response = await fetch(`${apiUrl}/orcamentos`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao listar orçamentos da API do Orça Fácil');
    }

    const orcamentos = await response.json();

    return Response.json({
      sucesso: true,
      orcamentos: orcamentos,
      total: orcamentos.length
    });
  } catch (error) {
    console.error('Erro ao listar orçamentos:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});