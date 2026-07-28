import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { obra_id, profundidade_maxima = 3 } = await req.json();
    if (!obra_id) {
      return Response.json({ error: 'obra_id obrigatório' }, { status: 400 });
    }

    // 1. Buscar todos os itens do orçamento (não-grupos)
    const itensOrcamento = await base44.asServiceRole.entities.OrcamentoItem.filter({
      obra_id,
      is_grupo: false
    });

    const demandas = {}; // chave: insumo_id
    const processados = [];
    const cacheComposicao = {}; // código+banco -> composição
    const insumosCache = {}; // insumo_id -> insumo

    // Helper: expandir subcomposição recursivamente
    const expandirSubcomposicao = async (codigo, banco, coeficiente, profundidade, visitados) => {
      const chaveComposicao = `${codigo}_${banco}`;
      
      // Proteção: loop detectado
      if (visitados.has(chaveComposicao)) {
        console.warn(`Loop detectado: ${chaveComposicao}`);
        return [];
      }

      // Limite de profundidade
      if (profundidade > profundidade_maxima) {
        return [];
      }

      let composicao = cacheComposicao[chaveComposicao];
      if (!composicao) {
        const comps = await base44.asServiceRole.entities.Composicao.filter({
          codigo,
          banco
        });
        if (comps && comps.length > 0) {
          composicao = comps[0];
          cacheComposicao[chaveComposicao] = composicao;
        }
      }

      if (!composicao) return [];

      const insumos = [];
      const linhas = await base44.asServiceRole.entities.ComposicaoLinha.filter({
        composicao_id: composicao.id
      });

      for (const linha of linhas || []) {
        if (linha.natureza === 'INSUMO' && linha.insumo_id) {
          insumos.push({
            insumo_id: linha.insumo_id,
            descricao: linha.descricao,
            unidade: linha.unidade,
            coef: (linha.quantidade || 0) * coeficiente
          });
        } else if (linha.natureza === 'SUBCOMPOSICAO') {
          const novosVisitados = new Set(visitados);
          novosVisitados.add(chaveComposicao);
          const subInsumos = await expandirSubcomposicao(
            linha.codigo,
            linha.banco,
            (linha.quantidade || 0) * coeficiente,
            profundidade + 1,
            novosVisitados
          );
          insumos.push(...subInsumos);
        }
      }

      return insumos;
    };

    // 2. Para cada item do orçamento com composição
    for (const item of itensOrcamento || []) {
      if (!item.composicao_id) continue;

      try {
        const composicao = await base44.asServiceRole.entities.Composicao.read(item.composicao_id);
        if (!composicao) continue;

        const linhas = await base44.asServiceRole.entities.ComposicaoLinha.filter({
          composicao_id: item.composicao_id
        });

        // Processar linhas
        for (const linha of linhas || []) {
          if (linha.natureza === 'INSUMO' && linha.insumo_id) {
            const quantidadeConsumida = (linha.quantidade || 0) * (item.quantidade_orcada || 0);

            if (!demandas[linha.insumo_id]) {
              let insumo = insumosCache[linha.insumo_id];
              if (!insumo) {
                insumo = await base44.asServiceRole.entities.Insumo.read(linha.insumo_id);
                insumosCache[linha.insumo_id] = insumo;
              }
              demandas[linha.insumo_id] = {
                insumo_id: linha.insumo_id,
                descricao: insumo?.descricao || linha.descricao,
                unidade: insumo?.unidade || linha.unidade,
                quantidade: 0
              };
            }

            demandas[linha.insumo_id].quantidade += quantidadeConsumida;

          } else if (linha.natureza === 'SUBCOMPOSICAO') {
            try {
              const subInsumos = await expandirSubcomposicao(
                linha.codigo,
                linha.banco,
                linha.quantidade || 0,
                1,
                new Set()
              );

              for (const subInsumo of subInsumos) {
                const quantidadeConsumida = subInsumo.coef * (item.quantidade_orcada || 0);

                if (!demandas[subInsumo.insumo_id]) {
                  let insumo = insumosCache[subInsumo.insumo_id];
                  if (!insumo) {
                    insumo = await base44.asServiceRole.entities.Insumo.read(subInsumo.insumo_id);
                    insumosCache[subInsumo.insumo_id] = insumo;
                  }
                  demandas[subInsumo.insumo_id] = {
                    insumo_id: subInsumo.insumo_id,
                    descricao: insumo?.descricao || subInsumo.descricao,
                    unidade: insumo?.unidade || subInsumo.unidade,
                    quantidade: 0
                  };
                }

                demandas[subInsumo.insumo_id].quantidade += quantidadeConsumida;
              }
            } catch (err) {
              console.warn(`Erro ao expandir subcomposição ${linha.codigo}:`, err.message);
            }
          }
        }

        processados.push({
          item_num: item.item_num,
          status: 'processado'
        });
      } catch (err) {
        processados.push({
          item_num: item.item_num,
          status: 'erro',
          erro: err.message
        });
      }
    }

    // 3. Buscar dados complementares: Comprada (OrdenCompra), Recebida (MovimentacaoEstoque)
    const demandaCriada = [];
    for (const [insumoId, dadoDemanda] of Object.entries(demandas)) {
      try {
        // Quantidade comprada: somar itens de OC confirmadas
        const ocItens = await base44.asServiceRole.entities.OrdemCompra.filter({
          obra_id,
          status: { $ne: 'cancelada' }
        });
        let quantidadeComprada = 0;
        for (const oc of ocItens || []) {
          const itensOc = await base44.asServiceRole.entities.ItemOrcamento.filter({
            ordem_compra_id: oc.id,
            insumo_id: insumoId
          });
          quantidadeComprada += itensOc?.reduce((sum, i) => sum + (i.quantidade || 0), 0) || 0;
        }

        // Quantidade recebida: somar MovimentacaoEstoque entrada_compra
        const movRecebidas = await base44.asServiceRole.entities.MovimentacaoEstoqueObra.filter({
          obra_id,
          insumo_id: insumoId,
          tipo_movimentacao: 'entrada_compra'
        });
        const quantidadeRecebida = movRecebidas?.reduce((sum, m) => sum + (m.quantidade || 0), 0) || 0;

        // Quantidade consumida: somar ConsumoInsumo
        const consumos = await base44.asServiceRole.entities.ConsumoInsumo.filter({
          obra_id,
          insumo_id: insumoId
        });
        const quantidadeConsumida = consumos?.reduce((sum, c) => sum + (c.quantidade_consumida || 0), 0) || 0;

        const saldo = quantidadeRecebida - quantidadeConsumida;
        const percentualConsumo = quantidadeRecebida > 0 ? (quantidadeConsumida / quantidadeRecebida) * 100 : 0;

        const existente = await base44.asServiceRole.entities.DemandaEstoqueObra.filter({
          obra_id,
          insumo_id: insumoId
        });

        const dataAtualizacao = new Date().toISOString();

        if (existente && existente.length > 0) {
          await base44.asServiceRole.entities.DemandaEstoqueObra.update(existente[0].id, {
            quantidade_prevista: dadoDemanda.quantidade,
            quantidade_comprada: quantidadeComprada,
            quantidade_recebida: quantidadeRecebida,
            quantidade_consumida: quantidadeConsumida,
            saldo,
            percentual_consumo: percentualConsumo,
            data_calculo: dataAtualizacao
          });
        } else {
          await base44.asServiceRole.entities.DemandaEstoqueObra.create({
            obra_id,
            insumo_id: dadoDemanda.insumo_id,
            insumo_descricao: dadoDemanda.descricao,
            unidade: dadoDemanda.unidade,
            quantidade_prevista: dadoDemanda.quantidade,
            quantidade_comprada: quantidadeComprada,
            quantidade_recebida: quantidadeRecebida,
            quantidade_consumida: quantidadeConsumida,
            saldo,
            percentual_consumo: percentualConsumo,
            data_calculo: dataAtualizacao
          });
        }

        demandaCriada.push({
          insumo_id: insumoId,
          prevista: dadoDemanda.quantidade,
          comprada: quantidadeComprada,
          recebida: quantidadeRecebida,
          consumida: quantidadeConsumida,
          status: 'atualizada'
        });
      } catch (err) {
        demandaCriada.push({
          insumo_id: insumoId,
          status: 'erro',
          erro: err.message
        });
      }
    }

    return Response.json({
      obra_id,
      total_itens: itensOrcamento.length,
      total_insumos_unicos: Object.keys(demandas).length,
      demandas_criadas: demandaCriada.length,
      resultado: {
        itens_processados: processados,
        demandas: demandaCriada
      }
    });

  } catch (error) {
    console.error('Erro ao gerar demanda:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});