import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';
import { query } from '../db.js';

// Envia a solicitação (rascunho → enviada) e notifica os admins via Notificacao
// no sistema (best-effort, não bloqueia o envio). Usada pelo SolicitacaoVeiculoModal.

export default async function enviarSolicitacaoVeiculo({ body, user }) {
  const { solicitacao_id } = body || {};
  if (!solicitacao_id) {
    throw Object.assign(new Error('solicitacao_id obrigatório'), { status: 400 });
  }

  const [sol] = await store.filter('SolicitacaoVeiculo', { id: solicitacao_id }, null, 1);
  if (!sol) {
    throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });
  }
  if (sol.solicitante_user_id !== user?.email && !isSuperAdmin(user)) {
    throw Object.assign(new Error('Sem permissão'), { status: 403 });
  }
  if (!sol.finalidade || !sol.data_saida_prevista) {
    throw Object.assign(new Error('Preencha finalidade e data de saída'), { status: 400 });
  }

  const atualizada = await store.update('SolicitacaoVeiculo', solicitacao_id, { status: 'enviada' });

  // Notificação no sistema para admins (best-effort).
  let admins_notificados = 0;
  try {
    const { rows } = await query("SELECT email FROM auth_users WHERE role IN ('admin','programador')");
    const dataSaida = sol.data_saida_prevista
      ? new Date(sol.data_saida_prevista).toLocaleString('pt-BR')
      : '-';
    const titulo = `Nova Solicitação de Veículo: ${sol.numero || solicitacao_id}`;
    const mensagem = `${user?.full_name || user?.email} solicitou um veículo.\n`
      + `Finalidade: ${sol.finalidade}\n`
      + `Urgência: ${sol.urgencia || '-'}\n`
      + `Saída Prevista: ${dataSaida}\n`
      + `Origem: ${sol.origem || '-'}\nDestino: ${sol.destino || '-'}`;
    for (const admin of rows) {
      try {
        await store.create('Notificacao', {
          destinatario_email: admin.email,
          tipo: 'alerta',
          titulo,
          mensagem,
          lida: false,
          link_acao: '/SolicitacoesVeiculos',
          usuario_relacionado_email: user?.email,
          usuario_relacionado_nome: user?.full_name || user?.email
        }, user?.email || null);
        admins_notificados++;
      } catch { /* ignora falha individual */ }
    }
  } catch { /* notificação é best-effort */ }

  return { success: true, solicitacao: atualizada, admins_notificados };
}
