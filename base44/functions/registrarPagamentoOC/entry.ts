import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { oc_id, data_pagamento } = body;

    if (!oc_id) {
      return Response.json({ error: 'oc_id é obrigatório' }, { status: 400 });
    }

    const oc = await base44.entities.OrdemCompra.get(oc_id);
    if (!oc) {
      return Response.json({ error: 'Ordem de compra não encontrada' }, { status: 404 });
    }

    if (oc.status !== 'aprovada') {
      return Response.json({ 
        error: 'Somente OC aprovadas podem ser pagas' 
      }, { status: 400 });
    }

    // Atualizar para paga
    // IMPORTANTE: Pagamento ≠ Recebimento
    // Material NÃO entra no estoque automaticamente
    await base44.entities.OrdemCompra.update(oc_id, {
      status: 'paga',
      status_pagamento: 'pago',
      data_pagamento: data_pagamento || new Date().toISOString()
    });

    // Criar alerta de "material pago e não recebido"
    await base44.entities.AlertaInsumoOrcamento.create({
      tipo_alerta: 'compra_fora_previsto',
      severidade: 'aviso',
      mensagem: `OC ${oc.numero} foi paga mas ainda não foi recebida no almoxarifado`,
      dados_alerta: {
        oc_numero: oc.numero,
        data_pagamento,
        valor: oc.valor_total
      }
    });

    return Response.json({
      oc_id,
      status: 'paga',
      numero_oc: oc.numero,
      valor: oc.valor_total,
      aviso: 'Material não entra em estoque automaticamente. Aguardando confirmação de recebimento.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});