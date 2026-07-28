import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { conta_id, periodo_de, periodo_ate, rateio_id } = await req.json();

    let contasAdm = [];

    // Se conta_id fornecido, processa essa única conta
    if (conta_id) {
      const conta = await base44.entities.ContaFinanceira.filter({ id: conta_id });
      if (!conta || conta.length === 0) {
        return Response.json({ error: 'Conta não encontrada' }, { status: 404 });
      }
      contasAdm = conta;
    } else if (periodo_de && periodo_ate) {
      // Processa período
      contasAdm = await base44.asServiceRole.entities.ContaFinanceira.filter({
        administrativo: true,
        status: 'pago',
        data_pagamento: { $gte: periodo_de, $lte: periodo_ate }
      });
    } else {
      return Response.json({ error: 'conta_id ou (periodo_de e periodo_ate) obrigatórios' }, { status: 400 });
    }

    if (!contasAdm || contasAdm.length === 0) {
      return Response.json({ ok: true, processadas: 0, novosLancamentos: [] });
    }

    // Pega rateio ativo
    let rateioAtivo = null;
    if (rateio_id) {
      const rateios = await base44.asServiceRole.entities.RateioAdministrativo.filter({ id: rateio_id });
      if (rateios && rateios.length > 0) {
        rateioAtivo = rateios[0];
      }
    } else {
      // Tenta encontrar rateio ativo no período
      const rateios = await base44.asServiceRole.entities.RateioAdministrativo.filter({
        ativo: true,
        periodo_de: { $lte: periodo_de || new Date().toISOString().split('T')[0] },
        periodo_ate: { $gte: periodo_ate || new Date().toISOString().split('T')[0] }
      });
      if (rateios && rateios.length > 0) {
        rateioAtivo = rateios[0];
      }
    }

    if (!rateioAtivo) {
      return Response.json({ error: 'RateioAdministrativo não encontrado ou inativo' }, { status: 404 });
    }

    const novosLancamentos = [];
    let processadas = 0;

    // Para cada conta administrativa paga
    for (const conta of contasAdm) {
      // Verifica idempotência: se já há rateio para essa conta
      const existentes = await base44.asServiceRole.entities.ContaFinanceira.filter({
        referencia_tipo: 'rateio',
        referencia_id: conta.id
      });

      if (existentes && existentes.length > 0) {
        // Já foi rateada, pula
        continue;
      }

      // Cria lançamento filho por obra no rateio
      for (const item of rateioAtivo.itens) {
        const lancamento = await base44.asServiceRole.entities.ContaFinanceira.create({
          tipo: conta.tipo,
          descricao: `Rateio: ${conta.descricao}`,
          valor: conta.valor * (item.percentual / 100),
          data_vencimento: conta.data_vencimento,
          data_pagamento: conta.data_pagamento,
          status: 'pago',
          categoria_id: conta.categoria_id,
          centro_custo_id: conta.centro_custo_id,
          obra_id: item.obra_id,
          administrativo: false,
          referencia_tipo: 'rateio',
          referencia_id: conta.id,
          forma_pagamento: conta.forma_pagamento,
          observacao: `Rateio de ${conta.id} pelo rateio ${rateioAtivo.id} (${item.percentual}%)`
        });

        novosLancamentos.push(lancamento.id);
      }

      processadas++;

      // Log auditoria
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        acao: 'aplicar_rateio_administrativo',
        modulo: 'financeiro',
        entidade: 'ContaFinanceira',
        entidade_id: conta.id,
        detalhes: `Rateio aplicado: ${novosLancamentos.length} lançamentos gerados`,
        sucesso: true
      });
    }

    return Response.json({ 
      ok: true, 
      processadas, 
      novosLancamentos,
      rateioId: rateioAtivo.id 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});