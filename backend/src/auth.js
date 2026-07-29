import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { query } from './db.js';
import { store } from './entityStore.js';
import { sendEmail, getBranding } from './email.js';
import { requireAuth, signToken } from './middleware.js';
import { limitePorIP } from './rateLimit.js';

const router = Router();

// Base pública para os links de aprovação enviados por e-mail (admin clica no e-mail).
const APP_URL = (process.env.APP_PUBLIC_URL || 'https://construlog.com.br').replace(/\/$/, '');
const paginaHtml = (titulo, msg, cor, bg, icone) => `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<style>*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f4f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;color:#111827}
.card{background:#fff;max-width:420px;width:100%;border:1px solid #ececee;border-radius:20px;padding:44px 34px;text-align:center;box-shadow:0 12px 40px rgba(17,24,39,.06)}
.badge{width:66px;height:66px;line-height:66px;border-radius:9999px;margin:0 auto 22px;font-size:30px;font-weight:700}
h1{margin:0 0 10px;font-size:22px;font-weight:700}
p{margin:0;font-size:14px;line-height:1.6;color:#6b7280}
.brand{margin-top:30px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#b8bcc2;font-weight:700}
.bar{height:4px;background:${cor};border-radius:9999px;width:44px;margin:22px auto 0}</style></head>
<body><div class="card"><div class="badge" style="background:${bg};color:${cor}">${icone}</div><h1 style="color:${cor}">${titulo}</h1><p>${msg}</p><div class="bar"></div><div class="brand">Construlog ConstruLog</div></div></body></html>`;

// Campos protegidos do usuário que não podem ser sobrescritos via updateMe.
// (email tem tratamento próprio — troca controlada com validação de unicidade.)
const PROTECTED = new Set(['id', 'email', 'password', 'password_hash', 'created_date', 'updated_date']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Monta o objeto User no formato que o frontend espera: campos fixos + extras
// guardados em data (JSONB). base44 trata User como uma entidade com campos
// customizados (role, permissões, etc.), então espelhamos isso.
const sanitizeUser = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  role: row.role,
  ...(row.data || {}),
  created_date: row.created_date,
  updated_date: row.updated_date,
});

// Força bruta: 10 tentativas a cada 15 min por IP. Quem sabe a própria senha
// erra duas ou três vezes; quem está varrendo uma lista de senhas precisa de
// milhares — e para nas dez primeiras.
const limiteLogin = limitePorIP({
  nome: 'login',
  janelaMs: 15 * 60 * 1000,
  max: 10,
  mensagem: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.',
});

router.post('/login', limiteLogin, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email_and_password_required' });
    }
    const { rows } = await query('SELECT * FROM auth_users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    if ((user.data?.status || 'ativo') === 'inativo') {
      return res.status(403).json({ error: 'user_inactive' });
    }
    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'auth_required' });

    // Marca presença: é daqui que sai o "usuários online" mandado ao painel de
    // licenciamento (licenca.js). Fica no /me e não no /login porque quem abriu
    // o sistema hoje cedo e segue trabalhando não passa mais pelo login.
    // Falha aqui não pode derrubar a resposta — presença é métrica, não regra.
    query(
      `UPDATE auth_users SET data = COALESCE(data, '{}'::jsonb) || jsonb_build_object('ultimo_acesso', $2::text) WHERE id = $1`,
      [req.user.id, new Date().toISOString()],
    ).catch(() => {});

    res.json(sanitizeUser(rows[0]));
  } catch (err) { next(err); }
});

