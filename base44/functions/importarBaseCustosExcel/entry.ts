import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file_url, modo_importacao = 'novo' } = await req.json();

    // Extrair dados da planilha
    const schema = {
      type: 'object',
      properties: {
        codigo: { type: 'string' },
        descricao: { type: 'string' },
        unidade: { type: 'string' },
        categoria: { type: 'string' },
        preco_padrao: { type: 'number' },
        grupo: { type: 'string' },
        observacao: { type: 'string' }
      }
    };

    const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: schema
    });

    if (extractResult.status !== 'success' || !extractResult.output) {
      return Response.json({
        status: 'erro',
        mensagem: 'Erro ao extrair dados da planilha'
      }, { status: 400 });
    }

    const items = Array.isArray(extractResult.output) ? extractResult.output : [extractResult.output];
    const mapeamento = {
      'm': 'm', 'm2': 'm2', 'm3': 'm3', 'un': 'un', 'kg': 'kg',
      'l': 'l', 'sc': 'sc', 'cx': 'cx', 'h': 'h', 'dia': 'dia', 'mes': 'mes'
    };

    const categoriaMap = {
      'material': 'material',
      'mão de obra': 'mao_obra',
      'equipamento': 'equipamento',
      'serviço': 'servico'
    };

    const validados = [];
    const erros = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.codigo || !item.descricao || !item.preco_padrao) continue;

      try {
        const unidade = mapeamento[item.unidade?.toLowerCase()] || 'un';
        const categoria = categoriaMap[item.categoria?.toLowerCase()] || 'material';

        validados.push({
          codigo: String(item.codigo).trim(),
          descricao: String(item.descricao).trim(),
          unidade,
          categoria,
          preco_padrao: Number(item.preco_padrao) || 0,
          grupo: item.grupo ? String(item.grupo).trim() : 'Geral',
          observacao: item.observacao ? String(item.observacao).trim() : '',
          fonte_preco: 'importacao',
          data_atualizacao: new Date().toISOString().split('T')[0],
          ativo: true,
          variacao_permitida_percentual: 10,
          atualizado_por: user.email,
          numero_atualizacoes: 1
        });
      } catch (e) {
        erros.push({ linha: i + 1, erro: e.message });
      }
    }

    // Importar para banco
    let inseridos = 0;
    let atualizados = 0;
    const problemas = [];

    for (const item of validados) {
      try {
        const existente = await base44.asServiceRole.entities.BaseCustos.filter(
          { codigo: item.codigo },
          'codigo',
          1
        );

        if (existente.length > 0 && modo_importacao === 'atualizar') {
          // Registrar histórico antes de atualizar
          const preco_anterior = existente[0].preco_padrao;
          const variacao = ((item.preco_padrao - preco_anterior) / preco_anterior) * 100;

          if (Math.abs(variacao) > 0.01) {
            await base44.asServiceRole.entities.HistoricoBaseCustos.create({
              base_custos_id: existente[0].id,
              codigo: item.codigo,
              descricao: item.descricao,
              preco_anterior,
              preco_novo: item.preco_padrao,
              variacao_percentual: variacao,
              data_alteracao: new Date().toISOString(),
              alterado_por: user.email,
              fonte: 'importacao',
              observacao: `Importação de planilha - Variação: ${variacao.toFixed(2)}%`
            }).catch(() => {});
          }

          await base44.asServiceRole.entities.BaseCustos.update(existente[0].id, {
            ...item,
            preco_anterior: preco_anterior,
            numero_atualizacoes: (existente[0].numero_atualizacoes || 0) + 1
          });
          atualizados++;
        } else if (!existente.length) {
          await base44.asServiceRole.entities.BaseCustos.create(item);
          inseridos++;
        }
      } catch (e) {
        problemas.push({ codigo: item.codigo, erro: e.message });
      }
    }

    return Response.json({
      status: 'sucesso',
      resumo: {
        total_processados: validados.length,
        inseridos,
        atualizados,
        erros: erros.length + problemas.length
      },
      detalhes: {
        erros_validacao: erros,
        problemas_importacao: problemas
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});