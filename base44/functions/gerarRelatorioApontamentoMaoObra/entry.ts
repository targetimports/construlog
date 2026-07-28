import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obraIds, dataInicio, dataFim, profissionaisIds, tipo } = await req.json();

    // 1. Buscar diários do período
    const query = {
      data: { $gte: dataInicio, $lte: dataFim },
      status: 'finalizado'
    };

    if (obraIds?.length) {
      query.obra_id = { $in: obraIds };
    }

    const diarios = await base44.entities.DiarioObra.filter(query, 'data');

    // 2. Processar dados
    const dados = {
      analitico: [],
      sintetico: {}
    };

    diarios.forEach(diario => {
      diario.mao_obra?.forEach(profissional => {
        const filtrarProfissional = !profissionaisIds?.length || profissionaisIds.includes(profissional.id);
        
        if (!filtrarProfissional) return;

        // ANALÍTICO
        dados.analitico.push({
          data: diario.data,
          funcao: profissional.funcao,
          profissional: profissional.nome,
          tipo_recurso: profissional.tipo || 'profissional',
          obra: diario.obra_id,
          quantidade: profissional.quantidade || 1,
          observacoes: profissional.observacoes || '',
          ocorrencias: diario.ocorrencias_detalhadas?.map(o => o.tipo).join(', ') || ''
        });

        // SINTÉTICO
        const chave = `${profissional.funcao}|${profissional.nome}`;
        if (!dados.sintetico[chave]) {
          dados.sintetico[chave] = {
            funcao: profissional.funcao,
            profissional: profissional.nome,
            total_dias: 0,
            obras: new Set()
          };
        }
        dados.sintetico[chave].total_dias += profissional.quantidade || 1;
        dados.sintetico[chave].obras.add(diario.obra_id);
      });
    });

    // 3. Converter sintético
    const sinteticoArray = Object.values(dados.sintetico).map(item => ({
      funcao: item.funcao,
      profissional: item.profissional,
      total_dias_trabalhados: parseFloat(item.total_dias.toFixed(1)),
      obras: Array.from(item.obras).join(', ')
    }));

    // 4. Validações
    const validacoes = [];
    
    // Verificar duplicatas
    const duplicatas = dados.analitico.filter((v, i, a) => 
      a.filter(x => x.data === v.data && x.profissional === v.profissional && x.obra === v.obra).length > 1
    );
    
    if (duplicatas.length > 0) {
      validacoes.push({
        tipo: 'aviso',
        mensagem: `${duplicatas.length} registro(s) duplicado(s) detectado(s)`,
        registros: duplicatas.slice(0, 5)
      });
    }

    return Response.json({
      sucesso: true,
      tipo,
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo: {
        total_diarios: diarios.length,
        total_registros: dados.analitico.length,
        profissionais_unicos: sinteticoArray.length,
        dias_trabalhados: sinteticoArray.reduce((acc, p) => acc + p.total_dias_trabalhados, 0)
      },
      [tipo === 'analitico' ? 'dados' : 'dados']: tipo === 'analitico' ? dados.analitico : sinteticoArray,
      validacoes
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});