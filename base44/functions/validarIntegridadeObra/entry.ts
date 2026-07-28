import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { obra_id } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    console.log(`[Validação] Iniciando validação de integridade: obra ${obra_id}`);

    const duplicidades = [];
    const inconsistencias = [];
    let orcamentoOk = true;
    let cpuOk = true;
    let cronogramaOk = true;
    let demandaOk = true;
    let medicaoOk = true;

    // ============ 1. CONTAGENS ============
    
    const grupos = await base44.asServiceRole.entities.OrcamentoGrupo.filter({ obra_id });
    const itens = await base44.asServiceRole.entities.OrcamentoItem.filter({ obra_id, is_grupo: false });
    const composicoes = await base44.asServiceRole.entities.Composicao.filter({ obra_id });
    const linhasCpu = await base44.asServiceRole.entities.ComposicaoLinha.list();
    const periodosCronograma = await base44.asServiceRole.entities.CronogramaItemPeriodo.filter({ obra_id });

    const contagens = {
      grupos: grupos?.length || 0,
      itens: itens?.length || 0,
      composicoes: composicoes?.length || 0,
      linhas_cpu: linhasCpu?.length || 0,
      periodos_cronograma: periodosCronograma?.length || 0
    };

    console.log('[Validação] Contagens:', contagens);

    // ============ 2. VERIFICAÇÃO DE VÍNCULOS ============

    // Todo OrcamentoItem deve ter composicao_id
    let itensSemComposicao = 0;
    for (const item of itens || []) {
      if (!item.composicao_id) {
        itensSemComposicao++;
        inconsistencias.push(`Item ${item.item_num}: sem composição vinculada`);
        orcamentoOk = false;
      }
    }

    // ============ 3. VERIFICAÇÃO DE DUPLICIDADES ============

    // OrcamentoItem (obra_id, item_num)
    const mapItens = {};
    for (const item of itens || []) {
      const chave = `${item.obra_id}_${item.item_num}`;
      if (mapItens[chave]) {
        duplicidades.push(`OrcamentoItem duplicado: ${item.item_num}`);
        orcamentoOk = false;
      }
      mapItens[chave] = true;
    }

    // Composicao (codigo, banco)
    const mapComposicoes = {};
    for (const comp of composicoes || []) {
      const chave = `${comp.codigo}_${comp.banco}`;
      if (mapComposicoes[chave]) {
        duplicidades.push(`Composição duplicada: ${comp.codigo} (${comp.banco})`);
        cpuOk = false;
      }
      mapComposicoes[chave] = true;
    }

    // ComposicaoLinha (composicao_id, natureza, codigo, banco)
    const mapLinhas = {};
    for (const linha of linhasCpu || []) {
      const chave = `${linha.composicao_id}_${linha.natureza}_${linha.codigo}_${linha.banco}`;
      if (mapLinhas[chave]) {
        duplicidades.push(`ComposicaoLinha duplicada: comp=${linha.composicao_id}, codigo=${linha.codigo}`);
        cpuOk = false;
      }
      mapLinhas[chave] = true;
    }

    // CronogramaItemPeriodo (obra_id, item_num, periodo_nome)
    const mapPeriodos = {};
    for (const periodo of periodosCronograma || []) {
      const chave = `${periodo.obra_id}_${periodo.item_num}_${periodo.periodo_nome}`;
      if (mapPeriodos[chave]) {
        duplicidades.push(`Cronograma duplicado: item=${periodo.item_num}, periodo=${periodo.periodo_nome}`);
        cronogramaOk = false;
      }
      mapPeriodos[chave] = true;
    }

    // DemandaEstoqueObra (obra_id, insumo_id)
    const demandas = await base44.asServiceRole.entities.DemandaEstoqueObra.filter({ obra_id });
    const mapDemandas = {};
    for (const demanda of demandas || []) {
      const chave = `${demanda.obra_id}_${demanda.insumo_id}`;
      if (mapDemandas[chave]) {
        duplicidades.push(`DemandaEstoque duplicada: insumo=${demanda.insumo_descricao}`);
        demandaOk = false;
      }
      mapDemandas[chave] = true;
    }

    // MedicaoItem (medicao_id, orcamento_item_id)
    const medicaoItens = await base44.asServiceRole.entities.MedicaoItem.filter({ obra_id });
    const mapMedicaoItens = {};
    for (const medItem of medicaoItens || []) {
      const chave = `${medItem.medicao_id}_${medItem.orcamento_item_id}`;
      if (mapMedicaoItens[chave]) {
        duplicidades.push(`MedicaoItem duplicado: medicao=${medItem.medicao_id}, item=${medItem.item_num}`);
        medicaoOk = false;
      }
      mapMedicaoItens[chave] = true;
    }

    // ConsumoInsumo (medicao_item_id, insumo_id)
    const consumos = await base44.asServiceRole.entities.ConsumoInsumo.filter({ obra_id });
    const mapConsumos = {};
    for (const consumo of consumos || []) {
      const chave = `${consumo.medicao_item_id}_${consumo.insumo_id}`;
      if (mapConsumos[chave]) {
        duplicidades.push(`ConsumoInsumo duplicado: item=${consumo.medicao_item_id}, insumo=${consumo.insumo_descricao}`);
        medicaoOk = false;
      }
      mapConsumos[chave] = true;
    }

    // UsoEquipamento (medicao_item_id, insumo_id)
    const usos = await base44.asServiceRole.entities.UsoEquipamento.filter({ obra_id });
    const mapUsos = {};
    for (const uso of usos || []) {
      const chave = `${uso.medicao_item_id}_${uso.insumo_id}`;
      if (mapUsos[chave]) {
        duplicidades.push(`UsoEquipamento duplicado: item=${uso.medicao_item_id}, equip=${uso.insumo_descricao}`);
        medicaoOk = false;
      }
      mapUsos[chave] = true;
    }

    // ============ 4. VERIFICAÇÕES ADICIONAIS ============

    // Verificar se existem composições sem linhas
    let composicoesSemLinhas = 0;
    for (const comp of composicoes || []) {
      const linhas = await base44.asServiceRole.entities.ComposicaoLinha.filter({
        composicao_id: comp.id
      });
      if (!linhas || linhas.length === 0) {
        composicoesSemLinhas++;
        inconsistencias.push(`Composição ${comp.codigo}: sem linhas (CPU vazia)`);
        cpuOk = false;
      }
    }

    // Verificar se insumos vinculados em ComposicaoLinha existem
    let insumosInvalidos = 0;
    for (const linha of linhasCpu || []) {
      if (linha.natureza === 'INSUMO' && linha.insumo_id) {
        try {
          const insumo = await base44.asServiceRole.entities.Insumo.read(linha.insumo_id);
          if (!insumo) {
            insumosInvalidos++;
            inconsistencias.push(`Linha CPU: insumo_id ${linha.insumo_id} não existe`);
            cpuOk = false;
          }
        } catch (err) {
          insumosInvalidos++;
          inconsistencias.push(`Linha CPU: erro ao validar insumo ${linha.insumo_id}`);
          cpuOk = false;
        }
      }
    }

    // ============ 5. RELATÓRIO FINAL ============

    const integridadeGeral = orcamentoOk && cpuOk && cronogramaOk && demandaOk && medicaoOk;

    console.log('[Validação] Concluída:', {
      orcamentoOk,
      cpuOk,
      cronogramaOk,
      demandaOk,
      medicaoOk,
      integridadeGeral
    });

    return Response.json({
      success: true,
      obra_id,
      integridade_geral: integridadeGeral,
      modulos: {
        orcamento_ok: orcamentoOk,
        cpu_ok: cpuOk,
        cronograma_ok: cronogramaOk,
        demanda_ok: demandaOk,
        medicao_ok: medicaoOk
      },
      contagens,
      estatisticas: {
        itens_sem_composicao: itensSemComposicao,
        composicoes_sem_linhas: composicoesSemLinhas,
        insumos_invalidos: insumosInvalidos,
        total_duplicidades: duplicidades.length,
        total_inconsistencias: inconsistencias.length
      },
      duplicidades,
      inconsistencias,
      data_validacao: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Validação] Erro fatal:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});