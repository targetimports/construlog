import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      orcamento_url, 
      composicoes_url, 
      cronograma_url,
      nome_obra
    } = await req.json();

    if (!orcamento_url || !nome_obra) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let obra = null;
    let itens_criados = 0;
    let composicoes_criadas = 0;
    let cronograma_criado = false;

    // ETAPA 1: Extrair e validar dados do Orçamento Sintético
    const rawOrcamento = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url: orcamento_url,
      json_schema: {
        type: 'object',
        properties: {
          col_0: { type: 'string' },
          col_1: { type: 'string' },
          col_2: { type: 'string' },
          Obra: { type: 'string' },
          Bancos: { type: 'string' }
        }
      }
    });

    // Processar com IA para extrair itens estruturados
    const processadoOrcamento = await base44.integrations.Core.InvokeLLM({
      prompt: `Você recebeu dados brutos de um orçamento sintético.

EXTRAIA TODOS os itens de custo (ignorar linhas de cabeçalho/seção). Para cada item:
- item_numero: número sequencial (ex: "1", "1.1", "2")
- descricao: descrição completa
- unidade: unidade de medida
- quantidade: quantidade (número)
- valor_unitario: valor unitário (número)
- valor_total: valor total do item (número)
- categoria: classificar em (servicos, materiais, mao_obra, equipamento)

RETORNE SEMPRE um JSON válido com array "items".`,
      prompt: `Dados: ${JSON.stringify(rawOrcamento.output || rawOrcamento, null, 2).substring(0, 10000)}
      
RETORNE EXATAMENTE NESTE FORMATO:
{"items": [{"item_numero": "1", "descricao": "Descrição", "unidade": "un", "quantidade": 1, "valor_unitario": 100, "valor_total": 100, "categoria": "servicos"}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_numero: { type: 'string' },
                descricao: { type: 'string' },
                unidade: { type: 'string' },
                quantidade: { type: 'number' },
                valor_unitario: { type: 'number' },
                valor_total: { type: 'number' },
                categoria: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Validar resposta
    if (!processadoOrcamento || !processadoOrcamento.items || !Array.isArray(processadoOrcamento.items)) {
      return Response.json({
        error: 'Erro ao processar orçamento',
        status: 'erro'
      }, { status: 400 });
    }

    // Criar Obra
    obra = await base44.entities.Obra.create({
      nome: nome_obra,
      tipo: 'privada',
      tipo_obra: 'edificacao',
      status: 'orcamento',
      cliente: 'A definir',
      fase: 'orcamento',
      data_inicio: new Date().toISOString().split('T')[0]
    });

    // Calcular valor total
    const valor_total = processadoOrcamento.items.reduce((sum, item) => sum + (item.valor_total || 0), 0);

    // ETAPA 2: Criar Orçamento
    const orcamento = await base44.entities.Orcamento.create({
      obra_id: obra.id,
      versao: 'V1',
      titulo: `Orçamento ${nome_obra}`,
      data_criacao: new Date().toISOString().split('T')[0],
      status: 'rascunho',
      valor_total: valor_total,
      valor_proposta: valor_total
    });

    // ETAPA 3: Criar itens do orçamento
    const itens_mapeados = [];
    for (const item of processadoOrcamento.items) {
      if (!item.descricao || !item.valor_total) continue;

      const orc_item = await base44.entities.OrcamentoItem.create({
        orcamento_id: orcamento.id,
        obra_id: obra.id,
        numero_item: item.item_numero || '',
        descricao: item.descricao,
        unidade: item.unidade || 'un',
        quantidade: item.quantidade || 1,
        valor_unitario: item.valor_unitario || 0,
        valor_total: item.valor_total || 0,
        categoria: item.categoria || 'servicos',
        status: 'planejado'
      });

      itens_criados++;
      itens_mapeados.push({
        id: orc_item.id,
        descricao: item.descricao,
        numero: item.item_numero
      });
    }

    // ETAPA 4: Importar Composições (se fornecida)
    if (composicoes_url) {
      try {
        const rawComposicoes = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: composicoes_url,
          json_schema: {
            type: 'object',
            properties: {
              col_0: { type: 'string' },
              col_1: { type: 'string' },
              Obra: { type: 'string' }
            }
          }
        });

        const processadoComposicoes = await base44.integrations.Core.InvokeLLM({
          prompt: `Extraia composições e seus insumos. Para cada composição: item_numero, descricao, e array de insumos com codigo, descricao, unidade, quantidade, valor_unitario.`,
          prompt: `Dados: ${JSON.stringify(rawComposicoes.output || rawComposicoes, null, 2).substring(0, 15000)}
        
RETORNE: {"composicoes": [{"item_numero": "1.1", "descricao": "...", "insumos": [{"codigo": "51", "descricao": "...", "unidade": "un", "quantidade": 1, "valor_unitario": 100}]}]}`,
          response_json_schema: {
            type: 'object',
            properties: {
              composicoes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    item_numero: { type: 'string' },
                    descricao: { type: 'string' },
                    insumos: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          codigo: { type: 'string' },
                          descricao: { type: 'string' },
                          unidade: { type: 'string' },
                          quantidade: { type: 'number' },
                          valor_unitario: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        });

        if (processadoComposicoes && processadoComposicoes.composicoes) {
          for (const comp of processadoComposicoes.composicoes) {
            const item_relacionado = itens_mapeados.find(i => 
              i.numero === comp.item_numero || i.descricao.substring(0, 30).includes(comp.descricao.substring(0, 30))
            );

            if (item_relacionado) {
              const composicao = await base44.entities.Composicao.create({
                orcamento_item_id: item_relacionado.id,
                obra_id: obra.id,
                descricao: comp.descricao,
                numero_item: comp.item_numero || ''
              });

              for (const insumo of (comp.insumos || [])) {
                await base44.entities.ComposicaoInsumo.create({
                  composicao_id: composicao.id,
                  codigo_insumo: insumo.codigo || '',
                  descricao: insumo.descricao || '',
                  unidade: insumo.unidade || 'un',
                  quantidade: insumo.quantidade || 1,
                  valor_unitario: insumo.valor_unitario || 0,
                  valor_total: (insumo.quantidade || 1) * (insumo.valor_unitario || 0)
                });
              }

              composicoes_criadas++;
            }
          }
        }
      } catch (e) {
        console.log('Erro ao processar composições:', e.message);
      }
    }

    // ETAPA 5: Importar Cronograma (se fornecido)
    if (cronograma_url) {
      try {
        cronograma_criado = true;
        await base44.entities.Obra.update(obra.id, {
          cronograma_ativo: true
        });
      } catch (e) {
        console.log('Erro ao processar cronograma:', e.message);
      }
    }

    return Response.json({
      status: 'sucesso',
      obra_id: obra.id,
      orcamento_id: orcamento.id,
      resumo: {
        nome_obra: obra.nome,
        itens_importados: itens_criados,
        composicoes_importadas: composicoes_criadas,
        cronograma_importado: cronograma_criado,
        valor_total: valor_total,
        status_obra: 'pronta_para_execucao'
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      status: 'erro'
    }, { status: 500 });
  }
});