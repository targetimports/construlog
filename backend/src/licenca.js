// LICENÇA — o lado do CLIENTE (roda dentro da instalação do ERP).
//
// A cada 30s manda um heartbeat ao painel do fornecedor com o estado da
// instalação e recebe de volta se pode continuar operando. Negado, o sistema se
// bloqueia: o middleware abaixo passa a recusar as rotas de API.
//
// Como ligar (.env da instalação):
//   BACKOFFICE_URL=https://painel.construlog.com.br
//   BACKOFFICE_API_KEY=clog_xxxxxxxx
//   BACKOFFICE_INSTANCIA_ID=...      (opcional — o painel descobre pela URL)
//   APP_PUBLIC_URL=https://cliente.com.br
//
// Sem BACKOFFICE_URL nada disso roda: instalação sem licenciamento configurado
// funciona normalmente (é o caso do desenvolvimento).
//
// DECISÕES DE SEGURANÇA IMPORTANTES:
//  - Falha de rede NÃO bloqueia. Se o painel estiver fora do ar, o cliente
//    continua trabalhando; só um "não autorizado" explícito bloqueia.
//  - O bloqueio libera /auth e /health, senão ninguém consegue nem entrar para
//    ver a mensagem, e o próprio heartbeat de recuperação ficaria inacessível.

import { query } from './db.js';

const URL_PAINEL = (process.env.BACKOFFICE_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.BACKOFFICE_API_KEY || '';
const INSTANCIA_ID = process.env.BACKOFFICE_INSTANCIA_ID || '';
const MINHA_URL = (process.env.APP_PUBLIC_URL || '').replace(/\/+$/, '');
const INTERVALO_PADRAO_MS = 30_000;
const TIMEOUT_MS = 10_000;

// Estado em memória. Começa liberado: nada de derrubar o sistema no boot só
// porque ainda não deu tempo de falar com o painel.
const estado = {
  ativo: !!URL_PAINEL && !!API_KEY,
  autorizado: true,
  motivo: 'ok',
  mensagem: null,
  aviso: null,
  dias_atraso: null,
  ultimo_contato: null,
  ultima_falha: null,
};

export const statusLicenca = () => ({ ...estado });

/** Métricas da instalação — o que o painel mostra sobre este cliente. */
async function coletarMetricas() {
  const num = async (sql) => {
    try {
      const { rows } = await query(sql);
      return Number(rows[0]?.n) || 0;
    } catch {
      return 0;
    }
  };

  const [usuarios_total, obras_total, obras_ativas, usuarios_online] = await Promise.all([
    num(`SELECT count(*) AS n FROM auth_users`),
    num(`SELECT count(*) AS n FROM entity_obra`),
    num(`SELECT count(*) AS n FROM entity_obra WHERE data->>'status' IN ('em_andamento','ativa')`),
    // "Online" = sessão vista nos últimos 15 min. auth_users não tem coluna de
    // último acesso; o dado vem do JSONB, gravado no login. Se ainda não existir,
    // o count dá 0 — o painel mostra "0 online" em vez de quebrar o heartbeat.
    num(`SELECT count(*) AS n FROM auth_users
          WHERE (data->>'ultimo_acesso') IS NOT NULL
            AND (data->>'ultimo_acesso')::timestamptz > NOW() - INTERVAL '15 minutes'`),
  ]);

  return { usuarios_total, obras_total, obras_ativas, usuarios_online };
}

async function baterHeartbeat() {
  if (!estado.ativo) return;

  try {
    const metricas = await coletarMetricas();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

    const r = await fetch(`${URL_PAINEL}/api/integracao/heartbeat`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({
        instancia_id: INSTANCIA_ID || undefined,
        url: MINHA_URL || undefined,
        versao: process.env.APP_VERSAO || null,
        ambiente: process.env.NODE_ENV === 'production' ? 'producao' : 'homologacao',
        ...metricas,
      }),
    });
    clearTimeout(timer);

    const d = await r.json().catch(() => ({}));

    // Só uma negativa explícita bloqueia.
    if (typeof d.autorizado === 'boolean') {
      const mudou = estado.autorizado !== d.autorizado;
      estado.autorizado = d.autorizado;
      estado.motivo = d.motivo || null;
      estado.mensagem = d.mensagem || null;
      estado.aviso = d.aviso || null;
      estado.dias_atraso = d.dias_atraso ?? null;
      if (mudou) {
        console.warn(`[licenca] acesso ${d.autorizado ? 'LIBERADO' : 'BLOQUEADO'} — ${d.motivo || 'sem motivo'}`);
      }
    }

    estado.ultimo_contato = new Date().toISOString();
    estado.ultima_falha = null;
  } catch (e) {
    // Painel inacessível: mantém como está. Não bloqueia por problema de rede.
    estado.ultima_falha = e?.message || 'falha de conexão';
  }
}

/** Middleware: recusa a API quando o acesso está bloqueado. */
export function exigirLicenca(req, res, next) {
  if (!estado.ativo || estado.autorizado) return next();

  // Login, saúde e o próprio status continuam abertos — senão o usuário nem
  // consegue entrar para ver por que está bloqueado.
  const livre = req.path.startsWith('/auth')
    || req.path.startsWith('/health')
    || req.path.startsWith('/public')
    || req.path.startsWith('/licenca');
  if (livre) return next();

  return res.status(423).json({
    error: 'sistema_bloqueado',
    motivo: estado.motivo,
    message: estado.mensagem || 'Acesso temporariamente suspenso. Fale com o suporte.',
  });
}

export function iniciarLicenca() {
  if (!estado.ativo) {
    console.log('[licenca] não configurada (BACKOFFICE_URL/API_KEY ausentes) — sistema livre');
    return;
  }
  console.log(`[licenca] heartbeat para ${URL_PAINEL} a cada ${INTERVALO_PADRAO_MS / 1000}s`);
  baterHeartbeat();
  setInterval(baterHeartbeat, INTERVALO_PADRAO_MS).unref?.();
}
