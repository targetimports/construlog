/**
 * Processa alteração de quantidade de item quando NF é aplicada em pedido multi-obra
 * Atualiza rateios mantendo proporções ou marcando para revisão
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { pedidoId, itemId, qtdAnterior, qtdNova, rateiosAtuais } = payload;

    if (!pedidoId || !itemId || qtdAnterior === undefined || qtdNova === undefined) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Calcular fator de ajuste
    const fatorAjuste = qtdNova / (qtdAnterior || 1);
    const rateiosAjustados = (rateiosAtuais || []).map((r) => ({
      ...r,
      quantidade: r.quantidade * fatorAjuste,
    }));

    // Verificar se ajuste mantém consistência (soma = qtd nova)
    const somaRateios = rateiosAjustados.reduce((sum, r) => sum + r.quantidade, 0);
    const divergencia = Math.abs(qtdNova - somaRateios) > 0.01;

    // Registrar evento
    await base44.entities.LogAuditoria.create({
      entidade: 'PedidoCompra',
      entidade_id: pedidoId,
      usuario_email: user.email,
      acao: 'AJUSTAR_RATEIO_NF',
      descricao: `Item ${itemId}: quantidade ${qtdAnterior} → ${qtdNova}. Rateio ${divergencia ? 'DIVERGENTE' : 'AJUSTADO'}`,
      detalhes: JSON.stringify({
        fatorAjuste,
        rateiosAjustados,
        divergencia,
        somaRateios,
      }),
      data_hora: new Date().toISOString(),
    });

    return Response.json({
      sucesso: true,
      rateiosAjustados,
      divergencia,
      somaRateios,
      requisitoRevisao: divergencia,
    });
  } catch (error) {
    console.error('[processarAlterqaoNFComRateio]', error);
    return Response.json(
      {
        sucesso: false,
        erro: error.message,
      },
      { status: 500 }
    );
  }
});