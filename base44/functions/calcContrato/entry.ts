import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { trunc2 } from './_lib/calcUtils.js';

/**
 * calcContrato(contrato_versao_id)
 *
 * 1. Recalcula preco_total de cada ContratoItem
 * 2. Atualiza ContratoVersao.total_contrato = SUM(preco_total)
 *
 * Pode ser chamado:
 *   - Manualmente via endpoint (admin)
 *   - Automaticamente pela automação onContratoItemChange
 */
async function calcContrato(base44, contrato_versao_id) {
  // 1. Buscar todos os itens da versão
  const itens = await base44.entities.ContratoItem.filter({ contrato_versao_id });

  if (!itens || itens.length === 0) {
    // Ainda assim zerar o total do contrato
    await base44.entities.ContratoVersao.update(contrato_versao_id, { total_contrato: 0 });
    return { total_contrato: 0, itens_recalculados: 0 };
  }

  // 2. Recalcular preco_total de cada item e salvar se mudou
  let total_contrato = 0;
  const updates = [];

  for (const item of itens) {
    const novo_preco_total = trunc2((item.qtd_contrato ?? 0) * (item.preco_unit_com_bdi ?? 0));
    total_contrato += novo_preco_total;

    if (item.preco_total !== novo_preco_total) {
      updates.push(
        base44.entities.ContratoItem.update(item.id, { preco_total: novo_preco_total })
      );
    }
  }

  // 3. Executar updates de itens em paralelo
  if (updates.length > 0) {
    await Promise.all(updates);
  }

  // 4. Atualizar total do contrato
  const total_final = trunc2(total_contrato);
  await base44.entities.ContratoVersao.update(contrato_versao_id, { total_contrato: total_final });

  return {
    total_contrato: total_final,
    itens_recalculados: updates.length,
    total_itens: itens.length,
  };
}

// ─── Endpoint HTTP ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { contrato_versao_id } = body;

    if (!contrato_versao_id) {
      return Response.json({ error: 'contrato_versao_id é obrigatório' }, { status: 400 });
    }

    const result = await calcContrato(base44, contrato_versao_id);

    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});