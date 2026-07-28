import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// Permissão de aprovação de veículo: super admin OU PermissaoUsuario com
// cargo logistica/supervisor/gerente (mesma regra do base44).
async function podeAprovarVeiculo(user) {
  if (isSuperAdmin(user)) return true;
  const perms = await store.filter('PermissaoUsuario', { user_email: user?.email }, null, 100);
  return perms.some(p => ['logistica', 'supervisor', 'gerente'].includes(String(p.cargo || '').toLowerCase()));
}

// Aprova a solicitação (enviada → aprovada), vinculando veículo + motorista,
// e cria a Viagem automaticamente (status aguardando_saida).
export default async function aprovarSolicitacaoVeiculo({ body, user }) {
  const { solicitacao_id, veiculo_id, motorista_user_id } = body || {};
  if (!solicitacao_id || !veiculo_id || !motorista_user_id) {
    throw Object.assign(new Error('veiculo_id e motorista_user_id obrigatórios'), { status: 400 });
  }
  if (!(await podeAprovarVeiculo(user))) {
    throw Object.assign(new Error('Sem permissão para aprovar'), { status: 403 });
  }

  const [sol] = await store.filter('SolicitacaoVeiculo', { id: solicitacao_id }, null, 1);
  if (!sol) {
    throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });
  }

  const solicitacao = await store.update('SolicitacaoVeiculo', solicitacao_id, {
    status: 'aprovada',
    veiculo_id,
    motorista_user_id,
    aprovado_por_user_id: user?.email
  });

  const viagem = await store.create('Viagem', {
    solicitacao_id,
    obra_id: sol.obra_id || null,
    cliente_id: sol.cliente_id || null,
    veiculo_id,
    motorista_user_id,
    status: 'aguardando_saida'
  }, user?.email || null);

  return { success: true, solicitacao, viagem };
}
