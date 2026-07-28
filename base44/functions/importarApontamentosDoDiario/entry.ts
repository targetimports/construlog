import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { obra_id, de, ate } = body;

    if (!obra_id) return Response.json({ error: 'campo obrigatório', field: 'obra_id' }, { status: 400 });
    if (!de || !ate) return Response.json({ error: 'campos obrigatórios', fields: ['de', 'ate'] }, { status: 400 });

    // Buscar diários da obra
    const diarios = await base44.asServiceRole.entities.DiarioObra.filter(
      { obra_id },
      '-data',
      1000
    );

    let resultado = diarios || [];

    // Filtrar por período
    resultado = resultado.filter(d => {
      const data = new Date(d.data);
      return data >= new Date(de) && data <= new Date(ate);
    });

    let criados = 0;
    let noops = 0;
    let ignorados = 0;

    // Processar cada diário
    for (const diario of resultado) {
      if (!diario.mao_obra || diario.mao_obra.length === 0) {
        ignorados++;
        continue;
      }

      // Para cada colaborador no diário
      for (const moObra of diario.mao_obra) {
        if (!moObra.colaborador_id) {
          ignorados++;
          continue;
        }

        // Verificar se já existe apontamento
        const existentes = await base44.asServiceRole.entities.ApontamentoHora.filter({
          obra_id,
          colaborador_id: moObra.colaborador_id,
          data: diario.data,
          origem: 'diario',
          referencia_id: diario.id
        }, '-created_date', 10);

        if (existentes && existentes.length > 0) {
          noops++;
          continue;
        }

        // Validar colaborador existe e está ativo
        const colab = await base44.asServiceRole.entities.Colaborador.get(moObra.colaborador_id);
        if (!colab || colab.status !== 'ativo') {
          ignorados++;
          continue;
        }

        // Buscar custo vigente
        const custos = await base44.asServiceRole.entities.CustoHoraColaborador.filter(
          { colaborador_id: moObra.colaborador_id, ativo: true },
          '-vigencia_inicio',
          10
        );

        let custoVigente = null;
        if (custos && custos.length > 0) {
          for (const c of custos) {
            const inicio = new Date(c.vigencia_inicio);
            const fim = c.vigencia_fim ? new Date(c.vigencia_fim) : null;
            const dataAp = new Date(diario.data);

            if (dataAp >= inicio && (!fim || dataAp <= fim)) {
              custoVigente = c;
              break;
            }
          }
        }

        if (!custoVigente) {
          ignorados++;
          continue;
        }

        // Considerar quantidade do diário como horas normais
        const horas_normais = moObra.quantidade || 0;
        const custo_hora = custoVigente.custo_hora;
        const custo_extra = custoVigente.custo_hora_extra || (custo_hora * 1.5);
        const custo_total = horas_normais * custo_hora;

        // Criar apontamento
        try {
          const apontamento = await base44.asServiceRole.entities.ApontamentoHora.create({
            obra_id,
            colaborador_id: moObra.colaborador_id,
            data: diario.data,
            horas_normais,
            horas_extras: 0,
            custo_hora,
            custo_hora_extra: custo_extra !== custo_hora * 1.5 ? custo_extra : null,
            custo_total,
            origem: 'diario',
            referencia_tipo: 'diario_obra',
            referencia_id: diario.id,
            status: 'rascunho'
          });

          // Confirmar persistência
          const confirm = await base44.asServiceRole.entities.ApontamentoHora.get(apontamento.id);
          if (confirm) {
            criados++;
          }
        } catch (e) {
          ignorados++;
        }
      }
    }

    // Log auditoria
    await base44.asServiceRole.entities.LogAuditoria.create({
      user_email: user.email,
      acao: 'IMPORT',
      modulo: 'RH',
      entidade: 'ApontamentoHora',
      detalhes: `Importação do Diário de Obra: criados=${criados}, noops=${noops}, ignorados=${ignorados}`,
      sucesso: true
    });

    return Response.json({
      ok: true,
      resumo: {
        criados,
        noops,
        ignorados,
        total_processados: resultado.length
      }
    }, { status: 200 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});