import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Recalcula alertas financeiros usando ContaFinanceira
 * Alertas:
 * - Contas vencendo em X dias
 * - Contas atrasadas
 * - Contas com saldo restante (parcial)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dias_antecedencia = 7, obra_id = null } = await req.json().catch(() => ({}));

    console.log('[Alertas Financeiros] Recalculando...', { dias_antecedencia, obra_id });

    const hoje = new Date();
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() + dias_antecedencia);

    // Buscar todas as contas financeiras
    const contas = await base44.asServiceRole.entities.ContaFinanceira.list();

    const alertasGerados = [];

    // Filtrar contas pendentes ou parciais
    const contasPendentes = contas.filter(c => 
      (c.status === 'pendente' || c.status === 'parcial' || c.status === 'aberto') &&
      c.status !== 'cancelado' &&
      c.status !== 'pendente_aprovacao' &&
      (!obra_id || c.obra_id === obra_id)
    );

    for (const conta of contasPendentes) {
      const dataVencimento = new Date(conta.data_vencimento);
      const diasRestantes = Math.ceil((dataVencimento - hoje) / (1000 * 60 * 60 * 24));
      
      const valorTotal = parseFloat(conta.valor) || 0;
      const valorPago = parseFloat(conta.valor_pago || conta.valor_recebido || 0) || 0;
      const valorRestante = valorTotal - valorPago;

      if (valorRestante <= 0) continue; // Já foi paga totalmente

      let mensagem = '';
      let severidade = 'INFO';
      let codigo_problema = '';

      // Conta atrasada
      if (diasRestantes < 0) {
        codigo_problema = 'CONTA_ATRASADA';
        severidade = 'CRITICAL';
        mensagem = `Conta ${conta.tipo === 'pagar' ? 'a pagar' : 'a receber'} ATRASADA: ${conta.descricao || 'Sem descrição'} - ${conta.fornecedor_cliente || 'Sem fornecedor/cliente'}. Valor restante: R$ ${valorRestante.toFixed(2)}. Vencimento: ${conta.data_vencimento}. ${Math.abs(diasRestantes)} dias de atraso.${conta.obra_id ? ' Obra: ' + conta.obra_id : ' (Administrativo)'}`;
      }
      // Conta vencendo em breve
      else if (diasRestantes <= dias_antecedencia) {
        codigo_problema = 'CONTA_VENCENDO';
        severidade = diasRestantes <= 3 ? 'HIGH' : 'MEDIUM';
        mensagem = `Conta ${conta.tipo === 'pagar' ? 'a pagar' : 'a receber'} vencendo em ${diasRestantes} dias: ${conta.descricao || 'Sem descrição'} - ${conta.fornecedor_cliente || 'Sem fornecedor/cliente'}. Valor restante: R$ ${valorRestante.toFixed(2)}. Vencimento: ${conta.data_vencimento}.${conta.obra_id ? ' Obra: ' + conta.obra_id : ' (Administrativo)'}`;
      }

      if (mensagem) {
        // Gerar alerta usando função de dedup
        try {
          const alertaRes = await base44.functions.invoke('gerarAlertasComDedupAtomica', {
            tipo_alerta: 'FINANCEIRO',
            obra_id: conta.obra_id || null,
            codigo_problema,
            mensagem_base: mensagem,
            severidade
          });

          alertasGerados.push({
            conta_id: conta.id,
            codigo_problema,
            mensagem,
            severidade,
            alerta_res: alertaRes.data
          });
        } catch (e) {
          console.error('[Alertas Financeiros] Erro ao gerar alerta:', e.message);
        }
      }
    }

    console.log('[Alertas Financeiros] Gerados:', alertasGerados.length);

    return Response.json({
      success: true,
      contas_analisadas: contasPendentes.length,
      alertas_gerados: alertasGerados.length,
      alertas: alertasGerados
    });

  } catch (error) {
    console.error('[Alertas Financeiros] Erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});