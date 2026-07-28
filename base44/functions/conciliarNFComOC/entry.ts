import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { nota_fiscal_id } = payload;

    if (!nota_fiscal_id) {
      return Response.json({ error: 'nota_fiscal_id obrigatório' }, { status: 400 });
    }

    const nf = await base44.asServiceRole.entities.NotaFiscal.get(nota_fiscal_id);
    if (!nf) {
      return Response.json({ error: 'NF não encontrada' }, { status: 404 });
    }

    // Buscar OCs da obra
    const ocs = await base44.asServiceRole.entities.OrdemCompra.filter({
      obra_id: nf.obra_id
    });

    const itensNF = await base44.asServiceRole.entities.NotaFiscalItem.filter({
      nota_fiscal_id
    });

    const conciliados = [];
    const alertas = [];

    // Tentar vincular itens NF com OC
    for (const itemNF of itensNF) {
      // Buscar OC similar por produto ou descrição
      let ocEncontrada = null;

      for (const oc of ocs) {
        if (!oc.itens) continue;

        for (const itemOC of oc.itens) {
          if (itemNF.produto_id && itemOC.produto_id === itemNF.produto_id) {
            ocEncontrada = { oc_id: oc.id, item_oc: itemOC };
            break;
          }

          // Fallback: comparar descrição
          if (!itemNF.produto_id && 
              (itemNF.descricao || '').toLowerCase().includes((itemOC.descricao || '').toLowerCase())) {
            ocEncontrada = { oc_id: oc.id, item_oc: itemOC };
            break;
          }
        }

        if (ocEncontrada) break;
      }

      if (ocEncontrada) {
        // Validar quantidade
        const qtdOC = ocEncontrada.item_oc.quantidade_aprovada || 0;
        const qtdNF = itemNF.quantidade || 0;

        if (Math.abs(qtdNF - qtdOC) > 0.01) {
          alertas.push(`Item "${itemNF.descricao}": OC espera ${qtdOC}, NF tem ${qtdNF}`);
        }

        // Vincular
        await base44.asServiceRole.entities.NotaFiscalItem.update(itemNF.id, {
          ordem_compra_id: ocEncontrada.oc_id
        });

        conciliados.push({
          item_nf_id: itemNF.id,
          oc_id: ocEncontrada.oc_id
        });
      } else if (itemNF.categoria === 'MATERIAL') {
        alertas.push(`Item "${itemNF.descricao}": Nenhuma OC encontrada`);
      }
    }

    // Comparar com OrcamentoPlanejadoEtapa
    const etapas = await base44.asServiceRole.entities.EtapaObra.filter({
      obra_id: nf.obra_id
    });

    for (const itemNF of itensNF) {
      if (itemNF.categoria !== 'MATERIAL') continue;

      for (const etapa of etapas) {
        const planejamentos = await base44.asServiceRole.entities.PlanejamentoInsumosEtapa.filter({
          etapa_obra_id: etapa.id,
          produto_id: itemNF.produto_id
        });

        for (const plan of planejamentos) {
          const consumido = plan.consumido_anterior || 0;
          const planejado = plan.quantidade_planejada || 0;
          const novoTotal = consumido + (itemNF.quantidade || 0);

          if (novoTotal > planejado * 1.1) { // 10% de tolerância
            alertas.push(
              `Etapa "${etapa.nome}": Item excede 10% do planejado (planejado: ${planejado}, será: ${novoTotal})`
            );
          }
        }
      }
    }

    // Log auditoria
    await base44.asServiceRole.entities.AuditLogNF.create({
      nota_fiscal_id,
      acao: 'CONCILIACAO_PROCESSADA',
      usuario_email: user.email,
      descricao: `${conciliados.length} itens conciliados. ${alertas.length} alertas.`
    });

    return Response.json({
      message: 'Conciliação processada',
      conciliados,
      alertas: alertas.length > 0 ? alertas : null
    });
  } catch (error) {
    console.error('❌ Erro ao conciliar NF:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});