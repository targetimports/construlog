import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, almoxarifado_id } = await req.json();
    if (!file_url || !almoxarifado_id) {
      return Response.json({ error: 'file_url e almoxarifado_id obrigatórios' }, { status: 400 });
    }

    // Extrair dados
    const resultado = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          codigo_insumo: { type: 'string' },
          descricao: { type: 'string' },
          quantidade_total: { type: 'number' },
          quantidade_reservada: { type: 'number' },
          custo_unitario_medio: { type: 'number' },
          unidade: { type: 'string' }
        }
      }
    });

    if (resultado.status === 'error') {
      return Response.json({ error: resultado.details }, { status: 400 });
    }

    let saldos_atualizados = 0;
    const erros = [];
    const dados = Array.isArray(resultado.output) ? resultado.output : [resultado.output];

    for (const linha of dados) {
      try {
        if (!linha.codigo_insumo || !linha.descricao) {
          erros.push('Linha com campos obrigatórios faltando');
          continue;
        }

        // Buscar ou criar insumo
        const insumos = await base44.entities.Insumo.filter({
          codigo: linha.codigo_insumo
        });

        let insumo_id = null;
        if (insumos.length > 0) {
          insumo_id = insumos[0].id;
        } else {
          const novo = await base44.entities.Insumo.create({
            codigo: linha.codigo_insumo,
            descricao: linha.descricao,
            unidade: linha.unidade || 'un',
            grupo: 'material',
            tipo: 'material',
            preco_referencia: linha.custo_unitario_medio || 0
          });
          insumo_id = novo.id;
        }

        // Buscar saldo existente
        const saldos = await base44.entities.SaldoEstoque.filter({
          insumo_id,
          almoxarifado_id
        });

        const quantidade_disponivel = (linha.quantidade_total || 0) - (linha.quantidade_reservada || 0);
        const valor_total = quantidade_disponivel * (linha.custo_unitario_medio || 0);

        if (saldos.length > 0) {
          // Atualizar
          await base44.entities.SaldoEstoque.update(saldos[0].id, {
            quantidade_total: linha.quantidade_total || 0,
            quantidade_reservada: linha.quantidade_reservada || 0,
            quantidade_disponivel,
            custo_unitario_medio: linha.custo_unitario_medio || 0,
            valor_total_estoque: valor_total,
            data_ultima_movimentacao: new Date().toISOString()
          });
        } else {
          // Criar novo
          await base44.entities.SaldoEstoque.create({
            insumo_id,
            almoxarifado_id,
            codigo_insumo: linha.codigo_insumo,
            descricao_insumo: linha.descricao,
            unidade: linha.unidade || 'un',
            quantidade_total: linha.quantidade_total || 0,
            quantidade_reservada: linha.quantidade_reservada || 0,
            quantidade_disponivel,
            custo_unitario_medio: linha.custo_unitario_medio || 0,
            valor_total_estoque: valor_total
          });
        }

        saldos_atualizados++;
      } catch (erro) {
        erros.push(`Erro ao processar ${linha.codigo_insumo}: ${erro.message}`);
      }
    }

    return Response.json({
      status: 'sucesso',
      saldos_atualizados,
      erros,
      total_processado: dados.length
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});