import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      viagem_id, 
      foto_painel_url, 
      foto_veiculo_url,
      origem_endereco,
      destino,
      motivo,
      latitude_origem,
      longitude_origem
    } = await req.json();

    // VALIDAÇÕES OBRIGATÓRIAS
    if (!viagem_id) {
      return Response.json({ error: 'viagem_id obrigatório' }, { status: 400 });
    }
    if (!foto_painel_url) {
      return Response.json({ error: 'Foto do painel é obrigatória' }, { status: 400 });
    }
    if (!foto_veiculo_url) {
      return Response.json({ error: 'Foto do veículo é obrigatória' }, { status: 400 });
    }
    if (latitude_origem === null || latitude_origem === undefined || longitude_origem === null || longitude_origem === undefined) {
      return Response.json({ error: 'GPS de origem é obrigatório' }, { status: 400 });
    }
    if (!destino) {
      return Response.json({ error: 'Destino é obrigatório' }, { status: 400 });
    }
    if (!motivo) {
      return Response.json({ error: 'Motivo da viagem é obrigatório' }, { status: 400 });
    }

    const viagem = await base44.entities.Viagem.read(viagem_id);

    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Validar permissão: motorista (por email) ou admin
    if (viagem.motorista_user_id !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Processar foto do painel com IA para extrair KM
    let km_inicial = null;
    try {
      const resultadoIA = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta foto de painel de veículo e extraia APENAS o número de quilometragem. 
        Retorne apenas o número, sem texto adicional. Se não conseguir identificar, retorne null.`,
        file_urls: [foto_painel_url],
        response_json_schema: {
          type: "object",
          properties: {
            km: { type: "number", description: "Quilometragem identificada" }
          }
        }
      });
      
      km_inicial = resultadoIA?.km || null;
    } catch (err) {
      console.log('Erro ao processar KM com IA:', err);
    }

    // Atualizar viagem com todos os dados obrigatórios
    const atualizada = await base44.entities.Viagem.update(
      viagem_id,
      {
        status: 'em_andamento',
        saida_real: new Date().toISOString(),
        km_inicial: km_inicial,
        foto_painel_inicial_url: foto_painel_url,
        foto_veiculo_inicial_url: foto_veiculo_url,
        origem_endereco: origem_endereco,
        destino: destino,
        motivo: motivo,
        latitude_origem: latitude_origem,
        longitude_origem: longitude_origem
      }
    );

    return Response.json({
      success: true,
      viagem: atualizada,
      km_detectado: km_inicial,
      mensagem: 'Viagem iniciada com sucesso. Todos os dados obrigatórios registrados.'
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});