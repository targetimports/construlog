import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url } = await req.json();

    // Extrair dados brutos da planilha
    const rawData = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          col_0: { type: 'string' },
          col_1: { type: 'string' },
          col_2: { type: 'string' },
          col_3: { type: 'string' },
          col_4: { type: 'string' },
          col_5: { type: 'string' },
          col_6: { type: 'string' },
          col_7: { type: 'string' },
          col_8: { type: 'string' },
          col_9: { type: 'string' },
          Obra: { type: 'string' },
          Bancos: { type: 'string' },
          'B.D.I.': { type: 'string' },
          'Encargos Sociais': { type: 'string' }
        }
      }
    });

    // Processar dados com IA
    const processamento = await base44.integrations.Core.InvokeLLM({
      prompt: `Você recebeu dados brutos de uma planilha de orçamento SINAPI. 
      
      Os dados incluem informações sobre composições, com colunas como: Código, Banco, Descrição, Tipo, Unidade, Quantidade, Valor Unitário.
      
      EXTRAIA TODOS os itens válidos (não cabeçalhos/linhas de informação).
      
      Para cada item:
      - codigo: número/código do item
      - descricao: descrição completa do serviço/material
      - tipo: tipo ou categoria
      - unidade: unidade de medida
      - valor_unitario: valor unitário (extrai como número)
      
      RETORNE JSON com array "items". INCLUA TODOS OS ITENS ENCONTRADOS.`,
      prompt: `Dados da planilha: ${JSON.stringify(rawData.output || rawData, null, 2).substring(0, 8000)}
      
      EXTRAIA em JSON {"items": [{"codigo": "...", "descricao": "...", "tipo": "...", "unidade": "...", "valor_unitario": número}]}`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                codigo: { type: 'string' },
                descricao: { type: 'string' },
                tipo: { type: 'string' },
                unidade: { type: 'string' },
                valor_unitario: { type: 'number' }
              }
            }
          }
        }
      }
    });

    let items = [];
    
    if (processamento && processamento.items && Array.isArray(processamento.items)) {
      items = processamento.items.filter(item => item && item.codigo && item.descricao && item.valor_unitario && item.valor_unitario > 0);
    }

    if (items.length === 0) {
      return Response.json({
        status: 'erro',
        mensagem: 'Nenhum item válido encontrado na planilha',
        resumo: {
          total_processados: 0,
          inseridos: 0,
          atualizados: 0,
          erros: 0
        }
      }, { status: 400 });
    }

    // Mapear unidades
    const unidadeMap = {
      'un': 'un', 'unidade': 'un', 'u': 'un',
      'm': 'm', 'metro': 'm', 'metros': 'm',
      'm2': 'm2', 'metro2': 'm2', 'metros2': 'm2',
      'm3': 'm3', 'metro3': 'm3', 'metros3': 'm3',
      'kg': 'kg', 'quilo': 'kg', 'quilograma': 'kg',
      'l': 'l', 'litro': 'l', 'litros': 'l',
      'h': 'h', 'hora': 'h', 'horas': 'h',
      'dia': 'dia', 'dias': 'dia',
      'sc': 'sc', 'saco': 'sc',
      'cx': 'cx', 'caixa': 'cx'
    };

    // Mapear categorias
    const categorizarItem = (tipo, descricao) => {
      const texto = `${tipo || ''} ${descricao || ''}`.toLowerCase();
      if (texto.includes('mão de obra') || texto.includes('servico')) return 'mao_obra';
      if (texto.includes('equipamento') || texto.includes('máquina')) return 'equipamento';
      return 'material';
    };

    const validados = [];

    for (const item of items) {
      // Validar item
      if (!item.codigo || !item.descricao || !item.valor_unitario) {
        continue;
      }

      try {
        const codigo = String(item.codigo).trim();
        const descricao = String(item.descricao).trim();
        const tipo = item.tipo ? String(item.tipo).trim() : 'Geral';
        const unidadeRaw = item.unidade ? String(item.unidade).toLowerCase().trim() : 'un';
        const unidade = unidadeMap[unidadeRaw] || unidadeRaw;
        const valor = Number(item.valor_unitario) || 0;

        if (valor <= 0 || !codigo || !descricao) continue;

        validados.push({
          codigo,
          descricao,
          unidade,
          categoria: categorizarItem(tipo, descricao),
          preco_padrao: valor,
          fonte_preco: 'sinapi',
          grupo: tipo,
          data_atualizacao: new Date().toISOString().split('T')[0],
          ativo: true,
          variacao_permitida_percentual: 10,
          atualizado_por: user.email,
          numero_atualizacoes: 1,
          observacao: `Importado de SINAPI/ORSE`
        });
      } catch (e) {
        console.error('Erro validando item:', e);
      }
    }

    if (validados.length === 0) {
      return Response.json({
        status: 'erro',
        mensagem: 'Nenhum item válido encontrado para importar',
        resumo: {
          total_processados: 0,
          inseridos: 0,
          atualizados: 0,
          erros: items.length
        }
      }, { status: 400 });
    }

    // Importar para BD
    let inseridos = 0;
    let atualizados = 0;

    for (const item of validados) {
      try {
        const existente = await base44.asServiceRole.entities.BaseCustos.filter(
          { codigo: item.codigo },
          'codigo',
          1
        );

        if (existente.length > 0) {
          const preco_anterior = existente[0].preco_padrao;
          if (Math.abs(preco_anterior - item.preco_padrao) > 0.01) {
            const variacao = ((item.preco_padrao - preco_anterior) / preco_anterior) * 100;
            
            await base44.asServiceRole.entities.HistoricoBaseCustos.create({
              base_custos_id: existente[0].id,
              codigo: item.codigo,
              descricao: item.descricao,
              preco_anterior,
              preco_novo: item.preco_padrao,
              variacao_percentual: variacao,
              data_alteracao: new Date().toISOString(),
              alterado_por: user.email,
              fonte: 'importacao'
            }).catch(() => {});

            await base44.asServiceRole.entities.BaseCustos.update(existente[0].id, {
              ...item,
              preco_anterior,
              numero_atualizacoes: (existente[0].numero_atualizacoes || 0) + 1
            });
            atualizados++;
          }
        } else {
          await base44.asServiceRole.entities.BaseCustos.create(item);
          inseridos++;
        }
      } catch (e) {
        console.error('Erro importando item:', e);
      }
    }

    return Response.json({
      status: 'sucesso',
      resumo: {
        total_processados: validados.length,
        inseridos,
        atualizados,
        erros: validados.length - inseridos - atualizados
      },
      mensagem: `✅ Importação concluída: ${inseridos} novos + ${atualizados} atualizados`
    });
  } catch (error) {
    return Response.json({ 
      status: 'erro',
      error: error.message
    }, { status: 500 });
  }
});