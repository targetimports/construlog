import { store } from '../entityStore.js';
import { sendEmail } from '../email.js';

// Notifica por e-mail o criador sobre o novo evento (best-effort — não bloqueia o cadastro).
export default async function enviarEmailNovoEvento({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const { titulo, tipo, data_inicio, data_fim, prioridade, descricao, local, obra_id } = body || {};
  if (!titulo || !data_inicio) throw Object.assign(new Error('Dados do evento obrigatórios'), { status: 400 });

  let nomeObra = '';
  if (obra_id) {
    try {
      const [obra] = await store.filter('Obra', { id: obra_id }, null, 1);
      nomeObra = obra?.nome || obra_id;
    } catch { /* ignore */ }
  }

  const dataFormatada = new Date(data_inicio).toLocaleDateString('pt-BR');
  const dataFimFormatada = data_fim ? new Date(data_fim).toLocaleDateString('pt-BR') : '';

  const corpo = `<h2>Novo Evento Agendado</h2>
    <p><strong>Título:</strong> ${titulo}</p>
    <p><strong>Tipo:</strong> ${tipo}</p>
    <p><strong>Data Início:</strong> ${dataFormatada}</p>
    ${dataFimFormatada ? `<p><strong>Data Fim:</strong> ${dataFimFormatada}</p>` : ''}
    <p><strong>Prioridade:</strong> ${prioridade}</p>
    ${local ? `<p><strong>Local:</strong> ${local}</p>` : ''}
    ${nomeObra ? `<p><strong>Obra:</strong> ${nomeObra}</p>` : ''}
    ${descricao ? `<p><strong>Descrição:</strong> ${descricao}</p>` : ''}
    <p><strong>Criado por:</strong> ${user.full_name || ''} (${user.email})</p>`;

  try {
    await sendEmail({ to: user.email, subject: `Novo evento agendado: ${titulo}`, html: corpo });
    return { success: true, message: 'Email enviado' };
  } catch {
    return { success: true, message: 'Evento criado (e-mail não enviado)', source: 'fallback' };
  }
}
