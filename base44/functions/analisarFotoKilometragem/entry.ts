import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { foto_url, tipo_momento } = await req.json();

    if (!foto_url) {
      return Response.json({ error: 'Foto é obrigatória' }, { status: 400 });
    }

    const prompt = `
Você é especialista em leitura de painéis de veículos e odômetros.

Analise a foto do painel do carro enviada e extraia:
1. A quilometragem exata mostrada no odômetro
2. Confiança na leitura (alta, média, baixa)
3. Observações importantes (painel danificado, imagem borrada, etc.)

Tipo de momento: ${tipo_momento === 'inicio' ? 'INÍCIO da viagem' : 'FIM da viagem'}

Responda APENAS em JSON com essa estrutura:
{
  "quilometragem": número (ex: 125430),
  "confianca": "alta|media|baixa",
  "observacoes": "descrição do estado do painel/foto",
  "valido": true|false
}

Se a foto não mostrar o odômetro claramente, coloque valido: false.
    `;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [foto_url],
      response_json_schema: {
        type: 'object',
        properties: {
          quilometragem: { type: 'number' },
          confianca: { type: 'string' },
          observacoes: { type: 'string' },
          valido: { type: 'boolean' }
        }
      }
    });

    return Response.json(resultado);
  } catch (error) {
    console.error('Erro ao analisar foto:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});