import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { origem, destino, veiculoId, dataViagem } = await req.json();

    if (!origem || !destino) {
      return Response.json({ error: 'Origem e destino são obrigatórios' }, { status: 400 });
    }

    // Buscar histórico de viagens similares
    const rotasAnteriores = await base44.asServiceRole.entities.RotaMotorista.filter({
      motorista_email: user.email
    });

    // Buscar trânsito/condições
    const horaViagem = new Date(dataViagem).getHours();
    
    // Prompt para IA sugerir rota otimizada
    const prompt = `
    Como um assistente de logística, analise e sugira a melhor rota considerando:
    
    VIAGEM:
    - Origem: ${origem.endereco}
    - Destino: ${destino.endereco}
    - Data/Hora: ${dataViagem}
    - Horário do dia: ${horaViagem}h
    
    HISTÓRICO DO MOTORISTA (últimas rotas):
    ${rotasAnteriores.slice(0, 5).map(r => `- ${r.nome}: ${r.endereco_origem} → ${r.endereco_destino}`).join('\n')}
    
    ANÁLISE REQUERIDA:
    1. Qual é a melhor rota (principais ruas/avenidas)?
    2. Tempo estimado (considere horário - picos de trânsito)?
    3. Distância aproximada?
    4. Pontos de atenção (obras, congestionamento típico)?
    5. Alternativa caso encontre trânsito?
    6. Paradas recomendadas (combustível, descanso)?
    
    Responda em JSON estruturado.`;

    const sugestao = await base44.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          rota_principal: { type: 'string' },
          tempo_estimado_minutos: { type: 'number' },
          distancia_km: { type: 'number' },
          pontos_atencao: { type: 'array', items: { type: 'string' } },
          rota_alternativa: { type: 'string' },
          paradas_recomendadas: { type: 'array', items: { type: 'string' } },
          risco_transito: { type: 'string', enum: ['baixo', 'medio', 'alto'] },
          recomendacoes: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Buscar coordenadas via OSRM para validar distância/tempo
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full`;
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();

    let distanciaReal = null;
    let tempoReal = null;

    if (osrmData.routes && osrmData.routes[0]) {
      distanciaReal = osrmData.routes[0].distance / 1000; // km
      tempoReal = Math.round(osrmData.routes[0].duration / 60); // minutos
    }

    return Response.json({
      sugestao_ia: sugestao,
      dados_reais: {
        distancia_km: distanciaReal,
        tempo_minutos: tempoReal
      },
      origem: { endereco: origem.endereco, lat: origem.lat, lng: origem.lng },
      destino: { endereco: destino.endereco, lat: destino.lat, lng: destino.lng }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});