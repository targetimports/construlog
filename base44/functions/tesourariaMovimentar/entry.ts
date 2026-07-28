import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── ACTION: criar_conta ──
    if (action === 'criar_conta') {
      const { nome, tipo, banco, agencia, numero_conta, obra_id, saldo_inicial, data_saldo_inicial, permite_saldo_negativo, empresa_id } = body;
      const conta = await base44.entities.ContaTesouraria.create({
        empresa_id: empresa_id || '',
        nome,
        tipo,
        banco: banco || '',
        agencia: agencia || '',
        numero_conta: numero_conta || '',
        obra_id: obra_id || '',
        saldo_inicial: saldo_inicial || 0,
        data_saldo_inicial: data_saldo_inicial || new Date().toISOString().split('T')[0],
        saldo_inicial_bloqueado: false,
        saldo_atual: saldo_inicial || 0,
        total_entradas: 0,
        total_saidas: 0,
        permite_saldo_negativo: permite_saldo_negativo || false,
        status: 'ativa'
      });
      return Response.json({ ok: true, conta });
    }

    // ── ACTION: bloquear_saldo_inicial ──
    if (action === 'bloquear_saldo_inicial') {
      const { conta_id } = body;
      await base44.entities.ContaTesouraria.update(conta_id, { saldo_inicial_bloqueado: true });
      return Response.json({ ok: true });
    }

    // ── ACTION: movimentar (entrada, saída, transferência) ──
    if (action === 'movimentar') {
      const { conta_id, conta_destino_id, tipo, valor, data_movimentacao, categoria, descricao, obra_id, referencia_tipo, referencia_id, forma_pagamento, numero_documento, empresa_id } = body;

      if (!conta_id || !tipo || !valor || valor <= 0) {
        return Response.json({ error: 'Dados inválidos: conta_id, tipo e valor > 0 são obrigatórios' }, { status: 400 });
      }

      // Buscar conta origem
      const contas = await base44.entities.ContaTesouraria.filter({ id: conta_id });
      const contaOrigem = contas[0];
      if (!contaOrigem) return Response.json({ error: 'Conta origem não encontrada' }, { status: 404 });
      if (contaOrigem.status !== 'ativa') return Response.json({ error: 'Conta origem não está ativa' }, { status: 400 });

      const saldoAnteriorOrigem = contaOrigem.saldo_atual || 0;

      // Validar saldo negativo para saída/transferência
      if ((tipo === 'saida' || tipo === 'transferencia') && !contaOrigem.permite_saldo_negativo) {
        if (saldoAnteriorOrigem - valor < 0) {
          return Response.json({ error: `Saldo insuficiente. Saldo atual: R$ ${saldoAnteriorOrigem.toFixed(2)}, Valor: R$ ${valor.toFixed(2)}` }, { status: 400 });
        }
      }

      // Calcular novos saldos
      let novoSaldoOrigem = saldoAnteriorOrigem;
      let totalEntradasOrigem = contaOrigem.total_entradas || 0;
      let totalSaidasOrigem = contaOrigem.total_saidas || 0;

      if (tipo === 'entrada') {
        novoSaldoOrigem += valor;
        totalEntradasOrigem += valor;
      } else if (tipo === 'saida' || tipo === 'transferencia') {
        novoSaldoOrigem -= valor;
        totalSaidasOrigem += valor;
      }

      // Criar movimentação
      const mov = await base44.entities.MovimentacaoTesouraria.create({
        empresa_id: empresa_id || contaOrigem.empresa_id || '',
        conta_id,
        conta_destino_id: conta_destino_id || '',
        obra_id: obra_id || contaOrigem.obra_id || '',
        tipo,
        valor,
        data_movimentacao: data_movimentacao || new Date().toISOString().split('T')[0],
        categoria: categoria || 'outro',
        descricao,
        referencia_tipo: referencia_tipo || 'manual',
        referencia_id: referencia_id || '',
        forma_pagamento: forma_pagamento || '',
        numero_documento: numero_documento || '',
        saldo_anterior: saldoAnteriorOrigem,
        saldo_posterior: novoSaldoOrigem,
        status: 'confirmada',
        aprovado_por: user.email
      });

      // Atualizar conta origem
      await base44.entities.ContaTesouraria.update(conta_id, {
        saldo_atual: novoSaldoOrigem,
        total_entradas: totalEntradasOrigem,
        total_saidas: totalSaidasOrigem
      });

      // Se transferência, atualizar conta destino
      if (tipo === 'transferencia' && conta_destino_id) {
        const contasDestino = await base44.entities.ContaTesouraria.filter({ id: conta_destino_id });
        const contaDestino = contasDestino[0];
        if (contaDestino) {
          const saldoAnteriorDestino = contaDestino.saldo_atual || 0;
          const novoSaldoDestino = saldoAnteriorDestino + valor;

          // Criar movimentação espelho na conta destino
          await base44.entities.MovimentacaoTesouraria.create({
            empresa_id: empresa_id || contaDestino.empresa_id || '',
            conta_id: conta_destino_id,
            conta_destino_id: '',
            obra_id: obra_id || contaDestino.obra_id || '',
            tipo: 'entrada',
            valor,
            data_movimentacao: data_movimentacao || new Date().toISOString().split('T')[0],
            categoria: 'transferencia_interna',
            descricao: `Transferência de ${contaOrigem.nome}: ${descricao}`,
            referencia_tipo: 'manual',
            referencia_id: mov.id,
            forma_pagamento: forma_pagamento || '',
            saldo_anterior: saldoAnteriorDestino,
            saldo_posterior: novoSaldoDestino,
            status: 'confirmada',
            aprovado_por: user.email
          });

          await base44.entities.ContaTesouraria.update(conta_destino_id, {
            saldo_atual: novoSaldoDestino,
            total_entradas: (contaDestino.total_entradas || 0) + valor
          });
        }
      }

      return Response.json({ ok: true, movimentacao_id: mov.id, saldo_anterior: saldoAnteriorOrigem, saldo_posterior: novoSaldoOrigem });
    }

    // ── ACTION: get_resumo ──
    if (action === 'get_resumo') {
      const contas = await base44.entities.ContaTesouraria.filter({ status: 'ativa' });
      const totalGeral = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);
      const totalBancos = contas.filter(c => c.tipo.startsWith('banco_')).reduce((s, c) => s + (c.saldo_atual || 0), 0);
      const totalCaixa = contas.filter(c => c.tipo === 'caixa').reduce((s, c) => s + (c.saldo_atual || 0), 0);
      const totalObras = contas.filter(c => c.tipo === 'conta_obra').reduce((s, c) => s + (c.saldo_atual || 0), 0);

      return Response.json({
        ok: true,
        resumo: { totalGeral, totalBancos, totalCaixa, totalObras, qtd_contas: contas.length },
        contas
      });
    }

    // ── ACTION: get_fluxo_projetado ──
    if (action === 'get_fluxo_projetado') {
      const { meses_projecao } = body;
      const numMeses = meses_projecao || 6;

      // Buscar contas ativas
      const contas = await base44.entities.ContaTesouraria.filter({ status: 'ativa' });
      const saldoAtualTotal = contas.reduce((s, c) => s + (c.saldo_atual || 0), 0);

      // Buscar contas a pagar pendentes
      const contasPagar = await base44.entities.ContaFinanceira.filter({ tipo: 'pagar', status: 'pendente' });
      // Buscar contas a receber pendentes
      const contasReceber = await base44.entities.ContaFinanceira.filter({ tipo: 'receber', status: 'pendente' });
      // Buscar recebimentos previstos
      const recebimentos = await base44.entities.RecebimentoPrevisto.filter({ status: 'PREVISTO' });

      const hoje = new Date();
      const projecao = [];
      let saldoProjetado = saldoAtualTotal;

      for (let i = 0; i < numMeses; i++) {
        const mesDate = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
        const mesStr = mesDate.toISOString().slice(0, 7);
        const mesLabel = mesDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });

        // Somar contas a pagar do mês
        const saidasMes = contasPagar
          .filter(c => c.data_vencimento && c.data_vencimento.startsWith(mesStr))
          .reduce((s, c) => s + (c.valor || 0) - (c.valor_pago || 0), 0);

        // Somar contas a receber do mês
        const entradasContasReceber = contasReceber
          .filter(c => c.data_vencimento && c.data_vencimento.startsWith(mesStr))
          .reduce((s, c) => s + (c.valor || 0) - (c.valor_recebido || 0), 0);

        // Somar recebimentos previstos do mês
        const entradasRecebimentos = recebimentos
          .filter(r => r.data_prevista && r.data_prevista.startsWith(mesStr))
          .reduce((s, r) => s + (r.valor_previsto || 0), 0);

        const entradasMes = entradasContasReceber + entradasRecebimentos;
        saldoProjetado = saldoProjetado + entradasMes - saidasMes;

        projecao.push({
          mes: mesStr,
          label: mesLabel,
          entradas: entradasMes,
          saidas: saidasMes,
          saldo_projetado: saldoProjetado,
          alerta: saldoProjetado < 0 ? 'insuficiencia' : saldoProjetado < saidasMes * 0.2 ? 'atencao' : 'ok'
        });
      }

      return Response.json({ ok: true, saldo_atual: saldoAtualTotal, projecao });
    }

    return Response.json({ error: 'Action inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});