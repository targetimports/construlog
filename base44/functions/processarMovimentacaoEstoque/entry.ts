import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * processarMovimentacaoEstoque
 * 
 * ═══════════════════════════════════════════════════════════════════
 * REGRA CARDINAL:
 *   Esta função NUNCA cria/altera MovimentacaoTesouraria ou ContaTesouraria.
 *   Movimentações de estoque (ENTRADA, SAIDA, TRANSFERENCIA, AJUSTE, ESTORNO)
 *   afetam SOMENTE saldos de estoque (SaldoEstoque) e custo da obra.
 *   Apenas eventos de PAGAMENTO/RECEBIMENTO (via pagarContaPagar, darBaixaRecebimento,
 *   tesourariaMovimentar) alteram Tesouraria/Caixa.
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Suporta:
 *  - ENTRADA, SAIDA, TRANSFERENCIA, AJUSTE, ESTORNO
 *  - Auditoria completa: saldo_antes/saldo_depois por item, custo congelado
 *  - Bloqueio de saldo negativo (via LocalEstoque.permite_saldo_negativo)
 *  - Estorno: gera movimento inverso PROCESSADO, original permanece PROCESSADA
 *    com metadados (estornado_por_id, estornado_em). Idempotente: não permite
 *    estornar duas vezes a mesma movimentação.
 * 
 * Payload (movimentação):
 * {
 *   tipo: 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA' | 'AJUSTE',
 *   almox_origem_id, almox_destino_id, obra_id, documento_ref, observacao,
 *   itens: [{ material_id, material_nome, material_unidade, qtd, custo_unit, lote? }]
 * }
 * 
 * Payload (estorno):
 * {
 *   action: 'estornar',
 *   movimentacao_id: string,
 *   motivo: string
 * }
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();

    // ═══════════════════════════════════════════════
    // ACTION: ESTORNAR movimentação existente
    // ═══════════════════════════════════════════════
    if (payload.action === 'estornar') {
      return await processarEstorno(base44, user, payload);
    }

    // ═══════════════════════════════════════════════
    // ACTION: PROCESSAR nova movimentação
    // ═══════════════════════════════════════════════
    return await processarMovimentacao(base44, user, payload);

  } catch (error) {
    console.error('[processarMovimentacaoEstoque]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});


// ═══════════════════════════════════════════════════════════
// PROCESSAR MOVIMENTAÇÃO (ENTRADA / SAIDA / TRANSFERENCIA / AJUSTE)
// Nunca toca Tesouraria — só SaldoEstoque.
// ═══════════════════════════════════════════════════════════
async function processarMovimentacao(base44, user, payload) {
  const { tipo, almox_origem_id, almox_destino_id, obra_id, documento_ref, observacao, itens } = payload;
  const now = new Date().toISOString();

  // ── Validações básicas ──
  if (!tipo || !itens || !Array.isArray(itens) || itens.length === 0) {
    return Response.json({ error: 'tipo e itens são obrigatórios' }, { status: 400 });
  }

  if (tipo === 'ENTRADA' && !almox_destino_id) {
    return Response.json({ error: 'ENTRADA requer almox_destino_id' }, { status: 400 });
  }
  if (tipo === 'SAIDA' && !almox_origem_id) {
    return Response.json({ error: 'SAIDA requer almox_origem_id' }, { status: 400 });
  }
  if (tipo === 'TRANSFERENCIA' && (!almox_origem_id || !almox_destino_id)) {
    return Response.json({ error: 'TRANSFERENCIA requer almox_origem_id e almox_destino_id' }, { status: 400 });
  }
  if (tipo === 'TRANSFERENCIA' && almox_origem_id === almox_destino_id) {
    return Response.json({ error: 'Origem e destino não podem ser o mesmo almoxarifado' }, { status: 400 });
  }

  // ── Buscar metadados dos locais ──
  let localOrigem = null, localDestino = null;
  if (almox_origem_id) {
    const arr = await base44.asServiceRole.entities.LocalEstoque.filter({ id: almox_origem_id });
    localOrigem = arr[0] || null;
  }
  if (almox_destino_id) {
    const arr = await base44.asServiceRole.entities.LocalEstoque.filter({ id: almox_destino_id });
    localDestino = arr[0] || null;
  }

  // ── Validar saldo para SAIDA e TRANSFERENCIA ──
  if (tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') {
    const permiteNegativo = localOrigem?.permite_saldo_negativo === true;

    for (const item of itens) {
      if (!item.material_id || !item.qtd || item.qtd <= 0) {
        return Response.json({ error: `Item inválido: ${JSON.stringify(item)}` }, { status: 400 });
      }

      const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({
        local_estoque_id: almox_origem_id,
        material_id: item.material_id
      });

      const saldoAtual = saldos[0]?.saldo_atual ?? 0;
      if (!permiteNegativo && saldoAtual < item.qtd) {
        const matNome = item.material_nome || item.material_id;
        return Response.json({
          error: `Saldo insuficiente para "${matNome}": disponível ${saldoAtual}, solicitado ${item.qtd}. Local não permite saldo negativo.`
        }, { status: 422 });
      }
    }
  }

  // ── Gerar número de documento ──
  const numeroDoc = `MOV-${Date.now().toString(36).toUpperCase()}`;

  // ── Calcular valor total (para referência, NÃO afeta caixa) ──
  const valorTotal = itens.reduce((s, it) => s + (parseFloat(it.qtd) * parseFloat(it.custo_unit || 0)), 0);

  const movimentacao = await base44.entities.EstoqueMovimentacao.create({
    data_mov: now,
    tipo,
    status: 'PROCESSADA',
    numero_documento: numeroDoc,
    almox_origem_id: almox_origem_id || null,
    almox_destino_id: almox_destino_id || null,
    almox_origem_nome: localOrigem?.nome || null,
    almox_destino_nome: localDestino?.nome || null,
    origem_tipo: localOrigem?.tipo || null,
    destino_tipo: localDestino?.tipo || null,
    obra_id: obra_id || null,
    empresa_id: localOrigem?.empresa_id || localDestino?.empresa_id || null,
    documento_ref: documento_ref || null,
    observacao: observacao || '',
    criado_por: user.email,
    criado_em: now,
    processado_por: user.email,
    processado_em: now,
    responsavel_id: user.email,
    valor_total_movimentacao: valorTotal,
    qtd_itens: itens.length
  });

  // ── Criar itens e atualizar APENAS saldos de estoque ──
  // IMPORTANTE: Nenhuma linha abaixo cria MovimentacaoTesouraria.
  for (const item of itens) {
    const qtd = parseFloat(item.qtd);
    const custoInformado = parseFloat(item.custo_unit || 0);

    // Determinar custo unitário aplicado (congelado)
    let custoAplicado = custoInformado;

    // Para TRANSFERENCIA/SAIDA: usar custo médio da origem se não informado
    if ((tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') && custoAplicado === 0) {
      const saldosOrig = await base44.asServiceRole.entities.SaldoEstoque.filter({
        local_estoque_id: almox_origem_id,
        material_id: item.material_id
      });
      custoAplicado = saldosOrig[0]?.custo_unitario_medio || 0;
    }

    // ── Capturar saldos ANTES ──
    let saldoAntesOrigem = null, saldoAntesDestino = null;
    if (almox_origem_id && (tipo === 'SAIDA' || tipo === 'TRANSFERENCIA')) {
      const so = await base44.asServiceRole.entities.SaldoEstoque.filter({
        local_estoque_id: almox_origem_id,
        material_id: item.material_id
      });
      saldoAntesOrigem = so[0]?.saldo_atual ?? 0;
    }
    if (almox_destino_id && (tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA')) {
      const sd = await base44.asServiceRole.entities.SaldoEstoque.filter({
        local_estoque_id: almox_destino_id,
        material_id: item.material_id
      });
      saldoAntesDestino = sd[0]?.saldo_atual ?? 0;
    }

    // ── Atualizar saldos (SOMENTE SaldoEstoque, ZERO tesouraria) ──
    let saldoDepoisOrigem = saldoAntesOrigem;
    let saldoDepoisDestino = saldoAntesDestino;

    if (tipo === 'SAIDA' || tipo === 'TRANSFERENCIA') {
      saldoDepoisOrigem = await upsertSaldo(base44, almox_origem_id, item, -qtd, null);
    }
    if (tipo === 'ENTRADA' || tipo === 'TRANSFERENCIA') {
      saldoDepoisDestino = await upsertSaldo(base44, almox_destino_id, item, qtd, custoAplicado);
    }
    if (tipo === 'AJUSTE') {
      const almoxId = almox_destino_id || almox_origem_id;
      if (almoxId) {
        saldoDepoisDestino = await upsertSaldo(base44, almoxId, item, qtd, custoAplicado);
      }
    }

    // ── Criar item com auditoria completa ──
    await base44.entities.EstoqueMovimentacaoItem.create({
      movimentacao_id: movimentacao.id,
      material_id: item.material_id,
      material_nome: item.material_nome || '',
      material_unidade: item.material_unidade || '',
      qtd,
      custo_unit: custoInformado,
      custo_unitario_aplicado: custoAplicado,
      custo_total: qtd * custoAplicado,
      local_origem_id: almox_origem_id || null,
      local_destino_id: almox_destino_id || null,
      lote: item.lote || null,
      saldo_antes_origem: saldoAntesOrigem,
      saldo_depois_origem: saldoDepoisOrigem,
      saldo_antes_destino: saldoAntesDestino,
      saldo_depois_destino: saldoDepoisDestino,
      saldo_antes: saldoAntesOrigem ?? saldoAntesDestino,
      saldo_depois: saldoDepoisOrigem ?? saldoDepoisDestino
    });
  }

  // ═══════════════════════════════════════════════════════
  // NENHUMA movimentação de Tesouraria é criada aqui.
  // Compra paga → pagarContaPagar → MovimentacaoTesouraria
  // Transferência → SOMENTE SaldoEstoque
  // ═══════════════════════════════════════════════════════

  return Response.json({
    success: true,
    movimentacao_id: movimentacao.id,
    numero_documento: numeroDoc,
    tipo,
    status: 'PROCESSADA',
    itens_processados: itens.length,
    valor_total: valorTotal,
    _regra: 'Nenhuma movimentação de Tesouraria foi criada. Apenas saldos de estoque foram alterados.'
  });
}


// ═══════════════════════════════════════════════════════════
// ESTORNO — gera movimento inverso PROCESSADO.
// A movimentação original PERMANECE como PROCESSADA,
// mas recebe metadados: estornado_por_id + estornado_em.
// Idempotente: se já tem estornado_por_id, rejeita.
// ═══════════════════════════════════════════════════════════
async function processarEstorno(base44, user, payload) {
  const { movimentacao_id, motivo } = payload;
  const now = new Date().toISOString();

  if (!movimentacao_id) {
    return Response.json({ error: 'movimentacao_id é obrigatório para estorno' }, { status: 400 });
  }

  // Buscar movimentação original
  const movs = await base44.asServiceRole.entities.EstoqueMovimentacao.filter({ id: movimentacao_id });
  const movOriginal = movs[0];
  if (!movOriginal) {
    return Response.json({ error: 'Movimentação não encontrada' }, { status: 404 });
  }

  if (movOriginal.status !== 'PROCESSADA') {
    return Response.json({ 
      error: `Só é possível estornar movimentações PROCESSADAS. Status atual: ${movOriginal.status}` 
    }, { status: 400 });
  }

  // ── Idempotência: rejeitar se já foi estornada ──
  if (movOriginal.estornado_por_id) {
    return Response.json({ 
      error: `Movimentação já foi estornada pela movimentação ${movOriginal.estornado_por_id}`,
      estorno_existente_id: movOriginal.estornado_por_id
    }, { status: 409 });
  }

  // Buscar itens originais
  const itensOriginais = await base44.asServiceRole.entities.EstoqueMovimentacaoItem.filter({
    movimentacao_id: movimentacao_id
  });

  if (itensOriginais.length === 0) {
    return Response.json({ error: 'Movimentação sem itens, não pode ser estornada' }, { status: 400 });
  }

  // Gerar número de doc do estorno
  const numeroDoc = `EST-${Date.now().toString(36).toUpperCase()}`;

  // Criar cabeçalho de estorno (inverte origem/destino para reverter)
  const movEstorno = await base44.entities.EstoqueMovimentacao.create({
    data_mov: now,
    tipo: 'ESTORNO',
    status: 'PROCESSADA',
    numero_documento: numeroDoc,
    // Invertemos para reverter: o que era destino vira origem e vice-versa
    almox_origem_id: movOriginal.almox_destino_id || null,
    almox_destino_id: movOriginal.almox_origem_id || null,
    almox_origem_nome: movOriginal.almox_destino_nome || null,
    almox_destino_nome: movOriginal.almox_origem_nome || null,
    origem_tipo: movOriginal.destino_tipo || null,
    destino_tipo: movOriginal.origem_tipo || null,
    obra_id: movOriginal.obra_id || null,
    obra_nome: movOriginal.obra_nome || null,
    empresa_id: movOriginal.empresa_id || null,
    documento_ref: `ESTORNO de ${movOriginal.numero_documento || movOriginal.id}`,
    observacao: motivo || `Estorno da movimentação ${movOriginal.numero_documento || movOriginal.id}`,
    criado_por: user.email,
    criado_em: now,
    processado_por: user.email,
    processado_em: now,
    responsavel_id: user.email,
    estorno_de_id: movOriginal.id,
    valor_total_movimentacao: movOriginal.valor_total_movimentacao || 0,
    qtd_itens: itensOriginais.length
  });

  // Processar itens de estorno (inverter movimentos de saldo)
  for (const itemOrig of itensOriginais) {
    const qtd = parseFloat(itemOrig.qtd || 0);
    const custoAplicado = parseFloat(itemOrig.custo_unitario_aplicado || itemOrig.custo_unit || 0);
    const tipoOrig = movOriginal.tipo;

    let saldoAntesOrigem = null, saldoAntesDestino = null;
    let saldoDepoisOrigem = null, saldoDepoisDestino = null;

    // Inverter: o estorno DESFAZ o efeito original
    // Original SAIDA reduziu almox_origem → estorno AUMENTA almox_origem
    // Original ENTRADA aumentou almox_destino → estorno REDUZ almox_destino
    // Original TRANSFERENCIA: fez ambos → estorno inverte ambos

    if (tipoOrig === 'SAIDA' || tipoOrig === 'TRANSFERENCIA') {
      // Original reduziu almox_origem → estorno aumenta (almox_origem vira destino do estorno)
      if (movOriginal.almox_origem_id) {
        const so = await base44.asServiceRole.entities.SaldoEstoque.filter({
          local_estoque_id: movOriginal.almox_origem_id,
          material_id: itemOrig.material_id
        });
        saldoAntesDestino = so[0]?.saldo_atual ?? 0;
        saldoDepoisDestino = await upsertSaldo(base44, movOriginal.almox_origem_id, itemOrig, qtd, custoAplicado);
      }
    }

    if (tipoOrig === 'ENTRADA' || tipoOrig === 'TRANSFERENCIA') {
      // Original aumentou almox_destino → estorno reduz (almox_destino vira origem do estorno)
      if (movOriginal.almox_destino_id) {
        const sd = await base44.asServiceRole.entities.SaldoEstoque.filter({
          local_estoque_id: movOriginal.almox_destino_id,
          material_id: itemOrig.material_id
        });
        saldoAntesOrigem = sd[0]?.saldo_atual ?? 0;
        saldoDepoisOrigem = await upsertSaldo(base44, movOriginal.almox_destino_id, itemOrig, -qtd, null);
      }
    }

    if (tipoOrig === 'AJUSTE') {
      const almoxId = movOriginal.almox_destino_id || movOriginal.almox_origem_id;
      if (almoxId) {
        const sa = await base44.asServiceRole.entities.SaldoEstoque.filter({
          local_estoque_id: almoxId,
          material_id: itemOrig.material_id
        });
        saldoAntesOrigem = sa[0]?.saldo_atual ?? 0;
        saldoDepoisOrigem = await upsertSaldo(base44, almoxId, itemOrig, -qtd, null);
      }
    }

    // Criar item de estorno com auditoria
    await base44.entities.EstoqueMovimentacaoItem.create({
      movimentacao_id: movEstorno.id,
      material_id: itemOrig.material_id,
      material_nome: itemOrig.material_nome || '',
      material_unidade: itemOrig.material_unidade || '',
      qtd,
      custo_unit: custoAplicado,
      custo_unitario_aplicado: custoAplicado,
      custo_total: qtd * custoAplicado,
      local_origem_id: movOriginal.almox_destino_id || null,
      local_destino_id: movOriginal.almox_origem_id || null,
      saldo_antes_origem: saldoAntesOrigem,
      saldo_depois_origem: saldoDepoisOrigem,
      saldo_antes_destino: saldoAntesDestino,
      saldo_depois_destino: saldoDepoisDestino
    });
  }

  // ═══════════════════════════════════════════════════════
  // IMPORTANTE: A original PERMANECE como PROCESSADA.
  // Apenas adicionamos metadados de estorno para rastreio.
  // ═══════════════════════════════════════════════════════
  await base44.asServiceRole.entities.EstoqueMovimentacao.update(movOriginal.id, {
    estornado_por_id: movEstorno.id,
    estornado_em: now
  });

  return Response.json({
    success: true,
    estorno_id: movEstorno.id,
    numero_documento: numeroDoc,
    movimentacao_original_id: movOriginal.id,
    movimentacao_original_status: 'PROCESSADA',
    itens_estornados: itensOriginais.length,
    _regra: 'Original permanece PROCESSADA com metadados de estorno. Nenhuma movimentação de Tesouraria foi criada.'
  });
}


// ═══════════════════════════════════════════════════════════
// UPSERT SALDO — retorna novo saldo
// Altera SOMENTE SaldoEstoque. ZERO impacto em Tesouraria.
// ═══════════════════════════════════════════════════════════
async function upsertSaldo(base44, localEstoqueId, item, delta, custoUnit) {
  const saldos = await base44.asServiceRole.entities.SaldoEstoque.filter({
    local_estoque_id: localEstoqueId,
    material_id: item.material_id
  });

  const now = new Date().toISOString();

  if (saldos.length === 0) {
    const novoSaldo = Math.max(0, delta);
    const custo = custoUnit || 0;
    await base44.asServiceRole.entities.SaldoEstoque.create({
      local_estoque_id: localEstoqueId,
      material_id: item.material_id,
      material_nome: item.material_nome || '',
      material_unidade: item.material_unidade || '',
      saldo_atual: novoSaldo,
      custo_unitario_medio: custo,
      valor_total_estoque: novoSaldo * custo,
      data_ultima_movimentacao: now
    });
    return novoSaldo;
  } else {
    const saldo = saldos[0];
    const saldoAtual = parseFloat(saldo.saldo_atual || 0);

    const novoSaldo = saldoAtual + delta;
    const saldoFinal = Math.max(0, novoSaldo);

    // Atualizar custo médio ponderado apenas em entradas (delta > 0)
    let novoCusto = parseFloat(saldo.custo_unitario_medio || 0);
    if (delta > 0 && custoUnit && custoUnit > 0) {
      const valorAnterior = saldoAtual * novoCusto;
      const valorNovo = delta * custoUnit;
      novoCusto = (saldoAtual + delta) > 0
        ? (valorAnterior + valorNovo) / (saldoAtual + delta)
        : custoUnit;
    }

    await base44.asServiceRole.entities.SaldoEstoque.update(saldo.id, {
      saldo_atual: saldoFinal,
      custo_unitario_medio: novoCusto,
      valor_total_estoque: saldoFinal * novoCusto,
      data_ultima_movimentacao: now
    });

    return saldoFinal;
  }
}