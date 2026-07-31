// INTERESSADOS — quem pediu contato pela landing e ainda não é cliente.
//
// Fecha o começo do ciclo comercial dentro do sistema: o visitante manda a
// mensagem, ela cai aqui, você responde por e-mail sem sair do painel e, quando
// fecha negócio, o interessado vira ClienteSaaS com um clique — sem redigitar
// nome, e-mail e telefone.
//
// A conversa fica registrada em `mensagens[]` no próprio interessado: quem
// respondeu o quê e quando. Numa negociação que se arrasta por semanas, isso é
// a diferença entre saber onde parou e ficar perguntando "já respondemos?".

import { Router } from 'express';
import { store } from './entityStore.js';
import { requireAuth } from './middleware.js';
import { sendEmail, emailConfigured, getBranding } from './email.js';

const router = Router();
router.use(requireAuth);

const escapar = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

/**
 * Responde o interessado por e-mail e registra no histórico.
 *
 * O e-mail sai do remetente configurado em Integrações externas, com reply_to
 * apontando para ele mesmo — assim a resposta do interessado volta para a sua
 * caixa, e a conversa continua onde ele já está acostumado.
 */
router.post('/:id/responder', async (req, res, next) => {
  try {
    if (!emailConfigured()) {
      return res.status(409).json({ ok: false, motivo: 'email_nao_configurado' });
    }

    const [inter] = await store.filter('Interessado', { id: req.params.id }, null, 1);
    if (!inter) return res.status(404).json({ ok: false, motivo: 'interessado_nao_encontrado' });
    if (!inter.email) return res.status(400).json({ ok: false, motivo: 'sem_email' });

    const assunto = String(req.body?.assunto || '').trim();
    const corpo = String(req.body?.corpo || '').trim();
    if (!corpo) return res.status(400).json({ ok: false, motivo: 'corpo_vazio' });

    const marca = await getBranding();
    const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#16181c">
  <div style="font-size:15px;line-height:1.65;white-space:pre-wrap">${escapar(corpo)}</div>
  <p style="margin-top:24px;font-size:13px;color:#6a6e77">— Equipe ${escapar(marca.nome)}</p>
</div>`.trim();

    const r = await sendEmail({
      to: inter.email,
      subject: assunto || `${marca.nome} — sobre o seu contato`,
      html,
      reply_to: undefined, // a resposta dele volta para o próprio remetente
    });
    if (!r?.ok) return res.status(502).json({ ok: false, motivo: r?.error || 'falha_no_envio' });

    const agora = new Date().toISOString();
    const mensagens = Array.isArray(inter.mensagens) ? inter.mensagens : [];
    mensagens.push({
      direcao: 'enviada',
      assunto: assunto || null,
      corpo,
      autor: req.user?.full_name || req.user?.email || 'painel',
      em: agora,
      stubbed: !!r.stubbed,
    });

    await store.update('Interessado', inter.id, {
      mensagens,
      // "novo" deixa de ser verdade no instante em que alguém respondeu.
      status: inter.status === 'novo' ? 'em_contato' : inter.status,
      respondido_em: agora,
    });

    res.json({ ok: true, email: inter.email, stubbed: !!r.stubbed });
  } catch (err) { next(err); }
});

/**
 * Interessado fechou: vira ClienteSaaS.
 *
 * Não apaga o interessado — marca como ganho e guarda o cliente_id. O histórico
 * da negociação continua acessível, e é ele que explica por que o desconto é
 * aquele quando alguém perguntar seis meses depois.
 */
router.post('/:id/converter', async (req, res, next) => {
  try {
    const [inter] = await store.filter('Interessado', { id: req.params.id }, null, 1);
    if (!inter) return res.status(404).json({ ok: false, motivo: 'interessado_nao_encontrado' });
    if (inter.cliente_id) {
      return res.status(409).json({ ok: false, motivo: 'ja_convertido', cliente_id: inter.cliente_id });
    }

    const b = req.body || {};
    const nome = String(b.nome || inter.empresa || inter.nome || '').trim();
    if (!nome) return res.status(400).json({ ok: false, motivo: 'nome_obrigatorio' });

    // Cliente com o mesmo CNPJ seria cobrança em dobro — barra antes de criar.
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');
    const cnpj = soDigitos(b.cnpj);
    if (cnpj) {
      const todos = await store.filter('ClienteSaaS', {}, null, 500).catch(() => []);
      if (todos.some((c) => soDigitos(c.cnpj) === cnpj)) {
        return res.status(409).json({ ok: false, motivo: 'cnpj_duplicado' });
      }
    }

    const cliente = await store.create('ClienteSaaS', {
      nome,
      cnpj: String(b.cnpj || '').trim(),
      responsavel: String(b.responsavel || inter.nome || '').trim(),
      email: String(b.email || inter.email || '').trim(),
      telefone: String(b.telefone || inter.telefone || '').trim(),
      plano: String(b.plano || inter.plano_interesse || '').trim(),
      valor_mensal: Number(b.valor_mensal) || 0,
      dia_vencimento: Number(b.dia_vencimento) || 10,
      status: b.status || 'teste',
      inicio: b.inicio || new Date().toISOString().slice(0, 10),
      observacoes: [inter.mensagem ? `Veio pelo site: "${inter.mensagem}"` : '', b.observacoes || '']
        .filter(Boolean).join('\n'),
      // Rastro para o outro lado: do cliente dá para voltar à negociação.
      interessado_id: inter.id,
    });

    await store.update('Interessado', inter.id, {
      status: 'ganho',
      cliente_id: cliente.id,
      convertido_em: new Date().toISOString(),
    });

    res.json({ ok: true, cliente_id: cliente.id, cliente_nome: cliente.nome });
  } catch (err) { next(err); }
});

export default router;
