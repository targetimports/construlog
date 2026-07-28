import { store } from '../entityStore.js';

// Vincula a NF a um registro (pedido de compra, conta a pagar, recebimento, etc.).
export default async function notaFiscalVincular({ body, user }) {
  const { documento_fiscal_id, referencia_tipo, referencia_id, referencia_nome, obra_id } = body || {};
  if (!documento_fiscal_id || !referencia_id) {
    throw Object.assign(new Error('Documento e referência são obrigatórios.'), { status: 400 });
  }
  const vinculo = await store.create('NotaFiscalVinculo', {
    documento_fiscal_id,
    referencia_tipo: referencia_tipo || null,
    referencia_id,
    referencia_nome: referencia_nome || '',
    obra_id: obra_id || null,
  }, user?.email || null);
  return { vinculo };
}
