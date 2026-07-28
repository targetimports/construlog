import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { apontamento_id } = body;

    if (!apontamento_id) {
      return Response.json({ error: 'campo obrigatório', field: 'apontamento_id' }, { status: 400 });
    }

    // Ler apontamento
    const apontamento = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento_id);
    if (!apontamento) {
      return Response.json({ error: 'Apontamento não encontrado' }, { status: 404 });
    }

    // Validar status rascunho
    if (apontamento.status !== 'rascunho') {
      return Response.json({
        error: 'Apenas apontamentos em rascunho podem ser aprovados',
        status_atual: apontamento.status
      }, { status: 400 });
    }

    // Dados para auditoria
    const dadosAnteriores = { ...apontamento };

    // Atualizar status
    const agora = new Date().toISOString();
    const atualizado = await base44.asServiceRole.entities.ApontamentoHora.update(apontamento_id, {
      status: 'aprovado',
      aprovado_por: user.email,
      aprovado_em: agora
    });

    // Confirmar persistência
    const confirm = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento_id);
    if (!confirm || confirm.status !== 'aprovado') {
      return Response.json({ error: 'PERSISTENCE_FAILED' }, { status: 500 });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'APPROVE',
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