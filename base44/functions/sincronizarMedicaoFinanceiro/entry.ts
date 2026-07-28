import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Automação: quando OrdemCompra é confirmada ou MedicaoObra é aprovada, cria ContaFinanceira
 * Triggered: EntidadeAutomacao[OrdemCompra ou MedicaoObra, event=create/update]
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Payload de automação de entidade: { event: { type, entity_name, entity_id }, data, old_data }
    const event = payload.event;
    let data = payload.data;

    // Validar estrutura do evento
    if (!event || !event.entity_id || !event.entity_name || !event.type) {
      return Response.json({ error: 'Invalid event' }, { status: 400 });
    }

    // Se data não veio no payload (payload_too_large), buscar manualmente
    if (!data) {
      data = await base44.asServiceRole.entities[event.entity_name]?.get?.(event.entity_id);
    }

    if (!data) {
      return Response.json({ ok: true, skipped: true, reason: 'no data' });
    }

    // Detectar se é OrdemCompra ou MedicaoObra
    const entityName = event.entity_name || '';
    const isOrdemCompra = entityName === 'OrdemCompra' || data.numero_oc !== undefined || data.fornecedor_id !== undefined;
    const isMedicao = entityName === 'MedicaoObra' || data.numero !== undefined;

    let medicao = null;

    if (isOrdemCompra) {
      // Só processar OC confirmada/aprovada
      if (!['confirmada', 'aprovada', 'em_andamento', 'concluida'].includes(data.status)) {
        return Response.json({ ok: true, skipped: true, reason: `OC status ${data.status} não requer criação financeira` });
      }
      // Tratar OrdemCompra como medição para reutilizar lógica abaixo
      medicao = {
        id: data.id,
        obra_id: data.obra_id,
        status: data.status,
        numero: data.numero_oc || data.numero || data.id,
        periodo_inicio: data.data_emissao || data.created_date,
        periodo_fim: data.data_entrega_prevista || data.created_date,
        aprovar_por: data.aprovado_por || 'sistema'
      };
    } else if (isMedicao) {
      // Só processar se mudou para APROVADA
      if (data.status !== 'aprovada') {
        return Response.json({ ok: true, skipped: true });
      }
      medicao = data;
    } else {
      return Response.json({ ok: true, skipped: true, reason: 'entidade não reconhecida' });
    }

    // Buscar itens da medição (se for MedicaoObra real)
    let porCentroCusto = {};

    if (isMedicao) {
      const itens = await base44.asServiceRole.entities.ItemMedicaoObra
        .filter({ medicao_id: medicao.id });

      for (const item of itens) {
        const cc = item.centro_custo_id || 'sem_cc';
        if (!porCentroCusto[cc]) porCentroCusto[cc] = 0;
        porCentroCusto[cc] += (item.valor_medido || 0);
      }
    } else {
      // OrdemCompra: criar uma única conta com o valor total
      const cc = data.centro_custo_id || 'sem_cc';
      porCentroCusto[cc] = data.valor_total || data.valor || 0;
    }

    // Criar conta financeira por centro de custo
    const dataVencimento = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Buscar centro de custo da obra como fallback
    let ccFallback = null;
    if (Object.keys(porCentroCusto).some(k => k === 'sem_cc')) {
      const obra = await base44.asServiceRole.entities.Obra.get(medicao.obra_id).catch(() => null);
      ccFallback = obra?.centro_custo_codigo || null;
    }

    for (const [centro_custo_id, valor] of Object.entries(porCentroCusto)) {
      const ccId = centro_custo_id !== 'sem_cc' ? centro_custo_id : ccFallback;
      if (!ccId) continue; // Não criar conta sem centro de custo se não houver fallback
      await base44.asServiceRole.entities.ContaFinanceiraObra.create({
        obra_id: medicao.obra_id,
        centro_custo_id: ccId,
        tipo: 'a_pagar',
        origem: isOrdemCompra ? 'ordem_compra' : 'medicao',
        origem_id: medicao.id,
        descricao: isOrdemCompra
          ? `Ordem de Compra ${medicao.numero}`
          : `Medição ${medicao.numero} - ${medicao.periodo_inicio} a ${medicao.periodo_fim}`,
        valor,
        data_vencimento: dataVencimento,
        status: 'pendente'
      });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoriaObra.create({
      obra_id: medicao.obra_id,
      usuario_email: medicao.aprovar_por || 'sistema',
      acao: isOrdemCompra ? 'sincronizar_oc' : 'aprovar',
      entidade: isOrdemCompra ? 'ordem_compra' : 'medicao',
      entidade_id: medicao.id,
      descricao: `${isOrdemCompra ? 'OC confirmada' : 'Medição aprovada'}, gerando ${Object.keys(porCentroCusto).length} contas financeiras`
    });

    return Response.json({ 
      ok: true,
      contas_criadas: Object.keys(porCentroCusto).length
    });

  } catch (error) {
    console.error('Sincronização erro:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});