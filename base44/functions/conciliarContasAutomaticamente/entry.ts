import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.js';

/**
 * Conciliar Contas Automaticamente
 * Quando um MovimentacaoEstoque é criada, procura ContaFinanceira com valor/data correspondente
 * e marca como conciliada
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('conciliarContasAutomaticamente', base44);

  try {
    const user = await base44.auth.me().catch(() => null);
    const { event, data } = await req.json();

    // Validar evento
    if (event?.type !== 'create' || event?.entity_name !== 'MovimentacaoEstoque') {
      return Response.json({ ok: true, skipped: 'evento_nao_aplicavel' });
    }

    const movimentacao = data;
    if (!movimentacao?.valor || !movimentacao?.data_movimentacao) {
      return Response.json({ ok: true, skipped: 'dados_insuficientes' });
    }

    console.log(`[conciliarContasAutomaticamente] Procurando contas para conciliar...`);

    // Buscar contas com valor e data correspondentes
    const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({
      valor: movimentacao.valor,
      status: 'pendente'
    }).catch(() => []);

    let conciliadas = 0;

    for (const conta of contas) {
      // Verificar se data está próxima (mesma data)
      const contaData = new Date(conta.data_movimentacao).toDateString();
      const movData = new Date(movimentacao.data_movimentacao).toDateString();

      if (contaData === movData && !conta.conciliada) {
        try {
          await base44.asServiceRole.entities.ContaFinanceira.update(conta.id, {
            status: 'conciliado',
            conciliada: true,
            data_conciliacao: new Date().toISOString(),
            descricao: `${conta.descricao} [Conciliada via MovimentacaoEstoque ${movimentacao.id}]`
          });
          conciliadas++;
          console.log(`[conciliarContasAutomaticamente] Conta ${conta.id} conciliada`);
        } catch (err) {
          console.warn(`[conciliarContasAutomaticamente] Erro ao conciliar ${conta.id}:`, err.message);
        }
      }
    }

    await logger.success(user, { movimentacao_id: movimentacao.id }, { contas_conciliadas: conciliadas });

    return Response.json({
      ok: true,
      contas_conciliadas: conciliadas,
      message: `${conciliadas} conta(s) conciliada(s) automaticamente`
    });
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'AUTOMATION_ERROR');
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});