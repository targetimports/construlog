import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';
import { enviarAgendamento } from '../relatorioAgendado.js';

// Envio MANUAL ("Enviar agora") de um relatório agendado.
// Não reprograma o próximo envio automático (avancar: false).
export default async function enviarRelatorioPorEmail({ body, user }) {
  requirePermission(user, 'RELATORIOS_VIEW');
  const id = body?.relatorio_id;
  if (!id) return { success: false, error: 'relatorio_id é obrigatório' };

  const rel = (await store.filter('RelatorioAgendado', { id }))[0];
  if (!rel) return { success: false, error: 'Agendamento não encontrado' };

  return enviarAgendamento(rel, { avancar: false });
}
