import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { profissionaisIds, obraId, dataInicio, dataFim } = await req.json();

    // 1. Buscar diários de obra no período
    const diarios = await base44.entities.DiarioObra?.filter?.({
      obra_id: obraId,
      status: 'finalizado'
    }) || [];

    const diariosFiltragem = diarios.filter(d => {
      const data = new Date(d.data);
      return data >= new Date(dataInicio) && data <= new Date(dataFim);
    });

    // 2. Processar mão de obra dos diários
    const remuneracoes = {};

    for (const diario of diariosFiltragem) {
      if (!diario.mao_obra) continue;

      for (const mo of diario.mao_obra) {
        // Filtrar por profissionais selecionados
        if (profissionaisIds.length > 0 && !profissionaisIds.includes(mo.colaborador_id)) {
          continue;
        }

        if (!remuneracoes[mo.colaborador_id]) {
          remuneracoes[mo.colaborador_id] = {
            colaborador_id: mo.colaborador_id,
            nome: mo.nome,
            funcao: mo.funcao,
            dias_trabalhados: 0,
            valor_diaria: 0,
            obras: {},
            total_valor: 0
          };
        }

        // Buscar valor da diária
        const profissionais = await base44.entities.Colaborador?.filter?.({ id: mo.colaborador_id });
        const prof = profissionais?.[0];
        const valorDiaria = prof?.valor_remuneracao || 0;

        remuneracoes[mo.colaborador_id].dias_trabalhados += (mo.quantidade || 1);
        remuneracoes[mo.colaborador_id].valor_diaria = valorDiaria;

        // Agrupar por obra
        if (!remuneracoes[mo.colaborador_id].obras[obraId]) {
          remuneracoes[mo.colaborador_id].obras[obraId] = {
            dias: 0,
            valor: 0
          };
        }

        remuneracoes[mo.colaborador_id].obras[obraId].dias += (mo.quantidade || 1);
        remuneracoes[mo.colaborador_id].obras[obraId].valor = 
          remuneracoes[mo.colaborador_id].obras[obraId].dias * valorDiaria;

        remuneracoes[mo.colaborador_id].total_valor = 
          remuneracoes[mo.colaborador_id].dias_trabalhados * valorDiaria;
      }
    }

    // 3. Preparar dados para o relatório
    const dados = Object.values(remuneracoes).map(rem => ({
      nome: rem.nome,
      funcao: rem.funcao,
      valor_diaria: rem.valor_diaria,
      dias_trabalhados: rem.dias_trabalhados,
      total_a_pagar: rem.total_valor,
      obras: Object.entries(rem.obras).map(([obraId, dados]) => ({
        obra_id: obraId,
        dias: dados.dias,
        valor: dados.valor
      }))
    }));

    const totalGeral = dados.reduce((acc, d) => acc + d.total_a_pagar, 0);

    return Response.json({
      sucesso: true,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      diarios_processados: diariosFiltragem.length,
      profissionais: dados.length,
      dados,
      total_geral: totalGeral,
      pronto_para_export: dados.length > 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});