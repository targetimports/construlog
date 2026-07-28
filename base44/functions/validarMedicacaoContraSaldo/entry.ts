import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contratoId, novoValorMedicao } = await req.json();

    // 1. Buscar contrato
    const contratos = await base44.entities.Contrato.filter({ id: contratoId });
    const contrato = contratos[0];

    if (!contrato) {
      return Response.json({ error: 'Contrato não encontrado' }, { status: 404 });
    }

    // 2. Buscar medições aprovadas
    const medicoes = await base44.entities.ItemMedicao?.filter?.({
      contrato_id: contratoId,
      status: 'aprovada'
    }) || [];

    const totalMedido = medicoes.reduce((acc, m) => acc + (m.valor_total || 0), 0);
    const novoTotal = totalMedido + novoValorMedicao;

    // 3. Validar contra saldo disponível
    const saldoDisponivel = contrato.valor_total - totalMedido;
    const ultrapassa = novoTotal > contrato.valor_total;

    return Response.json({
      validacao: {
        permitido: !ultrapassa,
        valor_contrato: contrato.valor_total,
        total_medido: totalMedido,
        novo_valor_medicao: novoValorMedicao,
        novo_total: novoTotal,
        saldo_disponivel: saldoDisponivel,
        ultrapassa,
        mensagem: ultrapassa 
          ? `Essa medição ultrapassará o contrato em R$ ${(novoTotal - contrato.valor_total).toFixed(2)}`
          : `Saldo disponível: R$ ${(saldoDisponivel - novoValorMedicao).toFixed(2)}`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});