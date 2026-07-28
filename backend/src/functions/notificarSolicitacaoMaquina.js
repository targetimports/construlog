import { store } from '../entityStore.js';
import { query } from '../db.js';

// Notifica os admins (Notificacao no sistema) sobre nova solicitação de máquina.
// 100% best-effort: nunca lança, para não quebrar o fluxo de criação que a chama
// logo após o criarSolicitacaoMaquina.
export default async function notificarSolicitacaoMaquina({ body }) {
  const { obraNome, tipoMaquina, dataInicio, dataFim, custoTotal, urgente, solicitanteNome } = body || {};
  let admins_notificados = 0;
  try {
    const { rows } = await query("SELECT email FROM auth_users WHERE role IN ('admin','programador')");
    const custoFormatado = custoTotal
      ? Number(custoTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '-';
    const dIni = dataInicio ? new Date(dataInicio).toLocaleDateString('pt-BR') : '-';
    const dFim = dataFim ? new Date(dataFim).toLocaleDateString('pt-BR') : '-';
    const titulo = `${urgente ? '🚨 Urgente - ' : ''}Nova Solicitação de Máquina`;
    const mensagem = `${solicitanteNome || 'Alguém'} solicitou ${tipoMaquina || 'máquina'} para a obra ${obraNome || ''} de ${dIni} a ${dFim}. Custo estimado: ${custoFormatado}`;
    for (const admin of rows) {
      try {
        await store.create('Notificacao', {
          destinatario_email: admin.email,
          tipo: urgente ? 'alerta' : 'info',
          titulo,
          mensagem,
          lida: false,
          link_acao: 'SolicitacoesMaquinas'
        }, null);
        admins_notificados++;
      } catch { /* ignora falha individual */ }
    }
  } catch { /* best-effort */ }

  return { success: true, admins_notificados };
}
