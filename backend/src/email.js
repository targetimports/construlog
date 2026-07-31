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
// A configuração vem da tela Sistema › Integrações externas, com o .env vencendo
// quando definido lá. Antes era lida uma única vez, na importação do módulo: quem
// configurasse o SMTP pelo painel só via efeito no próximo restart do servidor.
// Agora resolve sob demanda e guarda em cache — `recarregarEmail()` derruba o
// cache quando a tela salva, para valer na hora.
const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

let cache = null;      // { host, porta, usuario, senha, remetente }
let transporte = null; // nodemailer, recriado quando a config muda

/** Lê do banco (ou do .env, que tem precedência). */
export async function carregarEmail() {
  let v = {};
  try {
    const { configDe } = await import('./integracoesExternas.js');
    v = (await configDe('email'))?.valores || {};
  } catch {
    // Banco fora do ar ou entidade ainda não migrada: cai no .env puro, para
    // uma falha de leitura não deixar o sistema mudo.
    v = {};
  }

  cache = {
    host: v.host || process.env.SMTP_HOST || '',
    porta: Number(v.porta || process.env.SMTP_PORT) || 465,
    usuario: v.usuario || process.env.SMTP_USER || '',
    senha: v.senha || process.env.SMTP_PASS || '',
    remetente: v.remetente || process.env.EMAIL_REMETENTE || '',
  };

  transporte = (cache.host && cache.usuario && cache.senha)
    ? nodemailer.createTransport({
      host: cache.host,
      port: cache.porta,
      secure: cache.porta === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user: cache.usuario, pass: cache.senha },
    })
    : null;

  return cache;
}

export function recarregarEmail() { cache = null; transporte = null; }

const config = () => cache || {
  host: process.env.SMTP_HOST || '',
  porta: Number(process.env.SMTP_PORT) || 465,
  usuario: process.env.SMTP_USER || '',
  senha: process.env.SMTP_PASS || '',
  remetente: process.env.EMAIL_REMETENTE || '',
};

/**
 * Há remetente utilizável? Leitura síncrona do cache, porque o agendador chama
 * isto a cada ciclo e não pode virar I/O. O cache é preenchido no boot.
 */
export function emailConfigured() {
  const c = config();
  const temSmtp = !!(c.host && c.usuario && c.senha);
  return !!((temSmtp || resendClient) && (c.remetente || c.usuario));
}

// Envia um e-mail. Aceita html OU text/body (auto-detecta HTML).
// { to, subject, html, text, body, from, cc, bcc, reply_to }
// Retorna { ok, id?, stubbed?, via?, error? }.
export async function sendEmail({ to, subject, html, text, body, from, cc, bcc, reply_to } = {}) {
  if (!to || !subject) return { ok: false, error: 'to_and_subject_required' };

  if (!cache) await carregarEmail();
  const c = config();

  // Remetente: nome do branding + endereço autenticado (remetente configurado ou
  // o próprio usuário SMTP — o servidor só aceita enviar em nome de quem autenticou).
  let fromAddr = from;
  if (!fromAddr) {
    const addr = extractAddr(c.remetente) || c.usuario;
    let nome = '';
    try { nome = (await getBranding()).nome; } catch { /* ignore */ }
    fromAddr = addr ? `${(nome || '').trim()} <${addr}>`.trim() : (c.remetente || c.usuario);
  }
  const conteudo = html ?? body ?? text ?? '';
  const isHtml = html != null || (typeof conteudo === 'string' && /<[a-z][\s\S]*>/i.test(conteudo));
  const toList = Array.isArray(to) ? to : [to];

  // 1) SMTP (Hostinger etc.)
  if (transporte) {
    if (!fromAddr) return { ok: false, error: 'remetente_ausente (configure em Sistema › Integrações externas)' };
    try {
      const info = await transporte.sendMail({
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
  console.log('[email:stub] to=%s subject="%s" (configure o SMTP em Sistema › Integrações externas)',
    toList.join(', '), subject);
  return { ok: true, stubbed: true };
}
