import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viagem_id, tipo_foto, foto_url, observacao, localizacao_gps } = await req.json();

    if (!viagem_id || !tipo_foto || !foto_url) {
      return Response.json({
        error: 'viagem_id, tipo_foto e foto_url são obrigatórios'
      }, { status: 400 });
    }

    // Buscar viagem
    const viagem = await base44.asServiceRole.entities.Viagem.read(viagem_id);
    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Registrar foto
    const registro = await base44.asServiceRole.entities.RegistroViagemFoto.create({
      viagem_id,
      tipo_foto,
      foto_url,
      observacao,
      localizacao_gps,
      data_hora: new Date().toISOString(),
      processado_pela_ia: false
    });

    // Se for foto de painel (KM), chamar IA para leitura
    if (tipo_foto.includes('km')) {
      try {
        const resultado = await base44.integrations.Core.InvokeLLM({
          prompt: `Analise esta foto de painel de veículo e extraia o valor de quilometragem mostrado. 
Responda APENAS com um JSON: {"km": número, "confianca": 0-100, "detalhes": "descrição"}`,
          file_urls: [foto_url],
          response_json_schema: {
            type: 'object',
            properties: {
              km: { type: 'number' },
              confianca: { type: 'number' },
              detalhes: { type: 'string' }
            }
          }
        });

        const kmDetectado = resultado.data.km;
        const confianca = resultado.data.confianca;

        // Atualizar registro com resultado da IA
        await base44.asServiceRole.entities.RegistroViagemFoto.update(registro.id, {
          km_detectado: kmDetectado,
          processado_pela_ia: true,
          resultado_ia: {
            confianca,
            valor_detectado: String(kmDetectado),
            alertas: confianca < 70 ? ['Baixa confiança na leitura'] : []
          }
        });

        // Atualizar KM na viagem
        if (tipo_foto === 'painel_km_inicial') {
          await base44.asServiceRole.entities.Viagem.update(viagem_id, {
            km_inicial: kmDetectado,
            saida_real: new Date().toISOString(),
            foto_painel_inicial_url: foto_url,
            status: 'em_andamento'
          });
        } else if (tipo_foto === 'painel_km_final') {
          // Calcular KM rodados
          const kmRodados = kmDetectado - (viagem.km_inicial || 0);
          
          await base44.asServiceRole.entities.Viagem.update(viagem_id, {
            km_final: kmDetectado,
            km_rodados: Math.max(0, kmRodados),
            retorno_real: new Date().toISOString(),
            foto_painel_final_url: foto_url,
            status: 'finalizada'
          });

          // Gerar alertas de KM se necessário
          if (kmRodados < 0) {
            await base44.asServiceRole.entities.AlertaViagemIA.create({
              viagem_id,
              tipo_alerta: 'km_inconsistente',
              severidade: 'critico',
              descricao: 'KM final menor que inicial (possível erro de leitura)',
              valor_esperado: viagem.km_inicial,
              valor_observado: kmDetectado,
              percentual_desvio: -100
            });
          }
        }

        return Response.json({
          success: true,
          registro_id: registro.id,
          km_detectado: kmDetectado,
          confianca,
          viagem_atualizada: true
        });
      } catch (iaError) {
        console.log('Aviso: IA não conseguiu ler KM:', iaError.message);
        // Continuar mesmo sem IA
        return Response.json({
          success: true,
          registro_id: registro.id,
          ia_disponivel: false,
          mensagem: 'Foto registrada. Digite manualmente o KM se necessário.'
        });
      }
    }

    return Response.json({
      success: true,
      registro_id: registro.id,
      mensagem: 'Foto registrada com sucesso'
    });
  } catch (error) {
    console.error('Erro ao processar foto:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});