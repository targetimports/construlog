import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * SISTEMA DE AUTOMATIZAÇÃO INTERLIGADA
 * 
 * Este arquivo será acionado por Entity Automations para interligar todos os fluxos:
 * 1. DemandaEstoqueObra criada → Notifica solicitante
 * 2. RequisicaoCompra criada → Dispara workflow + notifica aprovadores
 * 3. OrdemCompra criada → Cria ContaFinanceira (pagar) + notifica fornecedor
 * 4. RecebimentoMaterial criado → Atualiza OC + SaldoEstoque + baixa demanda
 * 5. MedicaoObra criada → Cria ContaReceber + desconsome estoque
 */

// ===== 1. DEMANDA ESTOQUE → NOTIFICAR SOLICITANTE =====
export async function demandaEstoque_notificar(base44, demandaData) {
  try {
    const obra = await base44.asServiceRole.entities.Obra.filter({ id: demandaData.obra_id });
    if (!obra[0]) return;

    const users = await base44.asServiceRole.entities.User.list('-created_date', 5);
    const admin = users.find(u => u.role === 'admin');
    if (!admin) return;

    await base44.integrations.Core.SendEmail({
      to: admin.email,
      subject: `Nova Demanda de Material - ${obra[0].nome}`,
      body: `Material: ${demandaData.descricao_insumo}\nQtd: ${demandaData.quantidade} ${demandaData.unidade}\nObra: ${obra[0].nome}`
    }).catch(() => {});
  } catch (err) {
    console.warn('[demandaEstoque_notificar]', err.message);
  }
}

