import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { medicao_id } = await req.json();
    if (!medicao_id) {
      return Response.json({ error: 'medicao_id obrigatório' }, { status: 400 });
    }

    // 1. Buscar medição
    const medicao = await base44.asServiceRole.entities.Medicao.read(medicao_id);
    if (!medicao) {
      return Response.json({ error: 'Medição não encontrada' }, { status: 404 });
    }

    // Se já processada, retornar sucesso (idempotência)
    if (medicao.status === 'processada') {
      return Response.json({
        medicao_id,
        status: 'ja_processada',
        mensagem: 'Medição já foi processada'
      });
    }

    // 2. Buscar itens da medição
    const itensMe = await base44.asServiceRole.entities.MedicaoItem.filter({
      medicao_id
    });

    const consumosGerados = [];
    const equipamentosGerados = [];
    let valorTotalRealizado = 0;

    // 3. Para cada item de medição, gerar consumo de insumos
    for (const itemMed of itensMe || []) {
      try {
        // Buscar composição do item
        const composicao = await base44.asServiceRole.entities.Composicao.read(
          itemMed.composicao_id
        );
        if (!composicao) continue;

        // Buscar linhas da composição
        const linhas = await base44.asServiceRole.entities.ComposicaoLinha.filter({
          composicao_id: itemMed.composicao_id
        });

        // Processar linhas
        for (const linha of linhas || []) {
          if (linha.natureza === 'INSUMO' && linha.insumo_id) {
            const quantidadeConsumida = (linha.quantidade || 0) * (itemMed.quantidade_medida || 0);
            const valorTotal = quantidadeConsumida * (linha.valor_unit || 0);

            // Verificar se já existe (UNIQUE por medicao_item_id + insumo_id)
            const consumoExistente = await base44.asServiceRole.entities.ConsumoInsumo.filter({
              medicao_item_id: itemMed.id,
              insumo_id: linha.insumo_id
            });

            if (consumoExistente && consumoExistente.length > 0) {
              // Idempotência: skip ou update
              await base44.asServiceRole.entities.ConsumoInsumo.update(consumoExistente[0].id, {
                quantidade_consumida: quantidadeConsumida,
                valor_total: valorTotal
              });
            } else {
              await base44.asServiceRole.entities.ConsumoInsumo.create({
                medicao_item_id: itemMed.id,
                obra_id: medicao.obra_id,
                insumo_id: linha.insumo_id,
                insumo_descricao: linha.descricao,
                unidade: linha.unidade,
                coeficiente: linha.quantidade,
                quantidade_consumida: quantidadeConsumida,
                valor_unitario: linha.valor_unit,
                valor_total: valorTotal
              });
            }

            consumosGerados.push({
              insumo_id: linha.insumo_id,
              quantidade: quantidadeConsumida,
              valor: valorTotal
            });

            valorTotalRealizado += valorTotal;

          } else if (linha.natureza === 'SUBCOMPOSICAO') {
            if (linha.tipo && ['equipamento', 'hora_maquina'].includes(linha.tipo)) {
              const horas = (linha.quantidade || 0) * (itemMed.quantidade_medida || 0);
              const valorTotal = horas * (linha.valor_unit || 0);
              const equipId = linha.insumo_id || `${linha.codigo}_${linha.banco}`;

              const equipExistente = await base44.asServiceRole.entities.UsoEquipamento.filter({
                medicao_item_id: itemMed.id,
                insumo_id: equipId
              });

              if (equipExistente && equipExistente.length > 0) {
                await base44.asServiceRole.entities.UsoEquipamento.update(equipExistente[0].id, {
                  horas_maquina: horas,
                  valor_total: valorTotal
                });
              } else {
                await base44.asServiceRole.entities.UsoEquipamento.create({
                  medicao_item_id: itemMed.id,
                  obra_id: medicao.obra_id,
                  insumo_id: equipId,
                  insumo_descricao: linha.descricao,
                  unidade: linha.unidade,
                  horas_maquina: horas,
                  valor_unitario: linha.valor_unit,
                  valor_total: valorTotal
                });
              }

              equipamentosGerados.push({
                descricao: linha.descricao,
                horas,
                valor: valorTotal
              });

              valorTotalRealizado += valorTotal;
            }
          }
        }

        // Atualizar status do MedicaoItem
        await base44.asServiceRole.entities.MedicaoItem.update(itemMed.id, {
          status: 'processada',
          valor_total: itemMed.valor_total || 0
        });

      } catch (err) {
        console.error(`Erro ao processar MedicaoItem ${itemMed.item_num}:`, err.message);
      }
    }

    // 4. Atualizar medição como processada
    await base44.asServiceRole.entities.Medicao.update(medicao_id, {
      status: 'processada',
      valor_total_realizado: valorTotalRealizado
    });

    return Response.json({
      medicao_id,
      status: 'processada',
      consumos_gerados: consumosGerados.length,
      equipamentos_gerados: equipamentosGerados.length,
      valor_total_realizado: valorTotalRealizado,
      resultado: {
        consumos: consumosGerados,
        equipamentos: equipamentosGerados
      }
    });

  } catch (error) {
    console.error('Erro ao confirmar medição:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});