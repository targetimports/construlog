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
      foto_painel_final_url,
      foto_veiculo_final_url,
      latitude_destino,
      longitude_destino,
      observacoes,
      houve_abastecimento,
      houve_despesas,
      valor_abastecimento,
      valor_despesas
    } = await req.json();

    // VALIDAÇÕES OBRIGATÓRIAS
    if (!viagem_id) {
      return Response.json({ error: 'viagem_id obrigatório' }, { status: 400 });
    }
    if (!foto_painel_final_url) {
      return Response.json({ error: 'Foto do painel final é obrigatória' }, { status: 400 });
    }
    if (latitude_destino === null || latitude_destino === undefined || longitude_destino === null || longitude_destino === undefined) {
      return Response.json({ error: 'GPS de destino é obrigatório' }, { status: 400 });
    }

    const viagem = await base44.entities.Viagem.read(viagem_id);

    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    // Validar permissão (motorista_user_id é email)
    if (viagem.motorista_user_id !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Sem permissão' }, { status: 403 });
    }

    // Processar foto do painel com IA para extrair KM final
    let km_final = null;
    try {
      const resultadoIA = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta foto de painel de veículo e extraia APENAS o número de quilometragem. 
        Retorne apenas o número, sem texto adicional. Se não conseguir identificar, retorne null.`,
        file_urls: [foto_painel_final_url],
        response_json_schema: {
          type: "object",
          properties: {
            km: { type: "number", description: "Quilometragem identificada" }
          }
        }
      });
      
      km_final = resultadoIA?.km || null;
    } catch (err) {
      console.log('Erro ao processar KM final com IA:', err);
    }

    // REGRA CRÍTICA: Bloquear se KM final < KM inicial
    if (viagem.km_inicial && km_final && km_final < viagem.km_inicial) {
      return Response.json({ 
        error: `BLOQUEADO: KM final (${km_final}) é menor que KM inicial (${viagem.km_inicial}). Verifique a foto.`,
        km_inicial: viagem.km_inicial,
        km_final_detectado: km_final
      }, { status: 400 });
    }

    // Calcular KM rodados
    const km_rodados = (km_final && viagem.km_inicial) ? (km_final - viagem.km_inicial) : null;

    // Calcular tempo total da viagem
    const saida = new Date(viagem.saida_real);
    const retorno = new Date();
    const tempoTotalMs = retorno - saida;
    const tempoTotalHoras = (tempoTotalMs / 3600000).toFixed(2);

    // Atualizar viagem
    const viagemAtualizada = await base44.entities.Viagem.update(
      viagem_id,
      {
        status: 'finalizada',
        retorno_real: retorno.toISOString(),
        km_final: km_final,
        km_rodados: km_rodados,
        foto_painel_final_url: foto_painel_final_url,
        foto_veiculo_final_url: foto_veiculo_final_url,
        latitude_destino: latitude_destino,
        longitude_destino: longitude_destino,
        observacoes: observacoes || '',
        tempo_total_horas: parseFloat(tempoTotalHoras)
      }
    );

    // Atualizar solicitação para concluída (usar SolicitacaoTransporte, não SolicitacaoVeiculo)
    const solicitacao = await base44.entities.SolicitacaoTransporte.read(viagem.solicitacao_id);
    
    if (solicitacao) {
      await base44.entities.SolicitacaoTransporte.update(
        viagem.solicitacao_id,
        { status: 'concluida' }
      );
    }

    // Registrar abastecimento se houver
    if (houve_abastecimento === 'sim' && valor_abastecimento > 0) {
      await base44.entities.Abastecimento.create({
        viagem_id: viagem_id,
        veiculo_id: viagem.veiculo_id,
        data: new Date().toISOString().split('T')[0],
        valor: valor_abastecimento,
        tipo: 'viagem',
        motorista_user_id: viagem.motorista_user_id
      });

      // Criar custo automaticamente
      await base44.entities.CustoViagem.create({
        viagem_id: viagem_id,
        categoria: 'abastecimento',
        data: new Date().toISOString().split('T')[0],
        valor_total: valor_abastecimento,
        descricao: 'Abastecimento registrado na finalização da viagem',
        tipo_registro: 'automatico',
        status: 'aprovado'
      });
    }

    // Registrar despesas genéricas se houver
    if (houve_despesas === 'sim' && valor_despesas > 0) {
      await base44.entities.LancamentoGenerico.create({
        data: new Date().toISOString().split('T')[0],
        categoria: 'Despesa Viagem',
        descricao: `Despesas da viagem ${viagem.numero}`,
        valor: valor_despesas,
        forma_pagamento: 'dinheiro',
        observacao: `Viagem: ${viagem.numero} - ${observacoes || ''}`
      });

      // Criar custo automaticamente
      await base44.entities.CustoViagem.create({
        viagem_id: viagem_id,
        categoria: 'outros',
        data: new Date().toISOString().split('T')[0],
        valor_total: valor_despesas,
        descricao: observacoes || 'Despesas diversas da viagem',
        tipo_registro: 'automatico',
        status: 'pendente'
      });
    }

    // ALERTA: Verificar se KM rodado está fora do padrão
    let alerta_km_anormal = null;
    if (km_rodados && km_rodados > 500) {
      alerta_km_anormal = `⚠️ ALERTA: KM rodado (${km_rodados} km) está acima do padrão (500km)`;
    }

    return Response.json({
      success: true,
      viagem: viagemAtualizada,
      km_final_detectado: km_final,
      km_rodados: km_rodados,
      tempo_total_horas: tempoTotalHoras,
      alerta: alerta_km_anormal,
      mensagem: 'Viagem finalizada com sucesso!'
    });
  } catch (error) {
    console.error('Erro:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});