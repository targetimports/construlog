import { store } from '../entityStore.js';

// Retorna a NF e seu histórico de auditoria.
export default async function notaFiscalObter({ body }) {
  const { documento_fiscal_id } = body || {};
  const arr = await store.filter('NotaFiscal', { id: documento_fiscal_id }, undefined, 1);
  const auditoria = await store.filter('AuditLogNF', { documento_fiscal_id }, '-created_date', 200);
  return { nf: arr[0] || null, auditoria };
}
