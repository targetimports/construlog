import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, colaborador_id, equipe_id, data, horas_normais = 0, horas_extras = 0, custo_hora_extra, origem = 'manual', referencia_tipo, referencia_id, observacao } = body;

    // Validações básicas
    if (!obra_id) return Response.json({ error: 'campo obrigatório', field: 'obra_id' }, { status: 400 });
    if (!colaborador_id) return Response.json({ error: 'campo obrigatório', field: 'colaborador_id' }, { status: 400 });
    if (!data) return Response.json({ error: 'campo obrigatório', field: 'data' }, { status: 400 });

    // Validar colaborador existe e está ativo
    const colab = await base44.asServiceRole.entities.Colaborador.get(colaborador_id);
    if (!colab) {
      return Response.json({ error: 'Colaborador não encontrado', field: 'colaborador_id' }, { status: 400 });
    }
    if (colab.status !== 'ativo') {
      return Response.json({ error: 'Colaborador deve estar ativo', field: 'colaborador_id' }, { status: 400 });
    }

    // Validar obra existe
    const obra = await base44.asServiceRole.entities.Obra.get(obra_id);
    if (!obra) {
      return Response.json({ error: 'Obra não encontrada', field: 'obra_id' }, { status: 400 });
    }

    // Resolver custo vigente
    const custos = await base44.asServiceRole.entities.CustoHoraColaborador.filter(
      { colaborador_id, ativo: true },
      '-vigencia_inicio',
      100
    );

    let custoVigente = null;
    if (custos && custos.length > 0) {
      for (const c of custos) {
        const inicio = new Date(c.vigencia_inicio);
        const fim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;
        const dataAp = new Date(data);

        if (dataAp >= inicio && (!fim || dataAp <= fim)) {
          custoVigente = c;
          break;
        }
      }
    }

    if (!custoVigente) {
      return Response.json({
        error: 'custo_hora_nao_configurado',
        message: 'Nenhum custo vigente para este colaborador na data informada',
        field: 'custo_hora'
      }, { status: 400 });
    }

    // Calcular custo_total
    const custo_hora = custoVigente.custo_hora;
    const custo_extra = custo_hora_extra || (custoVigente.custo_hora_extra || custo_hora * 1.5);
    const custo_total = (horas_normais * custo_hora) + (horas_extras * custo_extra);

    // Verificar duplicidade (obra_id + colaborador_id + data + origem + referencia_id)
    const filtro = {
      obra_id,
      colaborador_id,
      data
    };
    if (origem) filtro.origem = origem;
    if (referencia_id) filtro.referencia_id = referencia_id;

    const existentes = await base44.asServiceRole.entities.ApontamentoHora.filter(filtro, '-created_date', 10);
    if (existentes && existentes.length > 0) {
      return Response.json({
        ok: true,
        noop: true,
        id_existente: existentes[0].id,
        message: 'Apontamento já existe para este dia'
      }, { status: 200 });
    }

    // Criar apontamento
    const apontamento = await base44.asServiceRole.entities.ApontamentoHora.create({
      obra_id,
      colaborador_id,
      equipe_id,
      data,
      horas_normais,
      horas_extras,
      custo_hora,
      custo_hora_extra: custo_extra !== custo_hora * 1.5 ? custo_extra : null,
      custo_total,
      origem,
      referencia_tipo,
      referencia_id,
      status: 'rascunho',
      observacao
    });

    // Confirmar persistência
    const confirm = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento.id);
    if (!confirm) {
      return Response.json({ error: 'PERSISTENCE_FAILED' }, { status: 500 });
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'CREATE',
      modulo: 'RH',
      entidade: 'ApontamentoHora',
      entidade_id: apontamento.id,
      dados_novos: apontamento,
      sucesso: true
    });

    return Response.json({ ok: true, apontamento }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});