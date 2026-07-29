import express from 'express';
import cors from 'cors';
import authRouter from './auth.js';
import entitiesRouter from './entities.js';
import integrationsRouter, { filesRouter } from './integrations.js';
import functionsRouter from './functions.js';
import publicRouter from './public.js';
import integracaoRouter from './integracao.js';
import { iniciarLicenca, exigirLicenca, statusLicenca } from './licenca.js';
import { webhookRouter, pagamentosRouter } from './pagamentos/rotas.js';
import instalacaoRouter from './instalacao.js';
import { errorHandler } from './middleware.js';
import { limitePorIP } from './rateLimit.js';
import { logEvent } from './logger.js';
import { migrate } from './migrate.js';
import { seedAdmin, seedEmpresas, seedEstoque, seedFinanceiro, seedFrota, seedManutencaoAtivo, seedBackfillEscopoObra, seedBackfillUsuariosEmpresa } from './seed.js';
import { startScheduler } from './scheduler.js';
import { pool, query } from './db.js';

const app = express();
// Estamos atrás do nginx: sem isso req.ip é sempre 127.0.0.1 e os limites por IP
// contariam todos os usuários no mesmo balde. 1 = confia em um salto de proxy.
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Log de auditoria em arquivo: registra toda MUTAÇÃO (POST/PUT/PATCH/DELETE) e todo ERRO
// (status >= 400). Leituras que deram certo (GET 200) não entram, pra não inundar o arquivo.
const SKIP_LOG = new Set(['/health', '/auth/me']);
// Funções de leitura/polling específicas (além das que começam com get/listar/... abaixo).
const RUIDO_FUNCS = new Set(['getMenuForBootstrap', 'getEffectivePermissionsV2', 'getPermissoesCatalogo', 'listarPendencias']);
// "Ruído": leituras via POST, notificações e polling — não interessam no log de auditoria.
// (Só são ignoradas quando dão CERTO; se derem erro, ainda são registradas.)
const isRuido = (p) => {
  if (/^\/entities\/[^/]+\/filter$/.test(p)) return true;      // leitura de entidade (POST /:name/filter)
  if (/^\/entities\/[^/]*notif/i.test(p)) return true;          // qualquer entidade de notificação
  if (p.startsWith('/functions/')) {
    const name = p.slice('/functions/'.length);
    if (/^(get|listar|buscar|preview|exportar|calc|simular|diagnosticar)/i.test(name)) return true;
    if (RUIDO_FUNCS.has(name)) return true;
  }
  return false;
};
app.use((req, res, next) => {
  const start = Date.now();
  // originalUrl é estável; req.path/req.url são reescritos pelos sub-routers (tiram o /functions).
  const p = (req.originalUrl || req.url || '').split('?')[0];
  res.on('finish', () => {
    // GET nunca entra no log: são leituras e sondagens de bots (404 em /.env, /phpinfo, etc.).
    if (req.method === 'GET') return;
    const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isError = res.statusCode >= 400;
    if ((!mutating && !isError) || SKIP_LOG.has(p)) return;
    if (!isError && isRuido(p)) return; // ruído só é ignorado quando bem-sucedido
    logEvent({
      level: isError ? 'error' : 'info',
      method: req.method,
      path: p,
      status: res.statusCode,
      // Ator: o usuário autenticado (token) ou, quando não há sessão (login/forgot/contato),
      // o e-mail informado no corpo da requisição.
      user: req.user?.email || req.body?.email || null,
      ms: Date.now() - start,
      ...(res.locals?.errMsg ? { error: res.locals.errMsg } : {}),
    });
  });
  next();
});

// Liveness + readiness: processo vivo E banco respondendo.
app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'db_unreachable' });
  }
});

// Teto geral por IP. Folgado de propósito: um escritório inteiro sai pelo mesmo
// IP e o SPA dispara dezenas de chamadas por tela. Não serve para "moderar" uso —
// serve só para cortar ferramenta de flood antes de ela ocupar o banco.
app.use(limitePorIP({
  nome: 'geral',
  janelaMs: 60 * 1000,
  max: 1200,
  mensagem: 'Muitas requisições em pouco tempo. Aguarde um minuto.',
}));

app.use('/public', publicRouter); // rotas públicas (sem auth) — ex.: contato da landing
app.use('/integracao', integracaoRouter); // heartbeat das instalações (auth por chave de API)
app.use('/webhooks', webhookRouter); // avisos do gateway de pagamento (auth por token no header)
// Configuração inicial: /status é público (o front decide o que mostrar antes do
// login); /configurar exige admin. Fica acima da licença — uma instalação que
// nem foi configurada ainda não pode ser barrada por ela.
app.use('/instalacao', instalacaoRouter);
app.use('/auth', authRouter);

// Estado da licença desta instalação — o front consulta para exibir o bloqueio.
app.get('/licenca', (_req, res) => res.json(statusLicenca()));

// Daqui para baixo tudo passa pela licença. /public, /integracao e /auth ficam
// acima de propósito: bloqueado, o usuário ainda entra e vê o porquê.
app.use(exigirLicenca);

app.use('/entities', entitiesRouter);
app.use('/pagamentos', pagamentosRouter);
app.use('/integrations', integrationsRouter);
app.use('/functions', functionsRouter);
app.use('/files', filesRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await migrate();
    await seedAdmin();
    await seedEmpresas();
    await seedEstoque();
    await seedFinanceiro();
    await seedFrota();
    await seedManutencaoAtivo();
    await seedBackfillEscopoObra();
    await seedBackfillUsuariosEmpresa();
    app.listen(PORT, () => console.log(`[server] construlog API on :${PORT}`));
    startScheduler();
    iniciarLicenca();
  } catch (err) {
    console.error('[server] startup failed:', err);
    await pool.end();
    process.exit(1);
  }
})();
