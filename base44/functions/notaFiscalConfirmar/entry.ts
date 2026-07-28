import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * POST /notaFiscalConfirmar
 * Confirma NF (status=CONFIRMADO) e, se almox_destino_id estiver preenchido,
 * gera automaticamente um movimento ENTRADA no almoxarifado destino.
 *
 * Payload:
 * {
 *   documento_fiscal_id: "nf-123",
 *   almox_destino_id: "local-estoque-id" (opcional — se informado, gera ENTRADA),
 *   obra_id: "obra-id" (opcional — registrado para relatórios),
 *   itens_estoque: [{ material_id, material_nome, material_unidade, qtd, custo_unit }] (opcional)
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

    const { documento_fiscal_id, almox_destino_id, obra_id, itens_estoque } = await req.json();

    if (!documento_fiscal_id) {
      return Response.json({ error: 'documento_fiscal_id é obrigatório' }, { status: 400 });
    }

    // Buscar NF
    const nfList = await base44.entities.NotaFiscal.list();
    const nf = nfList.find(n => n.id === documento_fiscal_id);

    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    if (!nf.numero || !nf.data_emissao || !nf.emissor_nome) {
      return Response.json({
        error: 'Preencha número, data e emissor antes de confirmar'
      }, { status: 400 });
    }

    let movimentacao_id = null;

    // Se almox_destino_id informado e há itens, gerar movimento ENTRADA
    if (almox_destino_id && itens_estoque && itens_estoque.length > 0) {
      const itensValidos = itens_estoque.filter(it => it.material_id && parseFloat(it.qtd) > 0);

      if (itensValidos.length > 0) {
        // Criar cabeçalho do movimento
        const mov = await base44.asServiceRole.entities.EstoqueMovimentacao.create({
          data_mov: new Date().toISOString(),
          tipo: 'ENTRADA',
          almox_origem_id: null,
          almox_destino_id,
          obra_id: obra_id || null,
          documento_ref: `NF-${nf.numero}`,
          responsavel_id: user.email,
          observacao: `Entrada automática via confirmação NF ${nf.numero} — ${nf.emissor_nome}`,
          status: 'CONCLUIDO'
        });

        movimentacao_id = mov.id;

        // Criar itens e atualizar saldos
        for (const item of itensValidos) {
          const qtd = parseFloat(item.qtd);
          const custoUnit = parseFloat(item.custo_unit || 0);

          await base44.asServiceRole.entities.EstoqueMovimentacaoItem.create({
            movimentacao_id: mov.id,
            material_id: item.material_id,
            material_nome: item.material_nome || '',
            material_unidade: item.material_unidade || '',
            qtd,
            custo_unit: custoUnit,
            custo_total: qtd * custoUnit
          });

          // Atualizar saldo no destino
          await upsertSaldo(base44, almox_destino_id, item, qtd, custoUnit);
        }
      }
    }

    // Atualizar NF com status CONFIRMADO + vínculo ao movimento + almox_destino + obra_id
    const updateData = {
      status: 'CONFIRMADO',
      almox_destino_id: almox_destino_id || nf.almox_destino_id || null,
      obra_id: obra_id || nf.obra_id || null,
    };
    if (movimentacao_id) {
      updateData.movimentacao_estoque_id = movimentacao_id;
    }

    const nfAtualizada = await base44.entities.NotaFiscal.update(documento_fiscal_id, updateData);

    // Registrar auditoria
    await base44.asServiceRole.entities.NotaFiscalAuditoria.create({
      documento_fiscal_id,
      user_id: user.email,
      user_nome: user.full_name || user.email,
      acao: 'CONFIRMACAO',
      campo_alterado: 'status',
      valor_antigo: nf.status,
      valor_novo: 'CONFIRMADO',
      motivo: movimentacao_id
        ? `Confirmação com entrada automática no almoxarifado (mov: ${movimentacao_id})`
        : 'Confirmação manual do usuário',
    });

    return Response.json({
      nf: nfAtualizada,
      movimentacao_id,
      estoque_atualizado: !!movimentacao_id
    });
  } catch (error) {
    console.error('Erro ao confirmar NF:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

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
  } else {
    const saldo = saldos[0];
    const saldoAtual = parseFloat(saldo.saldo_atual || 0);
    const novoSaldo = Math.max(0, saldoAtual + delta);

    let novoCusto = parseFloat(saldo.custo_unitario_medio || 0);
    if (delta > 0 && custoUnit && custoUnit > 0) {
      const valorAnterior = saldoAtual * novoCusto;
      const valorNovo = delta * custoUnit;
      novoCusto = (saldoAtual + delta) > 0
        ? (valorAnterior + valorNovo) / (saldoAtual + delta)
        : custoUnit;
    }

    await base44.asServiceRole.entities.SaldoEstoque.update(saldo.id, {
      saldo_atual: novoSaldo,
      custo_unitario_medio: novoCusto,
      valor_total_estoque: novoSaldo * novoCusto,
      data_ultima_movimentacao: now
    });
  }
}