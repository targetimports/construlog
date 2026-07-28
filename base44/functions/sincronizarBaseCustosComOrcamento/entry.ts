import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orcamento_id, insumos } = await req.json();

    // insumos = [{codigo, quantidade}, ...]
    const atualizado = [];
    const naoEncontrados = [];

    for (const insumo of insumos) {
      try {
        // Buscar na Base de Custos
        const baseCustos = await base44.asServiceRole.entities.BaseCustos.filter(
          { codigo: insumo.codigo, ativo: true },
          'codigo',
          1
        );

        if (baseCustos.length > 0) {
          const item = baseCustos[0];
          atualizado.push({
            codigo: insumo.codigo,
            descricao: item.descricao,
            unidade: item.unidade,
            preco_unitario: item.preco_padrao,
            valor_total: item.preco_padrao * (insumo.quantidade || 1),
            fonte: 'base_custos'
          });
        } else {
          naoEncontrados.push(insumo.codigo);
        }
      } catch (e) {
        naoEncontrados.push(insumo.codigo);
      }
    }

    return Response.json({
      status: 'sucesso',
      orcamento_id,
      preencidos: atualizado,
      nao_encontrados: naoEncontrados,
      mensagem: `${atualizado.length} itens preenchidos da Base de Custos`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});