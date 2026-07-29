import express from 'express';
import { sendEmail } from './email.js';
import { store } from './entityStore.js';
import { limitePorIP } from './rateLimit.js';

const router = express.Router();

// Estatísticas públicas para a landing (sem auth). Apenas contagens, sem dados
// sensíveis. Ex.: número real de clientes cadastrados.
router.get('/stats', async (_req, res) => {
  try {
    const [clientes, obras] = await Promise.all([
      store.filter('Cliente', {}, null, 100000).catch(() => []),
      store.filter('Obra', {}, null, 100000).catch(() => []),
    ]);
    const valorObras = (obras || []).reduce((s, o) => s + (Number(o.total_orcamento) || 0), 0);
    res.json({
      clientes: (clientes || []).length,
      obras: (obras || []).length,
      valorObras,
    });
  } catch {
    res.json({ clientes: 0, obras: 0, valorObras: 0 });
  }
});

// Imagens do carrossel da landing (definidas em /ConfiguracoesEmpresa).
router.get('/carrossel', async (_req, res) => {
  try {
    // Branding vem da MATRIZ (empresa tipo=matriz); fallback p/ a primeira empresa.
    const [emp] = (await store.filter('Empresa', { tipo: 'matriz' }, null, 1))
      .concat(await store.filter('Empresa', {}, null, 1)).filter(Boolean);
    const slides = Array.isArray(emp?.carrossel)
      ? emp.carrossel.filter((s) => s && s.url).slice(0, 5)
      : [];
    res.json({ slides });
  } catch {
    res.json({ slides: [] });
  }
});

// Branding público (nome da empresa/grupo, logo, favicon) para a landing (sem auth).
router.get('/branding', async (_req, res) => {
  try {
    const [emp] = (await store.filter('Empresa', { tipo: 'matriz' }, null, 1))
      .concat(await store.filter('Empresa', {}, null, 1)).filter(Boolean);
    res.json({
      nome_empresa: emp?.nome || emp?.nome_fantasia || null,
      nome_sistema: emp?.nome_sistema || null,
      logo_url: emp?.logo_url || null,
      favicon_url: emp?.favicon_url || null,
      // Contatos da landing (botão "Fale conosco"). whatsapp = só dígitos c/ DDI.
      whatsapp: (emp?.whatsapp || '').replace(/\D/g, '') || null,
      email_contato: emp?.email || null,
      // Telefone e endereço aparecem no rodapé público — são os dados de
      // contato que a empresa já divulga, vindos do mesmo cadastro.
      telefone: emp?.telefone || null,
      endereco: emp?.endereco || null,
    });
  } catch {
    res.json({
      nome_empresa: null, nome_sistema: null, logo_url: null, favicon_url: null,
      whatsapp: null, email_contato: null, telefone: null, endereco: null,
    });
  }
});

const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Endpoint PÚBLICO (sem auth) — formulário de contato da landing page.
// O e-mail de destino e o SMTP/Resend são definidos por env (EMAIL_CONTATO /
// RESEND_API_KEY / EMAIL_REMETENTE). Sem RESEND_API_KEY, o sendEmail apenas loga
// (stub), então o fluxo funciona end-to-end mesmo antes de configurar o e-mail.
// 3 mensagens por hora por IP. É o endpoint mais exposto do sistema: sem trava,
// um script simples enche a caixa da Construlog e queima a reputação do remetente.
const limiteContato = limitePorIP({
  nome: 'contato',
  janelaMs: 60 * 60 * 1000,
  max: 3,
  mensagem: 'Você já enviou algumas mensagens. Aguarde um pouco antes de enviar outra.',
});

router.post('/contato', limiteContato, async (req, res) => {
  try {
    const nome = String(req.body?.nome || '').trim();
    const email = String(req.body?.email || '').trim();
    const mensagem = String(req.body?.mensagem || '').trim();

    if (!nome || !email || !mensagem) {
      return res.status(400).json({ ok: false, error: 'campos_obrigatorios' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'email_invalido' });
    }
    if (nome.length > 120 || email.length > 160 || mensagem.length > 4000) {
      return res.status(400).json({ ok: false, error: 'tamanho_excedido' });
    }

    const destino = process.env.EMAIL_CONTATO || process.env.EMAIL_REMETENTE || 'contato@construlog.com.br';
    const html = `<h2>Novo contato pelo site</h2>
      <p><strong>Nome:</strong> ${escapeHtml(nome)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
      <p><strong>Mensagem:</strong></p>
      <p>${escapeHtml(mensagem).replace(/\n/g, '<br>')}</p>`;

    // reply_to = e-mail do visitante, para responder direto.
    // Sem RESEND_API_KEY o sendEmail retorna { ok:true, stubbed:true } (só loga).
    const r = await sendEmail({ to: destino, subject: `Contato do site — ${nome}`, html, reply_to: email });
    if (r && r.ok === false) {
      return res.status(502).json({ ok: false, error: 'falha_envio' });
    }
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: 'falha_envio' });
  }
});

export default router;
