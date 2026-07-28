import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { colaborador_id, vigencia_inicio, vigencia_fim, custo_hora, custo_hora_extra, observacao } = body;

    // Validações
    if (!colaborador_id) return Response.json({ error: 'campo obrigatório', field: 'colaborador_id' }, { status: 400 });
    if (!vigencia_inicio) return Response.json({ error: 'campo obrigatório', field: 'vigencia_inicio' }, { status: 400 });
    if (!custo_hora) return Response.json({ error: 'campo obrigatório', field: 'custo_hora' }, { status: 400 });

    // Validar colaborador
    const colab = await base44.asServiceRole.entities.Colaborador.get(colaborador_id);
    if (!colab) {
      return Response.json({ error: 'Colaborador não encontrado' }, { status: 404 });
    }

    // Buscar custos anteriores para desativar
    const custos = await base44.asServiceRole.entities.CustoHoraColaborador.filter(
      { colaborador_id, ativo: true },
      '-vigencia_inicio',
      100
    );

    const dataNovaInicio = new Date(vigencia_inicio);
    const dataNovaFim = vigencia_fim ? new Date(vigencia_fim) : null;

    // Desativar custos que se sobrepõem
    if (custos && custos.length > 0) {
      for (const c of custos) {
        const dataInicio = new Date(c.vigencia_inicio);
        const dataFim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;

        // Verificar sobreposição
        const sobrepoe = (dataInicio <= dataNovaFim || !dataNovaFim) && (!dataFim || dataFim >= dataNovaInicio);
        if (sobrepoe) {
          await base44.asServiceRole.entities.CustoHoraColaborador.update(c.id, { ativo: false });
        }
      }
    }

    // Criar novo custo
    const novoCusto = await base44.asServiceRole.entities.CustoHoraColaborador.create({
      colaborador_id,
      vigencia_inicio,
      vigencia_fim,
      custo_hora,
      custo_hora_extra,
      ativo: true,
      observacao
    });

    // Confirmar persistência
    const confirm = await base44.asServiceRole.entities.CustoHoraColaborador.get(novoCusto.id);
    if (!confirm) {
      return Response.json({ error: 'PERSISTENCE_FAILED' }, { status: 500 });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'CREATE',
      modulo: 'RH',
      entidade: 'CustoHoraColaborador',
      entidade_id: novoCusto.id,
      dados_novos: confirm,
      sucesso: true
    });

    return Response.json({ ok: true, custo: confirm }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});