// base44.auth.updateMe(data) — atualiza o próprio usuário. Campos conhecidos
// (full_name, role) vão para colunas; o resto é mesclado em data (JSONB).
// 'role' só pode ser alterado por admin.
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const body = { ...(req.body || {}) };
    const sets = ['updated_date = NOW()'];
    const params = [];
    let emailChanged = false;

    if (body.full_name !== undefined) {
      params.push(body.full_name);
      sets.push(`full_name = $${params.length}`);
      delete body.full_name;
    }
    // Troca do próprio e-mail (login): valida formato e unicidade. O token é
    // reemitido no fim para refletir o novo e-mail nas claims do JWT.
    if (body.email !== undefined) {
      const novo = String(body.email).toLowerCase().trim();
      const atual = String(req.user.email || '').toLowerCase().trim();
      if (novo && novo !== atual) {
        if (!EMAIL_RE.test(novo)) return res.status(400).json({ error: 'email_invalido' });
        const dup = await query('SELECT id FROM auth_users WHERE email = $1 AND id <> $2', [novo, req.user.id]);
        if (dup.rows.length) return res.status(409).json({ error: 'email_em_uso' });
        params.push(novo);
        sets.push(`email = $${params.length}`);
        emailChanged = true;
      }
      delete body.email;
    }
    if (body.role !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'forbidden_role_change' });
      }
      params.push(body.role);
      sets.push(`role = $${params.length}`);
      delete body.role;
    }
    for (const k of [...Object.keys(body)]) if (PROTECTED.has(k)) delete body[k];

    if (Object.keys(body).length) {
      params.push(JSON.stringify(body));
      sets.push(`data = COALESCE(data, '{}'::jsonb) || $${params.length}::jsonb`);
    }

    params.push(req.user.id);
    await query(`UPDATE auth_users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [req.user.id]);
    const out = sanitizeUser(rows[0]);
    // Token novo só quando o e-mail mudou (claims do JWT carregam o e-mail).
    if (emailChanged) out._token = signToken(rows[0]);
    res.json(out);
  } catch (err) { next(err); }
});

// Troca da própria senha: exige a senha atual e uma nova (mín. 6 caracteres).
router.put('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { senha_atual, nova_senha } = req.body || {};
    if (!nova_senha || String(nova_senha).length < 6) {
      return res.status(400).json({ error: 'senha_curta' });
    }
    const { rows } = await query('SELECT * FROM auth_users WHERE id = $1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'auth_required' });
    const ok = await bcrypt.compare(String(senha_atual || ''), user.password_hash);
    if (!ok) return res.status(403).json({ error: 'senha_atual_incorreta' });
    const hash = await bcrypt.hash(String(nova_senha), 10);
    await query('UPDATE auth_users SET password_hash = $1, updated_date = NOW() WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/logout', (_req, res) => res.json({ ok: true }));

// ─── Recuperação de senha com aprovação de ADMIN ───
// Fluxo: usuário informa e-mail + nova senha desejada → cria uma solicitação (a senha já
// entra HASHEADA, nunca em texto puro) → e-mail para TODOS os admins com links Aprovar/Rejeitar.
// Só na aprovação a senha é efetivada. O token no link é a capacidade de aprovar (só os admins
// recebem o e-mail). Uma vez processado (aprovado/rejeitado), o link deixa de funcionar.
// "Esqueci a senha" dispara e-mail para o admin: mesmo risco de spam do contato.
const limiteForgot = limitePorIP({
  nome: 'forgot',
  janelaMs: 60 * 60 * 1000,
  max: 5,
  mensagem: 'Muitas solicitações de recuperação. Aguarde antes de tentar de novo.',
});

router.post('/forgot', limiteForgot, async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const nova_senha = String(req.body?.nova_senha || '');
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'email_invalido' });
    if (nova_senha.length < 6) return res.status(400).json({ error: 'senha_curta' });

    const { rows } = await query('SELECT * FROM auth_users WHERE lower(email) = $1', [email]);
    const user = rows[0];
    // Resposta genérica (não revela se o e-mail existe no sistema).
    if (!user) return res.json({ ok: true });

    const nova_senha_hash = await bcrypt.hash(nova_senha, 10);
    const token = nanoid(40);
    await store.create('SolicitacaoTrocaSenha', {
      user_id: user.id, email: user.email,
      solicitante_nome: user.full_name || user.email,
      nova_senha_hash, status: 'pendente', token,
    });

    // Aprovadores = admin + TI (programador). Ambos são SUPER_ROLES no RBAC.
    const admins = (await query("SELECT email FROM auth_users WHERE role IN ('admin', 'programador')")).rows
      .map((r) => r.email).filter(Boolean);
    if (admins.length) {
      const aprovar = `${APP_URL}/api/auth/reset/approve?token=${token}`;
      const rejeitar = `${APP_URL}/api/auth/reset/reject?token=${token}`;
      const nome = user.full_name || 'Usuário';
      const brand = await getBranding();
      const brandNome = brand.nome || 'Construlog';
      const html = `
<div style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #ececee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <tr><td style="height:4px;background:#2563eb;line-height:4px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 34px 0;">
          <div style="font-size:12px;font-weight:700;letter-spacing:1px;color:#2563eb;text-transform:uppercase;">${brandNome}</div>
          <h1 style="margin:14px 0 8px;font-size:20px;color:#111827;font-weight:700;">Solicitação de troca de senha</h1>
          <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#4b5563;">Um usuário pediu para trocar a própria senha. Aprove apenas se você reconhece o pedido.</p>
        </td></tr>
        <tr><td style="padding:0 34px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #eef0f2;border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Usuário</div>
              <div style="font-size:15px;color:#111827;font-weight:600;">${nome}</div>
              <div style="font-size:13px;color:#6b7280;">${user.email}</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:26px 34px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:10px;">
              <a href="${aprovar}" style="display:inline-block;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;">Aprovar troca</a>
            </td>
            <td>
              <a href="${rejeitar}" style="display:inline-block;background:#ffffff;color:#dc2626;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:10px;border:1px solid #f2cfcf;">Rejeitar</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:18px 34px 30px;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">A nova senha só é aplicada após a aprovação. Este link é único e expira ao ser usado. Se você não reconhece este pedido, clique em Rejeitar.</p>
        </td></tr>
      </table>
      <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#b8bcc2;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Mensagem automática · ${brandNome}</p>
    </td></tr>
  </table>
</div>`;
      await sendEmail({ to: admins, subject: `Troca de senha solicitada — ${user.email}`, html });
    }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/reset/approve', async (req, res, next) => {
  try {
    const token = String(req.query?.token || '');
    const sol = (await store.filter('SolicitacaoTrocaSenha', { token }))[0];
    if (!sol || sol.status !== 'pendente') {
      return res.status(400).send(paginaHtml('Link inválido', 'Esta solicitação não existe ou já foi processada.', '#dc2626', '#fdecec', '!'));
    }
    await query('UPDATE auth_users SET password_hash = $1, updated_date = NOW() WHERE id = $2', [sol.nova_senha_hash, sol.user_id]);
    await store.update('SolicitacaoTrocaSenha', sol.id, { status: 'aprovada', decidido_em: new Date().toISOString(), decidido_por: 'link_email' });
    res.send(paginaHtml('Senha aprovada', `A nova senha de <b>${sol.email}</b> foi ativada. O usuário já pode entrar com ela.`, '#16a34a', '#e7f6ec', '✓'));
  } catch (err) { next(err); }
});

router.get('/reset/reject', async (req, res, next) => {
  try {
    const token = String(req.query?.token || '');
    const sol = (await store.filter('SolicitacaoTrocaSenha', { token }))[0];
    if (!sol || sol.status !== 'pendente') {
      return res.status(400).send(paginaHtml('Link inválido', 'Esta solicitação não existe ou já foi processada.', '#dc2626', '#fdecec', '!'));
    }
    await store.update('SolicitacaoTrocaSenha', sol.id, { status: 'rejeitada', decidido_em: new Date().toISOString(), decidido_por: 'link_email' });
    res.send(paginaHtml('Solicitação rejeitada', `O pedido de troca de senha de <b>${sol.email}</b> foi recusado. Nada foi alterado.`, '#dc2626', '#fdecec', '✕'));
  } catch (err) { next(err); }
});

export default router;
