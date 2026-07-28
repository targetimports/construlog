import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// Aprovar Ordem de Compra com regra de ALÇADA (threshold compras_threshold_n1):
//   valor <= teto  -> aprovação DIRETA (status: aprovada)
//   valor >  teto  -> cria Aprovacao pendente (status: em_aprovacao)
const podeAprovarOC = (user) => {
  if (isSuperAdmin(user)) return true;
  const role = String(user?.role || '').toLowerCase();
  const cargo = String(user?.cargo || '').toLowerCase();
  return ['diretor', 'compras', 'admin', 'admin_empresa'].includes(role) || ['diretor', 'compras'].includes(cargo);
};

export default async function aprovarOrdemCompra({ body, user }) {
  if (!user) throw Object.assign(new Error('Não autenticado'), { status: 401 });
  if (!podeAprovarOC(user)) throw Object.assign(new Error('Sem permissão para aprovar OC'), { status: 403 });

  const { oc_id } = body || {};
  if (!oc_id) throw Object.assign(new Error('oc_id é obrigatório'), { status: 400 });

  const ocs = await store.filter('OrdemCompra', { id: oc_id }, null, 1);
  const oc = ocs[0];
  if (!oc) throw Object.assign(new Error('OC não encontrada'), { status: 404 });

  if (!oc.obra_id) throw Object.assign(new Error('Obra é obrigatória para aprovar OC'), { status: 422 });
  if (!oc.fornecedor_id && !oc.fornecedor_nome) throw Object.assign(new Error('Fornecedor é obrigatório para aprovar OC'), { status: 422 });
  if (oc.status !== 'criada') throw Object.assign(new Error(`OC já está com status: ${oc.status}`), { status: 422 });

  // Normaliza o valor (aceita string "R$ 1.234,56")
  let oc_valor = oc.valor_total;
  if (typeof oc_valor === 'string') {
    oc_valor = oc_valor.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  }
  oc_valor = parseFloat(oc_valor);
  if (isNaN(oc_valor) || oc_valor <= 0) throw Object.assign(new Error('Valor total da OC inválido ou menor/igual a zero'), { status: 400 });

  // Threshold de alçada N1 (chave do catálogo de configurações)
  const configN1 = await store.filter('ConfiguracaoSistema', { chave: 'compras_threshold_n1' });
  let thresholdN1 = parseFloat(configN1?.[0]?.valor || '5000');
  if (isNaN(thresholdN1)) thresholdN1 = 5000;

  if (oc_valor > thresholdN1) {
    // Acima do teto -> aprovação pendente
    const aprovExist = await store.filter('Aprovacao', { referencia_id: oc_id, status: 'pendente' });
    if (aprovExist && aprovExist.length > 0) {
      return { ok: true, branch: 'REQUIRES_APPROVAL', oc_id, oc_valor, thresholdN1, aprovacao_id: aprovExist[0].id, message: 'OC já aguardando aprovação' };
    }
    const aprovacao = await store.create('Aprovacao', {
      modulo: 'compras', referencia_tipo: 'OrdemCompra', referencia_id: oc_id, obra_id: oc.obra_id,
      valor: oc_valor, nivel: 'N1', status: 'pendente',
      solicitado_por: user.email, solicitado_em: new Date().toISOString(),
      descricao: `OC ${oc.numero || oc_id} - ${oc.fornecedor_nome} - R$ ${oc_valor.toFixed(2)}`
    });
    await store.update('OrdemCompra', oc_id, { status: 'em_aprovacao' });
    return { ok: true, branch: 'REQUIRES_APPROVAL', oc_id, oc_valor, thresholdN1, aprovacao_id: aprovacao.id, message: 'OC enviada para aprovação' };
  }

  // Dentro do teto -> aprovação direta
  await store.update('OrdemCompra', oc_id, {
    status: 'aprovada',
    aprovado_por: user.email,
    data_aprovacao: new Date().toISOString().split('T')[0]
  });
  return { ok: true, branch: 'DIRECT', oc_id, oc_valor, thresholdN1, aprovacao_id: null, message: 'OC aprovada com sucesso' };
}
