import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { viagem_id } = await req.json();

    if (!viagem_id) {
      return Response.json({ error: 'viagem_id é obrigatório' }, { status: 400 });
    }

    // Buscar viagem
    const viagem = await base44.asServiceRole.entities.Viagem.read(viagem_id);
    if (!viagem) {
      return Response.json({ error: 'Viagem não encontrada' }, { status: 404 });
    }

    const alertasGerados = [];

    // 1. Validar fotos obrigatórias
    if (!viagem.foto_painel_inicial_url) {
      const alerta = await base44.asServiceRole.entities.AlertaViagemIA.create({
        viagem_id,
        tipo_alerta: 'ausencia_foto',
        severidade: 'critico',
        descricao: 'Foto do painel KM inicial não encontrada',
        data_alerta: new Date().toISOString()
      });
      alertasGerados.push(alerta.id);
    }

    if (!viagem.foto_painel_final_url) {
      const alerta = await base44.asServiceRole.entities.AlertaViagemIA.create({
        viagem_id,
        tipo_alerta: 'ausencia_foto',
        severidade: 'critico',
        descricao: 'Foto do painel KM final não encontrada',
        data_alerta: new Date().toISOString()
      });
      alertasGerados.push(alerta.id);
    }

    // 2. Comparar KM rodados com expectativa
    if (viagem.km_rodados && viagem.km_rodados > 0) {
      // Buscar histórico do veículo
      const viagensAntes = await base44.asServiceRole.entities.Viagem.filter({
        veiculo_id: viagem.veiculo_id,
        status: 'finalizada'
      }, '-created_date', 5);

      if (viagensAntes && viagensAntes.length > 0) {
        const kmMedioHistorico = viagensAntes.reduce((sum, v) => sum + (v.km_rodados || 0), 0) / viagensAntes.length;
        const desvio = Math.abs(viagem.km_rodados - kmMedioHistorico) / kmMedioHistorico * 100;

        if (desvio > 50) {
          const alerta = await base44.asServiceRole.entities.AlertaViagemIA.create({
            viagem_id,
            tipo_alerta: 'km_inconsistente',
            severidade: desvio > 100 ? 'critico' : 'aviso',
            descricao: `KM rodados fora do padrão. Histórico: ~${Math.round(kmMedioHistorico)}km, Registrado: ${viagem.km_rodados}km`,
            valor_esperado: kmMedioHistorico,
            valor_observado: viagem.km_rodados,
            percentual_desvio: desvio
          });
          alertasGerados.push(alerta.id);
        }
      }
    }

    // 3. Validar consistência com solicitação
    const solicitacao = await base44.asServiceRole.entities.SolicitacaoTransporte.read(viagem.solicitacao_id);
    if (solicitacao && solicitacao.tipo === 'entrega_obra') {
      if (!viagem.foto_entrega_url) {
        const alerta = await base44.asServiceRole.entities.AlertaViagemIA.create({
          viagem_id,
          tipo_alerta: 'viagem_incompativel',
          severidade: 'aviso',
          descricao: 'Entrega de obra mas sem foto de comprovação do material',
          data_alerta: new Date().toISOString()
        });
        alertasGerados.push(alerta.id);
      }
    }

    // Atualizar viagem com IDs dos alertas
    if (alertasGerados.length > 0) {
      await base44.asServiceRole.entities.Viagem.update(viagem_id, {
        alertas_ia: alertasGerados
      });
    }

    return Response.json({
      success: true,
      viagem_id,
      total_alertas: alertasGerados.length,
      alertas_id: alertasGerados,
      mensagem: `Análise concluída. ${alertasGerados.length} alerta(s) gerado(s).`
    });
  } catch (error) {
    console.error('Erro ao analisar viagem:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});