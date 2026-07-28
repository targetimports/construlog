import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url obrigatório' }, { status: 400 });

    // Extrair dados
    const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          obra_id: { type: 'string' },
          insumo: { type: 'string' },
          quantidade: { type: 'number' },
          valor_unitario: { type: 'number' },
          status: { type: 'string' }
        }
      }
    });

    if (resultado.status === 'error') {
      return Response.json({ error: resultado.details }, { status: 400 });
    }

    let requisicoes_criadas = 0;
    const erros = [];
    const dados = Array.isArray(resultado.output) ? resultado.output : [resultado.output];

    // Agrupar por obra
    const porObra = {};
    for (const linha of dados) {
      if (!porObra[linha.obra_id]) porObra[linha.obra_id] = [];
      porObra[linha.obra_id].push(linha);
    }

    // Criar requisições agrupadas por obra
    for (const [obra_id, linhas] of Object.entries(porObra)) {
      try {
        let valor_total = 0;
        const req_criada = await base44.entities.RequisicaoCompra.create({
          obra_id,
          solicitante_email: user.email,
          status: 'pendente_aprovacao',
          data_solicitacao: new Date().toISOString().split('T')[0],
          observacoes: 'Importada de planilha'
        });

        // Criar itens
        for (const linha of linhas) {
          try {
            const insumos = await base44.entities.Insumo.filter({
              descricao: linha.insumo
            });

            let insumo_id = null;
            if (insumos.length > 0) {
              insumo_id = insumos[0].id;
            } else {
              const novo = await base44.entities.Insumo.create({
                codigo: `IMP-${Date.now()}`,
                descricao: linha.insumo,
                unidade: 'un',
                grupo: 'material',
                tipo: 'material'
              });
              insumo_id = novo.id;
            }

            const valor_item = (linha.quantidade || 1) * (linha.valor_unitario || 0);
            valor_total += valor_item;

            await base44.entities.RequisicaoCompraItem.create({
              requisicao_compra_id: req_criada.id,
              insumo_id,
              quantidade: linha.quantidade || 1,
              valor_unitario: linha.valor_unitario || 0,
              valor_total: valor_item,
              descricao: linha.insumo
            });
          } catch (e) {
            erros.push(`Erro ao criar item para ${linha.insumo}: ${e.message}`);
          }
        }

        // Atualizar valor total
        await base44.entities.RequisicaoCompra.update(req_criada.id, {
          valor_total
        });

        requisicoes_criadas++;
      } catch (erro) {
        erros.push(`Erro ao criar requisição para obra ${obra_id}: ${erro.message}`);
      }
    }

    return Response.json({
      status: 'sucesso',
      requisicoes_criadas,
      erros,
      total_processado: dados.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});