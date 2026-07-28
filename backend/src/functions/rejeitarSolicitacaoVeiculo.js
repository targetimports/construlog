import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

async function podeAprovarVeiculo(user) {
  if (isSuperAdmin(user)) return true;
  const perms = await store.filter('PermissaoUsuario', { user_email: user?.email }, null, 100);
  return perms.some(p => ['logistica', 'supervisor', 'gerente'].includes(String(p.cargo || '').toLowerCase()));
}

// Rejeita a solicitação (enviada → rejeitada) com motivo. Usada pelo modal.
export default async function rejeitarSolicitacaoVeiculo({ body, user }) {
  const { solicitacao_id, motivo } = body || {};
  if (!solicitacao_id) {
    throw Object.assign(new Error('solicitacao_id obrigatório'), { status: 400 });
  }
  if (!(await podeAprovarVeiculo(user))) {
    throw Object.assign(new Error('Sem permissão'), { status: 403 });
  }

  const solicitacao = await store.update('SolicitacaoVeiculo', solicitacao_id, {
    status: 'rejeitada',
    motivo_rejeicao: motivo || '',
    aprovado_por_user_id: user?.email
  });
  if (!solicitacao) {
    throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });
  }

  return { success: true, solicitacao };
}
