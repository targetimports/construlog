import { store } from '../entityStore.js';

const num = (v) => Number(v) || 0;
const RECALC = ['valor_total', 'valor_desconto', 'valor_frete', 'valor_outros'];

// Edita um campo da NF (com log de auditoria) e recalcula o valor final.
export default async function notaFiscalEditar({ body, user }) {
  const { documento_fiscal_id, campo, valor_novo, motivo } = body || {};
  if (!documento_fiscal_id || !campo) {
    throw Object.assign(new Error('Documento e campo são obrigatórios.'), { status: 400 });
  }
  const arr = await store.filter('NotaFiscal', { id: documento_fiscal_id }, undefined, 1);
  const atual = arr[0];
  if (!atual) throw Object.assign(new Error('Documento fiscal não encontrado.'), { status: 404 });

  const valorAntigo = atual[campo];
  const patch = { [campo]: valor_novo };
  const merged = { ...atual, ...patch };
  if (RECALC.includes(campo)) {
    patch.valor_final_ajustado = num(merged.valor_total) - num(merged.valor_desconto) + num(merged.valor_frete) + num(merged.valor_outros);
  }
  const nf = await store.update('NotaFiscal', documento_fiscal_id, patch);

  await store.create('AuditLogNF', {
    documento_fiscal_id,
    acao: 'EDICAO',
    campo_alterado: campo,
    valor_antigo: valorAntigo == null ? '' : String(valorAntigo),
    valor_novo: valor_novo == null ? '' : String(valor_novo),
    motivo: motivo || '',
    user_nome: user?.email || '',
  }, user?.email || null);

  return { nf };
}
