import { store } from '../entityStore.js';

const getById = async (name, id) => (id ? (await store.filter(name, { id }))[0] : null) || null;

import { requirePermission } from '../rbac.js';

export default async function rejeitarApontamentoHora({ body, user }) {
  requirePermission(user, 'RH_EDIT');
  const { apontamento_id, motivo } = body || {};
  if (!apontamento_id) throw Object.assign(new Error('apontamento_id é obrigatório'), { status: 400 });

  const ap = await getById('ApontamentoHora', apontamento_id);
  if (!ap) throw Object.assign(new Error('Apontamento não encontrado'), { status: 404 });
  if (ap.status !== 'rascunho') {
    throw Object.assign(new Error('Apenas apontamentos em rascunho podem ser rejeitados'), { status: 400 });
  }

  const atualizado = await store.update('ApontamentoHora', apontamento_id, {
    status: 'rejeitado', observacao: motivo || ap.observacao,
  });

  await store.create('LogAuditoria', {
    user_email: user?.email, acao: 'REJECT', modulo: 'RH',
    entidade: 'ApontamentoHora', entidade_id: apontamento_id,
    dados_anteriores: ap, dados_novos: atualizado, sucesso: true,
  }).catch(() => {});

  return { ok: true, apontamento: atualizado };
}
