import { withSecureHandler, SchemaValidator } from './_shared/secureHandler.ts';
import { successResponse, errorResponse } from './_shared/responseHandler.ts';

const validarInputOC = SchemaValidator.object({
  numero: SchemaValidator.string(true),
  fornecedor_id: SchemaValidator.string(true),
  itens: (val: any) => {
    if (!Array.isArray(val) || val.length === 0) {
      return { valid: false, error: 'itens deve ser array com pelo menos 1 item' };
    }
    for (const item of val) {
      if (!item.insumo_id) {
        return { valid: false, error: 'Todos os itens devem ter insumo_id' };
      }
    }
    return { valid: true };
  }
});

Deno.serve(async (req) => {
  return withSecureHandler(req, {
    requiredPermission: 'COMPRAS_CRIAR_OC',
    requireObraScope: true,
    validateInput: validarInputOC,
    auditAction: 'CRIAR_ORDEM_COMPRA'
  }, async (ctx) => {
    const { base44, payload, obraId } = ctx;
    const { numero, fornecedor_id, itens, data_emissao, data_prevista_entrega, condicoes_pagamento, destino = 'estoque_central', observacoes } = payload;

    // Validar insumos existem — usar filter (não .get que lança 500)
    for (const item of itens) {
      const insumos = await base44.entities.Insumo.filter({ id: item.insumo_id });
      if (!insumos || insumos.length === 0) {
        throw new Error(`Insumo ${item.insumo_id} não encontrado`);
      }
    }

    // Calcular totais
    let valor_subtotal = 0;
    let valor_impostos = 0;

    const itensProcessados = itens.map(item => {
      const valor_item = (item.quantidade_solicitada || 0) * (item.valor_unitario || 0);
      const imposto = valor_item * ((item.impostos_percentual || 0) / 100);
      valor_subtotal += valor_item;
      valor_impostos += imposto;
      return { ...item, valor_total: valor_item, impostos_valor: imposto };
    });

    const valor_total = valor_subtotal + valor_impostos;
    const fornecedores = await base44.entities.Fornecedor.filter({ id: fornecedor_id });
    const fornecedor = fornecedores?.[0];

    // Criar ordem de compra
    const oc = await base44.entities.OrdemCompra.create({
      numero,
      fornecedor_id,
      fornecedor_nome: fornecedor?.nome || '',
      obra_id: obraId,
      itens: itensProcessados,
      valor_subtotal,
      valor_impostos,
      valor_total,
      data_emissao: data_emissao || new Date().toISOString().split('T')[0],
      data_prevista_entrega,
      condicoes_pagamento,
      status: 'criada',
      destino,
      observacoes,
      status_pagamento: 'nao_pago',
      status_entrega: 'nao_recebido'
    });

    return {
      oc_id: oc.id,
      numero: oc.numero,
      status: 'criada',
      valor_total,
      total_itens: itens.length
    };
  });
});