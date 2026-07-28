import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Buscar todas as manutenções agendadas
    const manutencoes = await base44.entities.ManutencaoVeiculo.filter(
      { status: 'agendada' },
      '-created_date',
      500
    );

    // Buscar todos os veículos
    const veiculos = await base44.asServiceRole.entities.Veiculo.list();

    const notificacoes = [];
    const hoje = new Date();

    // Verificar cada manutenção
    for (const manutencao of manutencoes) {
      const veiculo = veiculos.find(v => v.id === manutencao.veiculo_id);
      if (!veiculo) continue;

      const dataAgendamento = new Date(manutencao.data_agendamento);
      const diasParaVencer = Math.ceil((dataAgendamento - hoje) / (1000 * 60 * 60 * 24));

      let alerta = null;

      // Alerta 1: Vencimento próximo (3 dias)
      if (diasParaVencer <= 3 && diasParaVencer > 0) {
        alerta = {
          tipo: 'vencimento_proximo',
          severidade: 'media',
          titulo: `Manutenção de ${veiculo.marca} ${veiculo.modelo} vence em ${diasParaVencer} dia(s)`,
          mensagem: `A manutenção ${manutencao.descricao} está agendada para ${dataAgendamento.toLocaleDateString('pt-BR')}`,
          veiculo_id: manutencao.veiculo_id,
          manutencao_id: manutencao.id,
          datas_vencimento: diasParaVencer
        };
      }

      // Alerta 2: Vencimento vencido
      if (diasParaVencer < 0) {
        alerta = {
          tipo: 'vencimento_vencido',
          severidade: 'critica',
          titulo: `URGENTE: Manutenção vencida - ${veiculo.marca} ${veiculo.modelo}`,
          mensagem: `A manutenção "${manutencao.descricao}" venceu há ${Math.abs(diasParaVencer)} dia(s)`,
          veiculo_id: manutencao.veiculo_id,
          manutencao_id: manutencao.id,
          dias_atraso: Math.abs(diasParaVencer)
        };
      }

      // Alerta 3: Proximidade de quilometragem
      if (manutencao.km_proximo && veiculo.km_atual) {
        const kmRestantes = manutencao.km_proximo - veiculo.km_atual;
        
        if (kmRestantes <= 500 && kmRestantes > 0) {
          alerta = {
            tipo: 'proximidade_km',
            severidade: 'media',
            titulo: `Manutenção por km próxima - ${veiculo.marca} ${veiculo.modelo}`,
            mensagem: `Faltam ${kmRestantes} km para a próxima manutenção`,
            veiculo_id: manutencao.veiculo_id,
            manutencao_id: manutencao.id,
            km_restantes: kmRestantes
          };
        }

        if (kmRestantes < 0) {
          alerta = {
            tipo: 'km_vencido',
            severidade: 'critica',
            titulo: `URGENTE: Manutenção por km vencida - ${veiculo.marca} ${veiculo.modelo}`,
            mensagem: `Ultrapassou a quilometragem de manutenção em ${Math.abs(kmRestantes)} km`,
            veiculo_id: manutencao.veiculo_id,
            manutencao_id: manutencao.id,
            km_excedente: Math.abs(kmRestantes)
          };
        }
      }

      if (alerta) {
        notificacoes.push(alerta);

        // Enviar e-mail se severidade for crítica
        if (alerta.severidade === 'critica') {
          try {
            await base44.integrations.Core.SendEmail({
              to: user.email,
              subject: alerta.titulo,
              body: `
                <h2>${alerta.titulo}</h2>
                <p>${alerta.mensagem}</p>
                <p><strong>Veículo:</strong> ${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}</p>
                <p><strong>Tipo de manutenção:</strong> ${manutencao.descricao}</p>
                <p style="margin-top: 20px; color: #666;">
                  Por favor, agende a manutenção o mais breve possível.
                </p>
              `
            });
          } catch (emailError) {
            console.error('Erro ao enviar email:', emailError.message);
          }
        }
      }
    }

    return Response.json({
      success: true,
      notificacoes: notificacoes,
      total: notificacoes.length,
      criticas: notificacoes.filter(n => n.severidade === 'critica').length
    });

  } catch (error) {
    console.error('Erro ao processar notificações:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});