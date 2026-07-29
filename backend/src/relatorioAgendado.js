import { store } from './entityStore.js';
import { sendEmail, emailConfigured } from './email.js';

const moeda = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// E-mails dos stakeholders (aceita array de strings ou de { email, nome }).
const emailsDe = (rel) => (rel.stakeholders || [])
  .map((s) => (typeof s === 'string' ? s : s?.email))
  .filter(Boolean);

function montarHtml(rel, obra) {
  const linhas = [];
  if (rel.incluir_progresso !== false) {
    linhas.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">Progresso físico</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right"><strong>${Number(obra.percentual_concluido || 0)}%</strong></td></tr>`);
  }
  if (rel.incluir_custos !== false) {
    linhas.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">Valor do contrato</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${moeda(obra.valor_contrato || obra.total_orcamento)}</td></tr>`);
    linhas.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">Valor realizado</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${moeda(obra.valor_realizado)}</td></tr>`);
  }
  if (rel.incluir_cronograma !== false && obra.data_termino) {
    linhas.push(`<tr><td style="padding:8px;border-bottom:1px solid #eee">Término previsto</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${new Date(obra.data_termino).toLocaleDateString('pt-BR')}</td></tr>`);
  }
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#111827">
    <h2 style="color:#1f2937;margin-bottom:4px">${rel.nome || 'Relatório'}</h2>
    <p style="color:#6b7280;margin-top:0">Obra: <strong>${obra.nome || '—'}</strong> · ${new Date().toLocaleDateString('pt-BR')}</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tbody>${linhas.join('') || '<tr><td style="padding:8px">Nenhuma seção selecionada.</td></tr>'}</tbody>
    </table>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Relatório automático — CONSTRULOG CONSTRULOG</p>
  </div>`;
}

function avancarProximo(rel) {
  const base = rel.proximo_envio ? new Date(rel.proximo_envio) : new Date();
  const prox = new Date(base);
  if (rel.frequencia === 'semanal') prox.setDate(prox.getDate() + 7);
  else if (rel.frequencia === 'mensal') prox.setMonth(prox.getMonth() + 1);
  else prox.setDate(prox.getDate() + 1); // diário / outros
  return prox.toISOString();
}

// Envia um agendamento agora. avancar=true reprograma o próximo envio (uso do cron).
export async function enviarAgendamento(rel, { avancar = true } = {}) {
  if (!emailConfigured()) {
    return { success: false, error: 'Envio por e-mail não configurado (defina RESEND_API_KEY e EMAIL_REMETENTE no servidor).' };
  }
  const destinos = emailsDe(rel);
  if (!destinos.length) return { success: false, error: 'Agendamento sem destinatários com e-mail' };

  const obra = rel.obra_id ? (await store.filter('Obra', { id: rel.obra_id }))[0] : null;
  const html = montarHtml(rel, obra || {});
  const subject = `${rel.nome || 'Relatório'} — ${obra?.nome || 'Obra'}`;

  const res = await sendEmail({ to: destinos, subject, html });
  if (!res.ok) return { success: false, error: res.error };

  const patch = { ultimo_envio: new Date().toISOString() };
  if (avancar) patch.proximo_envio = avancarProximo(rel);
  await store.update('RelatorioAgendado', rel.id, patch).catch(() => {});

  return { success: true, emailsEnviados: destinos, proximo_envio: patch.proximo_envio || rel.proximo_envio };
}
