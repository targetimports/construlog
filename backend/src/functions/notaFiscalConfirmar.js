import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Confirma o documento fiscal (bloqueia para futuras edições — §32).
export default async function notaFiscalConfirmar({ body, user }) {
  requirePermission(user, 'COMPRAS_CREATE');
  const { documento_fiscal_id } = body || {};
  const nf = await store.update('NotaFiscal', documento_fiscal_id, {
    status: 'CONFIRMADO',
    data_confirmacao: new Date().toISOString(),
  });
  if (!nf) throw Object.assign(new Error('Documento fiscal não encontrado.'), { status: 404 });

  await store.create('AuditLogNF', {
    documento_fiscal_id,
    acao: 'CONFIRMACAO',
    user_nome: user?.email || '',
  }, user?.email || null);

  return { nf };
}
