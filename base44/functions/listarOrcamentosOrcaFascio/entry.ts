import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = Deno.env.get('ORCAFASCIO_API_KEY');
    const apiUrl = 'https://api.orcafascio.com/api/v1';

    if (!apiKey) {
      return Response.json({ error: 'ORCAFASCIO_API_KEY não configurada' }, { status: 400 });
    }

    // Listar orçamentos disponíveis na API do OrcaFascio
    const response = await fetch(`${apiUrl}/orcamentos`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao listar orçamentos da API do OrcaFascio');
    }

    const orcamentos = await response.json();

    return Response.json({
      sucesso: true,
      orcamentos: orcamentos,
      total: orcamentos.length
    });
  } catch (error) {
    console.error('Erro ao listar orçamentos OrcaFascio:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});