import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { relatorioData, tipo } = await req.json();

    if (!relatorioData) {
      return Response.json({ error: 'Dados do relatório são obrigatórios' }, { status: 400 });
    }

    const prompt = `Você é um analista especializado em relatórios de construção. 
Gere um resumo executivo profissional e conciso baseado nos dados do relatório a seguir.

Tipo: ${tipo}
Dados: ${JSON.stringify(relatorioData, null, 2)}

Crie um resumo com:
1. Overview (1-2 frases)
2. Pontos-chave (3-4 itens)
3. Recomendações (2-3 ações)

Formato: Markdown limpo e profissional.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    return Response.json({
      resumo: response,
      timestamp: new Date().toISOString(),
      usuario: user.email
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});