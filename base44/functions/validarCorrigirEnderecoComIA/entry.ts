import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endereco, tipo = 'origem' } = await req.json();

    if (!endereco || endereco.trim().length === 0) {
      return Response.json({ error: 'Endereço vazio' }, { status: 400 });
    }

    // Buscar endereços similares no BD (Viagens anteriores + Obras)
    const viagensAnteriores = await base44.asServiceRole.entities.RotaMotorista.list();
    const obras = await base44.asServiceRole.entities.Obra.list();

    const enderecosDoSistema = [
      ...viagensAnteriores.map(v => tipo === 'origem' ? v.endereco_origem : v.endereco_destino).filter(Boolean),
      ...obras.map(o => o.endereco).filter(Boolean)
    ];

    // Usar IA para validar e corrigir
    const prompt = `
    Você é um validador de endereços para um sistema de logística.
    
    Endereço fornecido: "${endereco}"
    Tipo de endereço: ${tipo === 'origem' ? 'ORIGEM (ponto de partida)' : 'DESTINO (entrega)'}
    
    Endereços válidos conhecidos no sistema:
    ${enderecosDoSistema.slice(0, 10).join('\n')}
    
    Tarefas:
    1. Procure por endereços similares na lista acima
    2. Se encontrar um similar (mesmo bairro, rua, cidade), retorne aquele
    3. Se não encontrar similar, retorne o endereço original corrigido (maiúscula, formatação padrão)
    4. Sempre valide se é um endereço real (cidade, estado válidos)
    5. Forneça informações úteis sobre o local:
       - Se é zona urbana ou rural
       - Avisos de trânsito (se há acessos difíceis, ruas estreitas, trânsito congestionado em horários específicos)
       - Horários de pico recomendados para evitar
       - Pontos de referência úteis para localização
    
    Responda em JSON APENAS com este formato:
    {
      "endereco_corrigido": "endereco validado",
      "encontrado_sistema": true/false,
      "status": "valido" | "corrigido" | "nao_encontrado",
      "confianca": 0.0-1.0,
      "tipo_area": "urbana" | "rural" | "misto",
      "avisos_transito": ["aviso1", "aviso2"],
      "horarios_pico": "descrição dos horários de pico",
      "pontos_referencia": "pontos de referência úteis para localizar"
    }`;

    const resultado = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          endereco_corrigido: { type: 'string' },
          encontrado_sistema: { type: 'boolean' },
          status: { type: 'string' },
          confianca: { type: 'number' },
          tipo_area: { type: 'string' },
          avisos_transito: { type: 'array', items: { type: 'string' } },
          horarios_pico: { type: 'string' },
          pontos_referencia: { type: 'string' }
        }
      }
    });

    // Fazer geocoding do endereço corrigido
    const geocodingUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(resultado.endereco_corrigido)}&limit=1`;
    const geoResponse = await fetch(geocodingUrl);
    const geoData = await geoResponse.json();

    if (!geoData || geoData.length === 0) {
      return Response.json({
        endereco_corrigido: resultado.endereco_corrigido,
        status: resultado.status,
        lat: null,
        lng: null,
        encontrado_mapa: false,
        confianca: resultado.confianca,
        tipo_area: resultado.tipo_area,
        avisos_transito: resultado.avisos_transito || [],
        horarios_pico: resultado.horarios_pico,
        pontos_referencia: resultado.pontos_referencia
      });
    }

    const { lat, lon } = geoData[0];

    return Response.json({
      endereco_corrigido: resultado.endereco_corrigido,
      status: resultado.status,
      lat: parseFloat(lat),
      lng: parseFloat(lon),
      encontrado_mapa: true,
      encontrado_sistema: resultado.encontrado_sistema,
      confianca: resultado.confianca,
      tipo_area: resultado.tipo_area,
      avisos_transito: resultado.avisos_transito || [],
      horarios_pico: resultado.horarios_pico,
      pontos_referencia: resultado.pontos_referencia
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});