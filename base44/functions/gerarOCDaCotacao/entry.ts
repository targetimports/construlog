import { withSecureHandler, SchemaValidator } from './_shared/secureHandler.ts';
import { successResponse } from './_shared/responseHandler.ts';

const validarInput = SchemaValidator.object({
  requisicao_id: SchemaValidator.string(true),
  cotacao_id: SchemaValidator.string(true)
});

Deno.serve(async (req) => {
  return withSecureHandler(req, {
    requiredPermission: 'COMPRAS_GERAR_OC',
    validateInput: validarInput,
    auditAction: 'GERAR_OC_COTACAO'
  }, async (ctx) => {
    const { base44, payload } = ctx;
    const { requisicao_id, cotacao_id } = payload;

    const requisicoes = await base44.asServiceRole.entities.RequisicaoCompra.filter({ id: requisicao_id });
    const requisicao = requisicoes[0];
    if (!requisicao) throw new Error('Requisição não encontrada');

    const cotacoes = await base44.asServiceRole.entities.CotacaoFornecedor.filter({ id: cotacao_id });
    const cotacao = cotacoes[0];
    if (!cotacao) throw new Error('Cotação não encontrada');

    const numero_oc = `OC-${Date.now()}`;
    const itens = requisicao.itens?.map(i => ({
      insumo_id: i.insumo_id,
      descricao: i.descricao,
      unidade: i.unidade,
      quantidade_solicitada: i.quantidade_aprovada || i.quantidade_solicitada,
      quantidade_recebida: 0,
      valor_unitario: cotacao.valor_unitario,
      valor_total: (i.quantidade_aprovada || i.quantidade_solicitada) * cotacao.valor_unitario
    })) || [];

    const valor_total = itens.reduce((s, i) => s + i.valor_total, 0);

    const oc = await base44.asServiceRole.entities.OrdemCompra.create({
      numero: numero_oc,
      requisicao_id,
      obra_id: requisicao.obra_id,
      fornecedor_id: cotacao.fornecedor || 'fornecedor_cotacao',
      fornecedor_nome: cotacao.fornecedor,
      descricao: requisicao.titulo,
      itens,
      valor_subtotal: valor_total,
      valor_total,
      data_emissao: new Date().toISOString().split('T')[0],
      condicoes_pagamento: cotacao.condicoes_pagamento || 'conforme cotação',
      status: 'criada',
      status_entrega: 'nao_recebido',
      empresa_id: requisicao.empresa_id || 'empresa_principal'
    });

    await base44.asServiceRole.entities.CotacaoFornecedor.update(cotacao_id, { status: 'aprovada' });
    await base44.asServiceRole.entities.RequisicaoCompra.update(requisicao_id, { status: 'em_compra' });

    return { oc_id: oc.id, numero_oc };
  });
});