import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Fase 3 — inicia uma manutenção agendada (agendada → em_andamento) e marca o ativo
// como 'manutencao' (fica indisponível para empréstimo). Manutenção é da Matriz (global).
export default async function iniciarManutencaoAtivo({ body, user }) {
  requirePermission(user, 'EQUIPAMENTOS_VIEW');
  const { manutencao_id } = body || {};
  if (!manutencao_id) return { success: false, error: 'manutencao_id é obrigatório' };

  const m = (await store.filter('ManutencaoAtivo', { id: manutencao_id }))[0];
  if (!m) return { success: false, error: 'Manutenção não encontrada' };
  if (m.status !== 'agendada') return { success: false, error: `Manutenção não está agendada (${m.status})` };

  await store.update('ManutencaoAtivo', manutencao_id, { status: 'em_andamento' });
  if (m.ativo_id) await store.update('Ativo', m.ativo_id, { status: 'manutencao' });

  return { success: true, status: 'em_andamento' };
}
