import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, tipo_documento } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'file_url é obrigatório' }, { status: 400 });
    }

    const prompt = `
Analise este documento de ${tipo_documento || 'construção'} e extraia as informações principais.

Identifique e retorne:
- Valores monetários mencionados
- Datas importantes
- Partes envolvidas (empresas, pessoas)
- Objetos ou serviços descritos
- Prazos mencionados
- Condições especiais
- Riscos identificados

Seja preciso e objetivo. Retorne APENAS JSON válido.
`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [file_url],
      response_json_schema: {
        type: "object",
        properties: {
          valores_identificados: {
            type: "array",
            items: {
              type: "object",
              properties: {
                descricao: { type: "string" },
                valor: { type: "number" }
              }
            }
          },
          datas_importantes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                tipo: { type: "string" },
                data: { type: "string" }
              }
            }
          },
          partes_envolvidas: {
            type: "array",
            items: { type: "string" }
          },
          objeto: { type: "string" },
          prazos: {
            type: "array",
            items: { type: "string" }
          },
          condicoes_especiais: {
            type: "array",
            items: { type: "string" }
          },
          riscos_identificados: {
            type: "array",
            items: { type: "string" }
          },
          resumo: { type: "string" }
        }
      }
    });

    return Response.json({ 
      success: true, 
      analise: resultado 
    });

  } catch (error) {
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});