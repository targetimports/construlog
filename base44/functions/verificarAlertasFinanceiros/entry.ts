import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Esta função deve ser executada diariamente via automation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Buscar todos os usuários com permissões financeiras
    const usuarios = await base44.asServiceRole.entities.User.list();
    const contas = await base44.asServiceRole.entities.ContaFinanceira.list();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const usuario of usuarios) {
      // Pular se usuário não tem configuração de notificações
      const config = usuario.notificacoes_financeiras || {
        notificar_vencimento: true,
        dias_antecedencia: 3,
        notificar_vencidas: true,
        notificar_fluxo_negativo: true,
        threshold_fluxo: 10000
      };

      if (!config.notificar_vencimento && !config.notificar_vencidas && !config.notificar_fluxo_negativo) {
        continue;
      }

      // Verificar contas vencendo
      if (config.notificar_vencimento) {
        const diasAntecedencia = new Date(hoje);
        diasAntecedencia.setDate(diasAntecedencia.getDate() + config.dias_antecedencia);

        const contasVencendo = contas.filter(c =>
          c.status === 'pendente' &&
          new Date(c.data_vencimento) >= hoje &&
          new Date(c.data_vencimento) <= diasAntecedencia &&
          (c.created_by === usuario.email || usuario.role === 'admin')
        );

        if (contasVencendo.length > 0) {
          await base44.asServiceRole.functions.invoke('enviarNotificacaoFinanceira', {
            tipo: 'vencimento',
            destinatario: usuario.email,
            mensagem: `Você tem ${contasVencendo.length} contas vencendo nos próximos ${config.dias_antecedencia} dias.`,
            detalhes: {
              quantidade: contasVencendo.length,
              contas: contasVencendo.slice(0, 5).map(c => ({
                descricao: c.descricao,
                valor: c.valor,
                data_vencimento: c.data_vencimento
              }))
            }
          });
        }
      }

      // Verificar contas vencidas
      if (config.notificar_vencidas) {
        const contasVencidas = contas.filter(c =>
          c.status === 'pendente' &&
          new Date(c.data_vencimento) < hoje &&
          (c.created_by === usuario.email || usuario.role === 'admin')
        );

        if (contasVencidas.length > 0) {
          const valorTotal = contasVencidas.reduce((s, c) => s + (c.valor || 0), 0);
          
          await base44.asServiceRole.functions.invoke('enviarNotificacaoFinanceira', {
            tipo: 'vencidas',
            destinatario: usuario.email,
            mensagem: `Você tem ${contasVencidas.length} contas vencidas no valor de ${valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
            detalhes: {
              quantidade: contasVencidas.length,
              valor: valorTotal,
              contas: contasVencidas.slice(0, 5).map(c => ({
                descricao: c.descricao,
                valor: c.valor,
                data_vencimento: c.data_vencimento
              }))
            }
          });
        }
      }

      // Verificar fluxo de caixa negativo
      if (config.notificar_fluxo_negativo) {
        const contasUsuario = contas.filter(c =>
          c.status === 'pendente' &&
          (c.created_by === usuario.email || usuario.role === 'admin')
        );

        const totalReceber = contasUsuario
          .filter(c => c.tipo === 'receber')
          .reduce((s, c) => s + (c.valor || 0), 0);

        const totalPagar = contasUsuario
          .filter(c => c.tipo === 'pagar')
          .reduce((s, c) => s + (c.valor || 0), 0);

        const fluxo = totalReceber - totalPagar;

        if (fluxo < -config.threshold_fluxo) {
          await base44.asServiceRole.functions.invoke('enviarNotificacaoFinanceira', {
            tipo: 'fluxo_negativo',
            destinatario: usuario.email,
            mensagem: `Seu fluxo de caixa está negativo em ${Math.abs(fluxo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
            detalhes: {
              valor: fluxo,
              receber: totalReceber,
              pagar: totalPagar
            }
          });
        }
      }
    }

    return Response.json({ 
      success: true,
      message: 'Verificação de alertas concluída',
      usuarios_processados: usuarios.length
    });
  } catch (error) {
    console.error('Erro ao verificar alertas:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});