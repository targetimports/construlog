import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { FunctionLogger } from './_shared/logger.js';

/**
 * Criar Movimentação de Consumo Automaticamente
 * Quando uma Medição é aprovada, cria MovimentacaoEstoque de saída para os insumos consumidos
 */

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const logger = new FunctionLogger('criarMovimentacaoDeConsumo', base44);

  try {
    const user = await base44.auth.me().catch(() => null);
    const { event, data, old_data } = await req.json();

    // Validar evento: deve ser UPDATE de Medicao e status mudar para 'aprovada'
    if (event?.type !== 'update' || event?.entity_name !== 'Medicao') {
      return Response.json({ ok: true, skipped: 'evento_nao_aplicavel' });
    }

    const medicao = data;
    const medicaoAnterior = old_data;

    // Verificar se status mudou para 'aprovada'
    if (medicaoAnterior?.status === 'aprovada' || medicao.status !== 'aprovada') {
      return Response.json({ ok: true, skipped: 'status_nao_mudou_para_aprovada' });
    }

    if (!medicao?.itens || medicao.itens.length === 0) {
      return Response.json({ ok: true, skipped: 'medicao_sem_itens' });
    }

    console.log(`[criarMovimentacaoDeConsumo] Criando movimentações para medição ${medicao.id}...`);

    let movimentacoesCriadas = 0;

    // Criar MovimentacaoEstoque para cada item consumido
    for (const item of medicao.itens) {
      if (!item.insumo_id || !item.quantidade_mediada || item.quantidade_mediada <= 0) {
        continue;
      }

      try {
        const movimentacao = await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          tipo: 'saida',
          insumo_id: item.insumo_id,
          deposito_id: medicao.deposito_id,
          quantidade: item.quantidade_mediada,
          descricao: `Consumo de insumo via Medição ${medicao.id}`,
          referencia_tipo: 'Medicao',
          referencia_id: medicao.id,
          status: 'registrada',
          data_movimentacao: new Date().toISOString(),
          obra_id: medicao.obra_id
        });

        movimentacoesCriadas++;
        console.log(`[criarMovimentacaoDeConsumo] Movimentação ${movimentacao.id} criada para insumo ${item.insumo_id}`);
      } catch (err) {
        console.warn(`[criarMovimentacaoDeConsumo] Erro ao criar movimentação:`, err.message);
      }
    }

    await logger.success(user, { medicao_id: medicao.id }, { movimentacoes_criadas: movimentacoesCriadas });

    return Response.json({
      ok: true,
      movimentacoes_criadas: movimentacoesCriadas,
      message: `${movimentacoesCriadas} movimentação(ões) de consumo criada(s)`
    });
  } catch (error) {
    const user = await base44.auth.me().catch(() => null);
    await logger.error(user, {}, error, 'AUTOMATION_ERROR');
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
});