import { store } from '../entityStore.js';

// Lista as NFs vinculadas a um registro (via NotaFiscalVinculo).
export default async function notaFiscalListar({ body }) {
  const { referencia_tipo, referencia_id } = body || {};
  if (!referencia_id) return { nfs: [] };

  const vinculos = await store.filter('NotaFiscalVinculo', { referencia_id }, '-created_date', 200);
  const filtrados = referencia_tipo ? vinculos.filter((v) => v.referencia_tipo === referencia_tipo) : vinculos;

  const nfs = [];
  for (const v of filtrados) {
    const arr = await store.filter('NotaFiscal', { id: v.documento_fiscal_id }, undefined, 1);
    if (arr[0]) nfs.push(arr[0]);
  }
  return { nfs };
}
