import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

const CARGOS_APROVADORES = ['diretor', 'engenheiro_coordenador', 'engenheiro_obra'];

// Aprova ou recusa uma solicitação de máquina. Permissão: super admin OU
// cargo aprovador. Usada por /SolicitacoesMaquinas.
export default async function aprovarSolicitacaoMaquina({ body, user }) {
  if (!isSuperAdmin(user) && !CARGOS_APROVADORES.includes(String(user?.cargo || '').toLowerCase())) {
    throw Object.assign(new Error('Sem permissão para aprovar solicitações'), { status: 403 });
  }

  const { solicitacao_id, aprovar, motivo_recusa } = body || {};
  if (!solicitacao_id) {
    throw Object.assign(new Error('solicitacao_id obrigatório'), { status: 400 });
  }

  const [sol] = await store.filter('SolicitacaoMaquina', { id: solicitacao_id }, null, 1);
  if (!sol) {
    throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });
  }
  if (sol.status !== 'enviada' && sol.status !== 'rascunho') {
    throw Object.assign(new Error(`Solicitação já foi processada (status: ${sol.status})`), { status: 400 });
  }

  const novoStatus = aprovar ? 'aprovada' : 'recusada';
  const solicitacao = await store.update('SolicitacaoMaquina', solicitacao_id, {
    status: novoStatus,
    motivo_recusa: aprovar ? null : (motivo_recusa || 'Sem motivo especificado')
  });

  try {
    await store.create('LogAuditoria', {
      user_email: user?.email,
      acao: aprovar ? 'aprovar' : 'recusar',
      modulo: 'solicitacao_maquinas',
      entidade: 'SolicitacaoMaquina',
      entidade_id: solicitacao_id,
      dados_anteriores: sol,
      dados_novos: solicitacao,
      detalhes: aprovar
        ? `Aprovada solicitação de ${sol.tipo_maquina}`
        : `Recusada solicitação de ${sol.tipo_maquina}: ${motivo_recusa || '-'}`,
      sucesso: true
    }, user?.email || null);
  } catch { /* auditoria é best-effort */ }

  return { ok: true, solicitacao, mensagem: aprovar ? 'Solicitação aprovada' : 'Solicitação recusada' };
}
