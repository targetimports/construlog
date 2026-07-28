import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { sendEmail } from '../email.js';

// Aprova (ou recusa) uma requisição de compra. Se aprovada, gera a Ordem de Compra
// automaticamente (pegando a melhor cotação, se houver) e notifica o solicitante.
export default async function aprovarRequisicao({ body, user }) {
  const { requisicao_id, aprovado = true, aprovador_email, motivo } = body || {};
  if (!requisicao_id) throw Object.assign(new Error('requisicao_id é obrigatório'), { status: 400 });

  requirePermission(user, 'COMPRAS_CREATE');

  const requisicoes = await store.filter('RequisicaoCompra', { id: requisicao_id }, null, 1);
  const requisicao = requisicoes[0];
  if (!requisicao) throw Object.assign(new Error('Requisição não encontrada'), { status: 404 });

  const emailAprovador = aprovador_email || user?.email || 'Sistema';
  const novoStatus = aprovado ? 'aprovada' : 'recusada';
  const hoje = new Date().toISOString().split('T')[0];

  await store.update('RequisicaoCompra', requisicao_id, {
    status: novoStatus,
    aprovado_por: emailAprovador,
    data_aprovacao: hoje,
    observacoes: motivo ? `${requisicao.observacoes || ''}\n\n[${novoStatus}]: ${motivo}` : requisicao.observacoes
  });

  let ordemCompra = null;
  if (aprovado) {
    const itens = requisicao.itens || [];
    const valorTotal = itens.reduce((sum, item) => sum + ((item.quantidade_solicitada || 0) * (item.valor_estimado || 0)), 0);

    // Melhor cotação vinculada, se existir
    let fornecedorNome = 'A definir';
    let fornecedorId = null;
    try {
      const cotacoes = await store.filter('CotacaoFornecedor', { requisicao_id });
      if (cotacoes.length > 0) {
        const melhor = cotacoes.reduce((min, c) => ((c.valor_total || 0) < (min.valor_total || 0) ? c : min));
        fornecedorNome = melhor.fornecedor;
        fornecedorId = melhor.fornecedor_id;
      }
    } catch { /* sem cotações vinculadas */ }

    ordemCompra = await store.create('OrdemCompra', {
      numero: `OC-${Date.now()}`,
      requisicao_id,
      obra_id: requisicao.obra_id,
      fornecedor_id: fornecedorId,
      fornecedor_nome: fornecedorNome,
      descricao: requisicao.descricao_resumo || requisicao.titulo || 'Ordem de Compra',
      valor_total: valorTotal,
      data_emissao: hoje,
      data_prevista_entrega: requisicao.data_necessidade,
      status: 'emitida',
      aprovado_por: emailAprovador,
      data_aprovacao: hoje,
      status_pagamento: 'nao_pago',
      status_entrega: 'nao_recebido',
      itens: itens.map((item) => ({
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: item.quantidade_solicitada,
        valor_unitario: item.valor_estimado || 0,
        valor_total: (item.quantidade_solicitada || 0) * (item.valor_estimado || 0)
      }))
    });

    await store.update('RequisicaoCompra', requisicao_id, { status: 'em_compra' });
  }

  // Notificação ao solicitante (best-effort — não quebra se e-mail não estiver configurado)
  if (requisicao.solicitante) {
    try {
      const obras = await store.filter('Obra', { id: requisicao.obra_id }, null, 1);
      const obra = obras[0];
      await sendEmail({
        to: requisicao.solicitante,
        subject: `Requisição ${novoStatus === 'aprovada' ? 'Aprovada' : 'Rejeitada'} - ${requisicao.descricao_resumo || requisicao.titulo}`,
        body: `Sua requisição de compra foi ${novoStatus === 'aprovada' ? 'aprovada' : 'rejeitada'}.\n\n`
          + `Obra: ${obra?.nome || 'N/A'}\n`
          + `Descrição: ${requisicao.descricao_resumo || requisicao.titulo}\n`
          + `Aprovador: ${emailAprovador}`
          + `${aprovado ? `\nOrdem de Compra: ${ordemCompra?.numero}` : ''}`
          + `${motivo ? `\n\nMotivo: ${motivo}` : ''}\n\nSistema GERMANOS CONSTRULOG`
      });
    } catch { /* e-mail é best-effort */ }
  }

  return {
    success: true,
    status: novoStatus,
    ordem_compra: ordemCompra,
    message: `Requisição ${novoStatus === 'aprovada' ? 'aprovada' : 'rejeitada'} com sucesso${aprovado ? ' e ordem de compra gerada' : ''}`
  };
}
