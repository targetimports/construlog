import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { apontamento_id, horas_normais, horas_extras, custo_hora_extra, observacao } = body;

    if (!apontamento_id) {
      return Response.json({ error: 'campo obrigatório', field: 'apontamento_id' }, { status: 400 });
    }

    // Ler apontamento
    const apontamento = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento_id);
    if (!apontamento) {
      return Response.json({ error: 'Apontamento não encontrado' }, { status: 404 });
    }

    // Bloquear edição se aprovado
    if (apontamento.status === 'aprovado') {
      return Response.json({
        error: 'Não é permitido editar apontamento aprovado',
        status_atual: apontamento.status
      }, { status: 400 });
    }

    // Dados anteriores para auditoria
    const dadosAnteriores = { ...apontamento };

    // Preparar atualização
    const updates = {};
    if (horas_normais !== undefined) updates.horas_normais = horas_normais;
    if (horas_extras !== undefined) updates.horas_extras = horas_extras;
    if (custo_hora_extra !== undefined) updates.custo_hora_extra = custo_hora_extra;
    if (observacao !== undefined) updates.observacao = observacao;

    // Recalcular custo_total
    const h_norm = horas_normais ?? apontamento.horas_normais;
    const h_extras = horas_extras ?? apontamento.horas_extras;
    const custo_extra = custo_hora_extra ?? apontamento.custo_hora_extra ?? (apontamento.custo_hora * 1.5);
    const custo_total = (h_norm * apontamento.custo_hora) + (h_extras * custo_extra);
    updates.custo_total = custo_total;

    // Update
    const atualizado = await base44.asServiceRole.entities.ApontamentoHora.update(apontamento_id, updates);

    // Confirmar persistência
    const confirm = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento_id);
    if (!confirm) {
      return Response.json({ error: 'PERSISTENCE_FAILED' }, { status: 500 });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'UPDATE',
      modulo: 'RH',
      entidade: 'ApontamentoHora',
      entidade_id: apontamento_id,
      dados_anteriores: dadosAnteriores,
      dados_novos: confirm,
      sucesso: true
    });

    return Response.json({ ok: true, apontamento: confirm }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});