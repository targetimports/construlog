import { store } from '../entityStore.js';

// Lança uma NF APROVADA no financeiro: cria a ContaPagar (fallback
// LancamentoFinanceiro) e marca a NF como LANCADA.
export default async function lancarNotaFiscalNoFinanceiro({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { nota_fiscal_id } = body || {};
  if (!nota_fiscal_id) throw Object.assign(new Error('nota_fiscal_id obrigatório'), { status: 400 });

  const nfs = await store.filter('NotaFiscal', { id: nota_fiscal_id }, null, 1);
  const nf = nfs[0];
  if (!nf) throw Object.assign(new Error('NF não encontrada'), { status: 404 });
  if (nf.status !== 'APROVADA') throw Object.assign(new Error('NF deve estar em status APROVADA'), { status: 400 });

  // Consolidado: grava na ContaFinanceira (modelo ÚNICO que o Dashboard e as telas
  // financeiras leem), tipo 'pagar'. Antes ia para a ContaPagar (órfã/vazia), então
  // a conta a pagar da NF não aparecia junto das demais.
  const lancamento = await store.create('ContaFinanceira', {
    obra_id: nf.obra_id,
    descricao: `NF ${nf.numero}/${nf.serie} - ${nf.fornecedor_nome}`,
    valor: nf.valor_total,
    valor_pago: 0,
    fornecedor_cliente: nf.fornecedor_nome,
    fornecedor_cnpj: nf.fornecedor_cnpj,
    data_emissao: new Date().toISOString().split('T')[0],
    data_vencimento: nf.data_emissao,
    tipo: 'pagar',
    status: 'pendente',
    categoria: 'fornecedores',
    forma_pagamento: 'transferencia',
    referencia_tipo: 'NotaFiscal',
    referencia_id: nf.id,
    observacao: `Gerada automaticamente da NF ${nf.numero}`
  });
  const lancamento_id = lancamento.id;

  await store.update('NotaFiscal', nota_fiscal_id, {
    status: 'LANCADA',
    lancamento_financeiro_id: lancamento_id,
    data_lancamento: new Date().toISOString(),
    revisada_por: user.email
  });

  try {
    await store.create('AuditLogNF', { nota_fiscal_id, acao: 'LANCADA', usuario_email: user.email, descricao: `Lançado no financeiro (ID: ${lancamento_id})` });
  } catch { /* auditoria best-effort */ }

  return { message: 'NF aprovada e lançada no financeiro', lancamento_id };
}
