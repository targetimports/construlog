import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Cria um documento fiscal (NF) em rascunho a partir do arquivo enviado.
export default async function notaFiscalCriar({ body, user }) {
  requirePermission(user, 'COMPRAS_CREATE');
  const { arquivo_url, tipo = 'NF' } = body || {};
  const nf = await store.create('NotaFiscal', {
    arquivo_url: arquivo_url || null,
    tipo,
    numero: '',
    chave_acesso: '',
    emissor_nome: '',
    emissor_cnpj: '',
    data_emissao: new Date().toISOString().split('T')[0],
    valor_total: 0,
    valor_desconto: 0,
    valor_frete: 0,
    valor_outros: 0,
    valor_final_ajustado: 0,
    status: 'RASCUNHO',
  }, user?.email || null);
  return nf;
}
