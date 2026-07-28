import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { veiculo_id, km_inicial, km_final, peso_carga, tipo_veiculo, marca, modelo } = await req.json();

    if (!veiculo_id || !km_inicial || !km_final) {
      return Response.json({ error: 'Dados obrigatórios: veiculo_id, km_inicial, km_final' }, { status: 400 });
    }

    const kmPercorrido = Number(km_final) - Number(km_inicial);
    if (kmPercorrido <= 0) {
      return Response.json({ error: 'KM final deve ser maior que KM inicial' }, { status: 400 });
    }

    // Prompt para IA analisar consumo
    const prompt = `
Você é um especialista em consumo de combustível de veículos de carga.

Baseado nos dados da viagem, analise e preveja o consumo de combustível:
- Tipo de Veículo: ${tipo_veiculo || 'caminhão'}
- Marca/Modelo: ${marca || 'desconhecido'} ${modelo || ''}
- KM a Percorrer: ${kmPercorrido} km
- Peso da Carga: ${peso_carga ? peso_carga + ' toneladas' : 'desconhecido'}

Calcule:
1. Consumo médio esperado (km/litro) baseado no tipo de veículo e peso
2. Quantidade total de combustível previsto em litros
3. Margem de segurança (assumir +10% por variações de tráfego)

Responda em JSON com a estrutura:
{
  "consumo_medio_kmL": número,
  "combustivel_previsto_litros": número,
  "combustivel_com_margem_litros": número,
  "observacoes": "breve análise"
}

Se não tiver certeza de algum valor, use 0 ou deixe em branco.
    `;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          consumo_medio_kmL: { type: 'number' },
          combustivel_previsto_litros: { type: 'number' },
          combustivel_com_margem_litros: { type: 'number' },
          observacoes: { type: 'string' }
        }
      }
    });

    return Response.json(resultado);
  } catch (error) {
    console.error('Erro ao prever combustível:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});