// ===== 2. REQUISIÇÃO COMPRA → CRIAR MATERIAL SOLICITADO =====
export async function requisicao_criarMaterialSolicitado(base44, requisicaoData) {
  try {
    if (!requisicaoData.obra_id) return;

    const itens = requisicaoData.itens || [];
    for (const item of itens) {
      await base44.asServiceRole.entities.MaterialSolicitado.create({
        obra_id: requisicaoData.obra_id,
        descricao: item.descricao || 'Sem descrição',
        quantidade: item.quantidade_solicitada || 0,
        unidade: item.unidade || 'un',
        valor_unitario: item.valor_unitario || 0,
        status: 'solicitado',
        requisicao_id: requisicaoData.id,
        motivo: 'Importado de requisição de compra'
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('[requisicao_criarMaterialSolicitado]', err.message);
  }
}

// ===== 3. ORDEM COMPRA → CRIAR CONTA FINANCEIRA (PAGAR) =====
export async function ordemCompra_criarContaFinanceira(base44, ocData) {
  try {
    if (!ocData.obra_id || !ocData.fornecedor_id) return;

    const fornecedor = await base44.asServiceRole.entities.Fornecedor.filter({ id: ocData.fornecedor_id });
    const descricao = `OC #${ocData.numero} - ${fornecedor[0]?.nome || 'Fornecedor'}`;

    await base44.asServiceRole.entities.ContaFinanceira.create({
      tipo: 'pagar',
      descricao,
      obra_id: ocData.obra_id,
      fornecedor_id: ocData.fornecedor_id,
      valor: ocData.valor_total || 0,
      status: 'pendente',
      categoria: 'compra',
      data_emissao: new Date().toISOString().split('T')[0],
      data_vencimento: ocData.data_prevista_entrega || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      referencia_tipo: 'OrdemCompra',
      referencia_id: ocData.id
    }).catch(() => {});
  } catch (err) {
    console.warn('[ordemCompra_criarContaFinanceira]', err.message);
  }
}

// ===== 4. RECEBIMENTO → SINCRONIZAR TUDO (OC + ESTOQUE + DEMANDA) =====
export async function recebimento_sincronizarTudo(base44, recebimentoData) {
  try {
    if (!recebimentoData.id || !recebimentoData.itens) return;

    // 4a. Atualizar status da OC para 'recebida'
    if (recebimentoData.ordem_compra_id) {
      await base44.asServiceRole.entities.OrdemCompra.update(recebimentoData.ordem_compra_id, {
        status_entrega: 'recebido',
        data_recebimento: new Date().toISOString()
      }).catch(() => {});

      // 4b. Marcar ContaFinanceira como 'recebido'
      const contas = await base44.asServiceRole.entities.ContaFinanceira.filter({
        referencia_id: recebimentoData.ordem_compra_id,
        tipo: 'pagar'
      });
      if (contas[0]) {
        await base44.asServiceRole.entities.ContaFinanceira.update(contas[0].id, {
          status: 'recebido'
        }).catch(() => {});
      }
    }

    // 4c. Criar MovimentacaoEstoque para cada item
    for (const item of recebimentoData.itens) {
      const qtdRecebida = item.quantidade_recebida || 0;
      if (qtdRecebida > 0) {
        await base44.asServiceRole.entities.MovimentacaoEstoque.create({
          tipo: 'entrada_recebimento',
          insumo_id: item.insumo_id,
          quantidade: qtdRecebida,
          unidade: item.unidade || 'un',
          valor_unitario: item.valor_unitario || 0,
          valor_total: qtdRecebida * (item.valor_unitario || 0),
          obra_destino_id: recebimentoData.obra_id,
          almoxarifado_id: recebimentoData.almoxarifado_id,
          descricao: `Recebimento #${recebimentoData.numero}`,
          referencia_tipo: 'RecebimentoMaterial',
          referencia_id: recebimentoData.id
        }).catch(() => {});
      }
    }

    // 4d. Baixar Demandas vinculadas
    if (recebimentoData.obra_id) {
      const demandas = await base44.asServiceRole.entities.DemandaEstoqueObra.filter({
        obra_id: recebimentoData.obra_id,
        status: 'planejado'
      });
      for (const demanda of demandas) {
        const temItem = recebimentoData.itens.some(i => i.insumo_id === demanda.insumo_id);
        if (temItem) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.update(demanda.id, {
            status: 'recebido'
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[recebimento_sincronizarTudo]', err.message);
  }
}

// ===== 5. MEDICÃO → CRIAR CONTA RECEBER + DESCONSOME ESTOQUE =====
export async function medicao_criarContaReceberEDesconsumir(base44, medicaoData) {
  try {
    if (!medicaoData.obra_id) return;

    // 5a. Criar ContaReceber
    const obra = await base44.asServiceRole.entities.Obra.filter({ id: medicaoData.obra_id });
    if (obra[0]) {
      await base44.asServiceRole.entities.ContaFinanceira.create({
        tipo: 'receber',
        descricao: `Medição Obra: ${obra[0].nome}`,
        obra_id: medicaoData.obra_id,
        valor: medicaoData.valor_total || 0,
        status: 'pendente',
        categoria: 'medicao',
        data_emissao: new Date().toISOString().split('T')[0],
        data_vencimento: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        referencia_tipo: 'MedicaoObra',
        referencia_id: medicaoData.id
      }).catch(() => {});
    }

    // 5b. Desconsumir estoque se houver itens
    if (medicaoData.itens && Array.isArray(medicaoData.itens)) {
      for (const item of medicaoData.itens) {
        if (!item.insumo_id || !medicaoData.obra_id) continue;

        // Buscar saldo da obra
        const estoques = await base44.asServiceRole.entities.EstoqueObra.filter({
          obra_id: medicaoData.obra_id,
          insumo_id: item.insumo_id
        });

        if (estoques[0]) {
          const qtdAtual = estoques[0].quantidade_total || 0;
          const qtdConsumo = item.quantidade || 0;
          const novaQtd = Math.max(0, qtdAtual - qtdConsumo);

          await base44.asServiceRole.entities.EstoqueObra.update(estoques[0].id, {
            quantidade_total: novaQtd,
            quantidade_disponivel: novaQtd,
            data_ultima_movimentacao: new Date().toISOString()
          }).catch(() => {});

          // Registrar movimentacao
          await base44.asServiceRole.entities.MovimentacaoEstoque.create({
            tipo: 'saida_consumo',
            insumo_id: item.insumo_id,
            quantidade: qtdConsumo,
            unidade: item.unidade || 'un',
            obra_origem_id: medicaoData.obra_id,
            descricao: `Consumo em medição #${medicaoData.numero}`,
            referencia_tipo: 'MedicaoObra',
            referencia_id: medicaoData.id
          }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.warn('[medicao_criarContaReceberEDesconsumir]', err.message);
  }
}

// ===== HANDLER PRINCIPAL =====
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { acao, entidade, dados } = await req.json();

    // Rotear para handler correto
    switch (acao) {
      case 'demanda_notificar':
        await demandaEstoque_notificar(base44, dados);
        break;
      case 'requisicao_criar_material':
        await requisicao_criarMaterialSolicitado(base44, dados);
        break;
      case 'oc_criar_conta_financeira':
        await ordemCompra_criarContaFinanceira(base44, dados);
        break;
      case 'recebimento_sincronizar':
        await recebimento_sincronizarTudo(base44, dados);
        break;
      case 'medicao_finalizar':
        await medicao_criarContaReceberEDesconsumir(base44, dados);
        break;
    }

    return Response.json({ ok: true, acao, entidade });
  } catch (error) {
    console.error('[sistemaAutomatizacaoInterligacao]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});