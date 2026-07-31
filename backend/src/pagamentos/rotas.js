// ROTAS DE PAGAMENTO.
//
// Duas naturezas bem diferentes, por isso o roteador é montado em dois pontos:
//
//  1. WEBHOOK — quem chama é a Asaas, sem sessão. Autenticação por token no
//     header. Precisa ficar FORA do requireAuth, senão o aviso de pagamento
//     nunca chega.
//  2. PAINEL — quem chama é um operador logado (emitir, ver boleto, conciliar).
//
// Enquanto ASAAS_API_KEY não existir, tudo aqui responde "modo_manual" e o
// painel segue como está hoje. Nada quebra por estar montado e desligado.

import { Router } from 'express';
import { limitePorIP } from '../rateLimit.js';
import { requireAuth } from '../middleware.js';
import {
  modoPagamento, configAsaas, emitirCobranca, cancelarCobranca,
  meiosDePagamento, processarWebhook, conciliarPendentes,
} from './index.js';
import { enviarAvisoManual } from '../cobrancaAviso.js';

// --- Público (webhook) ----------------------------------------------------

export const webhookRouter = Router();

webhookRouter.post(
  '/asaas',
  limitePorIP({ nome: 'webhook-asaas', janelaMs: 60 * 1000, max: 300, mensagem: 'Muitos avisos.' }),
  async (req, res) => {
    const { webhookToken } = configAsaas();

    // Sem token configurado, ninguém entra: aceitar aviso não autenticado
    // deixaria qualquer um dar baixa em cobrança nossa.
    if (!webhookToken) {
      return res.status(503).json({ ok: false, motivo: 'webhook_nao_configurado' });
    }
    if (req.header('asaas-access-token') !== webhookToken) {
      return res.status(401).json({ ok: false, motivo: 'token_invalido' });
    }

    try {
      const r = await processarWebhook(req.body);
      // 200 mesmo quando não achamos a cobrança: erro nosso não deve fazer a
      // Asaas reenviar o mesmo aviso indefinidamente. O motivo fica no log.
      if (!r.ok) console.warn('[asaas] webhook sem efeito:', r.motivo, req.body?.event);
      return res.json(r);
    } catch (e) {
      // Aqui SIM devolvemos erro: falha nossa de gravação merece reenvio.
      console.error('[asaas] webhook falhou:', e?.message);
      return res.status(500).json({ ok: false, motivo: 'erro_interno' });
    }
  },
);

// --- Painel (autenticado) -------------------------------------------------

export const pagamentosRouter = Router();

// Emitir e cancelar cobrança mexe em dinheiro do cliente: exige sessão.
pagamentosRouter.use(requireAuth);

pagamentosRouter.get('/status', async (_req, res) => {
  // Garante o cache carregado antes de responder: é esta rota que a tela usa
  // para decidir se mostra os botões de boleto/Pix. Responder "manual" por
  // cache frio esconderia recursos que estão configurados.
  const { carregarAsaas } = await import('./asaas.js');
  await carregarAsaas().catch(() => {});
  const { ambiente } = configAsaas();
  res.json({ modo: modoPagamento(), ambiente });
});

pagamentosRouter.post('/cobrancas/:id/emitir', async (req, res, next) => {
  try {
    res.json(await emitirCobranca(req.params.id, { forma: req.body?.forma }));
  } catch (e) { next(e); }
});

pagamentosRouter.get('/cobrancas/:id/meios', async (req, res, next) => {
  try {
    res.json(await meiosDePagamento(req.params.id));
  } catch (e) { next(e); }
});

pagamentosRouter.post('/cobrancas/:id/cancelar', async (req, res, next) => {
  try {
    res.json(await cancelarCobranca(req.params.id));
  } catch (e) { next(e); }
});

// Aviso de vencimento por e-mail — disparo manual, do botão do painel.
pagamentosRouter.post('/cobrancas/:id/avisar', async (req, res, next) => {
  try {
    // `canais` opcional: ["email"], ["whatsapp"] ou ambos. Sem ele, vai por
    // todos os que o cliente aceitou.
    res.json(await enviarAvisoManual(req.params.id, { canais: req.body?.canais }));
  } catch (e) { next(e); }
});

pagamentosRouter.post('/conciliar', async (_req, res, next) => {
  try {
    res.json(await conciliarPendentes());
  } catch (e) { next(e); }
});
