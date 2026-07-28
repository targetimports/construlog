import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, obra_id } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url obrigatório' }, { status: 400 });

    // Extrair dados do arquivo Excel
    const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          descricao_insumo: { type: 'string' },
          quantidade_necessaria: { type: 'number' },
          unidade: { type: 'string' },
          valor_unitario: { type: 'number' },
          status: { type: 'string' }
        }
      }
    });

    if (resultado.status === 'error') {
      return Response.json({ error: resultado.details }, { status: 400 });
    }

    let demandas_criadas = 0;
    const erros = [];

    // Processar dados
    const dados = Array.isArray(resultado.output) ? resultado.output : [resultado.output];

    for (const linha of dados) {
      try {
        if (!linha.descricao_insumo || !linha.quantidade_necessaria) {
          erros.push(`Linha inválida: faltam campos obrigatórios`);
          continue;
        }

        // Buscar insumo existente
        const insumos = await base44.entities.Insumo.filter({
          descricao: linha.descricao_insumo
        });

        let insumo_id = null;
        if (insumos.length > 0) {
          insumo_id = insumos[0].id;
        } else {
          // Criar novo insumo
          const novo = await base44.entities.Insumo.create({
            codigo: `IMP-${Date.now()}`,
            descricao: linha.descricao_insumo,
            unidade: linha.unidade || 'un',
            grupo: 'material',
            tipo: 'material',
            origem: 'importado',
            preco_referencia: linha.valor_unitario || 0
          });
          insumo_id = novo.id;
        }

        // Criar demanda
        await base44.entities.DemandaEstoqueObra.create({
          obra_id: obra_id,
          insumo_id,
          descricao_insumo: linha.descricao_insumo,
          quantidade_necessaria: linha.quantidade_necessaria,
          unidade: linha.unidade || 'un',
          valor_unitario: linha.valor_unitario || 0,
          valor_total: (linha.quantidade_necessaria || 1) * (linha.valor_unitario || 0),
          status: linha.status || 'pendente',
          data_criacao: new Date().toISOString().split('T')[0]
        });

        demandas_criadas++;
      } catch (erro) {
        erros.push(`Erro ao processar linha: ${erro.message}`);
      }
    }

    return Response.json({
      status: 'sucesso',
      demandas_criadas,
      erros,
      total_processado: dados.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});