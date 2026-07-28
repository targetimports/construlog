import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { store } from './entityStore.js';

const extractAddr = (s) => {
  if (!s) return '';
  const m = String(s).match(/<([^>]+)>/);
  return (m ? m[1] : String(s)).trim();
};

// Branding do grupo (nome/logo) vindo da Empresa MATRIZ — usado no remetente e no
// cabeçalho dos e-mails. Fallback silencioso pro padrão se a leitura falhar.
export async function getBranding() {
  try {
    const empresas = (await store.filter('Empresa', {}, null, 50)) || [];
    const m = empresas.find((e) => e.tipo === 'matriz') || empresas[0] || {};
    return {
      nome: m.nome_sistema || m.nome || 'Construlog',
      logo_url: m.logo_url || null,
      favicon_url: m.favicon_url || null,
    };
  } catch {
    return { nome: 'Construlog', logo_url: null, favicon_url: null };
  }
}

// Envio de e-mail com dois back-ends possíveis, nesta ordem de preferência:
//   1) SMTP (ex.: Hostinger/Titan) — ativa quando SMTP_HOST + SMTP_USER + SMTP_PASS estão setados.
//   2) Resend — ativa quando RESEND_API_KEY está setado.
//   3) Stub — sem config, apenas loga (não envia), pra não quebrar os fluxos.
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const smtpPort = Number(process.env.SMTP_PORT) || 465;
const smtpTransport = (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  : null;

export function emailConfigured() {
  return !!((smtpTransport || resendClient) && (process.env.EMAIL_REMETENTE || process.env.SMTP_USER));
}

// Envia um e-mail. Aceita html OU text/body (auto-detecta HTML).
// { to, subject, html, text, body, from, cc, bcc, reply_to }
// Retorna { ok, id?, stubbed?, via?, error? }.
export async function sendEmail({ to, subject, html, text, body, from, cc, bcc, reply_to } = {}) {
  if (!to || !subject) return { ok: false, error: 'to_and_subject_required' };

  // Remetente: nome do branding + endereço autenticado (EMAIL_REMETENTE/SMTP_USER).
  let fromAddr = from;
  if (!fromAddr) {
    const addr = extractAddr(process.env.EMAIL_REMETENTE) || process.env.SMTP_USER;
    let nome = '';
    try { nome = (await getBranding()).nome; } catch { /* ignore */ }
    fromAddr = addr ? `${(nome || '').trim()} <${addr}>`.trim() : (process.env.EMAIL_REMETENTE || process.env.SMTP_USER);
  }
  const conteudo = html ?? body ?? text ?? '';
  const isHtml = html != null || (typeof conteudo === 'string' && /<[a-z][\s\S]*>/i.test(conteudo));
  const toList = Array.isArray(to) ? to : [to];

  // 1) SMTP (Hostinger etc.)
  if (smtpTransport) {
    if (!fromAddr) return { ok: false, error: 'remetente_ausente (defina EMAIL_REMETENTE ou SMTP_USER)' };
    try {
      const info = await smtpTransport.sendMail({
        from: fromAddr,
        to: toList,
        subject,
        [isHtml ? 'html' : 'text']: conteudo,
        cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
        bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
        replyTo: reply_to || undefined,
      });
      return { ok: true, id: info.messageId, via: 'smtp' };
    } catch (err) {
      return { ok: false, error: err.message, via: 'smtp' };
    }
  }

  // 2) Resend
  if (resendClient) {
    if (!fromAddr) return { ok: false, error: 'remetente_ausente (defina EMAIL_REMETENTE)' };
    const payload = { from: fromAddr, to: toList, subject, [isHtml ? 'html' : 'text']: conteudo };
    if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
    if (reply_to) payload.reply_to = reply_to;
    try {
      const { data, error } = await resendClient.emails.send(payload);
      if (error) return { ok: false, error: typeof error === 'string' ? error : (error.message || 'resend_failed'), via: 'resend' };
      return { ok: true, id: data?.id, via: 'resend' };
    } catch (err) {
      return { ok: false, error: err.message, via: 'resend' };
    }
  }

  // 3) Stub
  console.log('[email:stub] to=%s subject="%s" (configure SMTP_* ou RESEND_API_KEY para envio real)',
    toList.join(', '), subject);
  return { ok: true, stubbed: true };
}
