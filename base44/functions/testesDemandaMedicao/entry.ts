import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * TESTES A/B/C PARA VALIDAÇÃO:
 * A) Executar gerarDemandaEstoqueDaObra 2x com mesmos dados → verificar IDEMPOTÊNCIA
 * B) Executar confirmarMedicao 2x com mesma medicao_id → verificar IDEMPOTÊNCIA
 * C) Verificar que não há DUPLICAÇÃO em ConsumoInsumo (chave medicao_item_id+insumo_id)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { obra_id, teste_tipo } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    const resultados = {
      teste_tipo: teste_tipo || 'completo',
      obra_id,
      timestamp: new Date().toISOString(),
      testes: []
    };

    // TESTE A: Idempotência gerarDemandaEstoqueDaObra
    if (!teste_tipo || teste_tipo === 'A') {
      const tesA = { nome: 'A - Idempotência gerarDemandaEstoqueDaObra', passou: false, detalhes: [] };
      
      try {
        const exec1 = await base44.functions.invoke('gerarDemandaEstoqueDaObra', {
          obra_id,
          profundidade_maxima: 3
        });

        const exec2 = await base44.functions.invoke('gerarDemandaEstoqueDaObra', {
          obra_id,
          profundidade_maxima: 3
        });

        // Verificar que os totais são iguais (idempotência)
        const totalInsumos1 = exec1.data?.resultado?.demandas?.length || 0;
        const totalInsumos2 = exec2.data?.resultado?.demandas?.length || 0;

        tesA.detalhes.push({
          execucao: 1,
          insumos_gerados: totalInsumos1
        });
        tesA.detalhes.push({
          execucao: 2,
          insumos_gerados: totalInsumos2
        });

        if (totalInsumos1 === totalInsumos2) {
          tesA.passou = true;
          tesA.detalhes.push({ resultado: 'PASSOU - Totais iguais, sem duplicação' });
        } else {
          tesA.detalhes.push({ resultado: 'FALHOU - Totais diferentes!' });
        }
      } catch (err) {
        tesA.detalhes.push({ erro: err.message });
      }

      resultados.testes.push(tesA);
    }

    // TESTE B: Idempotência confirmarMedicao
    if (!teste_tipo || teste_tipo === 'B') {
      const tesB = { nome: 'B - Idempotência confirmarMedicao', passou: false, detalhes: [] };

      try {
        // Buscar primeira medição não-processada
        const medicoes = await base44.asServiceRole.entities.Medicao.filter({
          obra_id,
          status: { $ne: 'processada' }
        });

        if (!medicoes || medicoes.length === 0) {
          tesB.detalhes.push({ aviso: 'Nenhuma medição não-processada encontrada' });
        } else {
          const medicao = medicoes[0];

          const exec1 = await base44.functions.invoke('confirmarMedicao', {
            medicao_id: medicao.id
          });

          const exec2 = await base44.functions.invoke('confirmarMedicao', {
            medicao_id: medicao.id
          });

          tesB.detalhes.push({
            execucao: 1,
            status: exec1.data?.status,
            consumos_gerados: exec1.data?.consumos_gerados || 0
          });
          tesB.detalhes.push({
            execucao: 2,
            status: exec2.data?.status,
            consumos_gerados: exec2.data?.consumos_gerados || 0
          });

          // Segunda execução deve retornar 'ja_processada'
          if (exec2.data?.status === 'ja_processada') {
            tesB.passou = true;
            tesB.detalhes.push({ resultado: 'PASSOU - Idempotência detectada' });
          } else {
            tesB.detalhes.push({ resultado: 'FALHOU - Segunda execução não foi idempotente' });
          }
        }
      } catch (err) {
        tesB.detalhes.push({ erro: err.message });
      }

      resultados.testes.push(tesB);
    }

    // TESTE C: Verificar duplicação em ConsumoInsumo
    if (!teste_tipo || teste_tipo === 'C') {
      const tesC = { nome: 'C - Sem duplicação em ConsumoInsumo', passou: false, detalhes: [] };

      try {
        const consumos = await base44.asServiceRole.entities.ConsumoInsumo.filter({
          obra_id
        });

        if (!consumos || consumos.length === 0) {
          tesC.detalhes.push({ aviso: 'Nenhum consumo encontrado' });
          tesC.passou = true;
        } else {
          // Verificar UNIQUE (medicao_item_id + insumo_id)
          const chaves = {};
          let duplicados = 0;

          for (const consumo of consumos) {
            const chave = `${consumo.medicao_item_id}_${consumo.insumo_id}`;
            if (chaves[chave]) {
              duplicados++;
              tesC.detalhes.push({
                duplicado_encontrado: chave,
                medicao_item_id: consumo.medicao_item_id,
                insumo_id: consumo.insumo_id
              });
            }
            chaves[chave] = true;
          }

          tesC.detalhes.push({
            total_consumos: consumos.length,
            total_chaves_unicas: Object.keys(chaves).length,
            duplicados
          });

          if (duplicados === 0) {
            tesC.passou = true;
            tesC.detalhes.push({ resultado: 'PASSOU - Sem duplicações' });
          } else {
            tesC.detalhes.push({ resultado: `FALHOU - ${duplicados} duplicações encontradas` });
          }
        }
      } catch (err) {
        tesC.detalhes.push({ erro: err.message });
      }

      resultados.testes.push(tesC);
    }

    // Verificação de profundidade recursiva
    if (!teste_tipo || teste_tipo === 'D') {
      const tesD = { nome: 'D - Expansão recursiva (profundidade ≤ 3)', passou: false, detalhes: [] };

      try {
        const exec = await base44.functions.invoke('gerarDemandaEstoqueDaObra', {
          obra_id,
          profundidade_maxima: 3
        });

        const totalInsumos = exec.data?.resultado?.demandas?.length || 0;
        
        tesD.detalhes.push({
          total_insumos_expandidos: totalInsumos,
          profundidade_configurada: 3
        });

        // Se houver insumos, expansão funcionou
        if (totalInsumos > 0) {
          tesD.passou = true;
          tesD.detalhes.push({ resultado: 'PASSOU - Expansão recursiva funcionou' });
        } else {
          tesD.detalhes.push({ aviso: 'Nenhum insumo expandido (pode ser normal)' });
        }
      } catch (err) {
        tesD.detalhes.push({ erro: err.message });
      }

      resultados.testes.push(tesD);
    }

    const passaram = resultados.testes.filter(t => t.passou).length;
    const total = resultados.testes.length;

    resultados.resumo = {
      total_testes: total,
      testes_passaram: passaram,
      percentual: ((passaram / total) * 100).toFixed(0) + '%',
      status_geral: passaram === total ? 'PRONTO' : 'COM FALHAS'
    };

    return Response.json(resultados);

  } catch (error) {
    console.error('Erro nos testes:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});