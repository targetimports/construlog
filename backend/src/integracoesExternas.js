// INTEGRAÇÕES EXTERNAS — os serviços de fora que o painel usa.
//
// Cada provedor (Asaas, WhatsApp, e-mail) tem uma linha em IntegracaoExterna,
// com o id igual à chave do provedor. Assim a configuração deixa de morar só no
// .env e passa a ser editável pela tela, sem acesso ao servidor.
//
// PRECEDÊNCIA: o .env SEMPRE vence o banco.
//   Quem tem acesso ao servidor manda mais do que quem tem acesso ao painel; e
//   uma instalação que já rodava configurada por .env não pode mudar de
//   comportamento só porque alguém salvou algo na tela. Quando o .env define o
//   provedor, a tela mostra "definido no servidor" e não deixa editar.
//
// SEGREDOS: campos marcados como `segredo` nunca voltam por inteiro para o
// front — só os 4 últimos caracteres. Salvar em branco significa "mantém o que
// já está", senão abrir a tela e salvar apagaria a chave sem querer.

import { Router } from 'express';
import { store } from './entityStore.js';
import { requireAuth } from './middleware.js';

const router = Router();

// Catálogo dos provedores. Acrescentar um provedor novo é acrescentar um item
// aqui — a tela se monta a partir disto.
export const PROVEDORES = [
  {
    chave: 'asaas',
    nome: 'Asaas',
    categoria: 'Pagamentos',
    descricao: 'Emite boleto e Pix das mensalidades e dá baixa automática quando o cliente paga.',
    docs: 'https://docs.asaas.com',
    campos: [
      { nome: 'api_key', rotulo: 'Chave de API', segredo: true, env: 'ASAAS_API_KEY', obrigatorio: true, dica: 'Começa com $aact_' },
      { nome: 'ambiente', rotulo: 'Ambiente', tipo: 'select', env: 'ASAAS_AMBIENTE', padrao: 'sandbox',
        opcoes: [{ valor: 'sandbox', rotulo: 'Sandbox (testes)' }, { valor: 'producao', rotulo: 'Produção' }] },
      { nome: 'webhook_token', rotulo: 'Token do webhook', segredo: true, env: 'ASAAS_WEBHOOK_TOKEN',
        dica: 'Você inventa este valor e repete no painel da Asaas' },
    ],
  },
  {
    chave: 'whatsapp',
    nome: 'WhatsApp',
    categoria: 'Mensageria',
    descricao: 'Envia a cobrança também por WhatsApp, além do e-mail.',
    campos: [
      { nome: 'url', rotulo: 'URL da API', env: 'WHATSAPP_API_URL', obrigatorio: true, dica: 'Ex: https://evolution.seuservidor.com' },
      { nome: 'instancia', rotulo: 'Instância', env: 'WHATSAPP_INSTANCIA', obrigatorio: true },
      { nome: 'token', rotulo: 'Token / API key', segredo: true, env: 'WHATSAPP_TOKEN', obrigatorio: true },
    ],
  },
  {
    chave: 'email',
    nome: 'E-mail (SMTP)',
    categoria: 'Mensageria',
    descricao: 'Remetente dos avisos de vencimento e das cobranças por atraso.',
    campos: [
      { nome: 'host', rotulo: 'Servidor SMTP', env: 'SMTP_HOST', obrigatorio: true, dica: 'Ex: smtp.hostinger.com' },
      { nome: 'porta', rotulo: 'Porta', env: 'SMTP_PORT', padrao: '465', dica: '465 (SSL) ou 587 (STARTTLS)' },
      { nome: 'usuario', rotulo: 'Usuário', env: 'SMTP_USER', obrigatorio: true },
      { nome: 'senha', rotulo: 'Senha', segredo: true, env: 'SMTP_PASS', obrigatorio: true },
      { nome: 'remetente', rotulo: 'Remetente exibido', env: 'EMAIL_REMETENTE', dica: 'Ex: Construlog <financeiro@construlog.com.br>' },
    ],
  },
];

const provedorDe = (chave) => PROVEDORES.find((p) => p.chave === chave);

const doEnv = (campo) => {
  const v = campo.env ? process.env[campo.env] : '';
  return v && String(v).trim() ? String(v).trim() : '';
};

/** O .env define este provedor? Basta um campo obrigatório vindo de lá. */
const vemDoEnv = (prov) => prov.campos.some((c) => c.obrigatorio && doEnv(c));

const mascarar = (valor) => {
  const s = String(valor || '');
  if (!s) return '';
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`;
};

/**
 * Configuração efetiva de um provedor: .env primeiro, banco depois.
 * É o que o resto do backend deve consumir — nunca ler process.env direto.
 */
export async function configDe(chave) {
  const prov = provedorDe(chave);
  if (!prov) return null;

  const salvo = (await store.filter('IntegracaoExterna', { id: chave }, null, 1).catch(() => []))[0] || {};
  const origemEnv = vemDoEnv(prov);

  const valores = {};
  for (const campo of prov.campos) {
    const env = doEnv(campo);
    valores[campo.nome] = origemEnv
      ? (env || campo.padrao || '')
      : (salvo[campo.nome] ?? campo.padrao ?? '');
  }

  const completo = prov.campos.filter((c) => c.obrigatorio).every((c) => !!valores[c.nome]);
  return {
    chave,
    origem: origemEnv ? 'env' : (completo ? 'banco' : 'nenhum'),
    ativo: origemEnv ? true : (salvo.ativo !== false),
    configurado: completo,
    valores,
  };
}

/** Igual a configDe, mas devolve só se está pronto para uso (config + ligado). */
export async function integracaoPronta(chave) {
  const c = await configDe(chave);
  return !!(c?.configurado && c.ativo);
}

router.use(requireAuth);

// Lista os provedores com o estado de cada um (segredos mascarados).
router.get('/', async (_req, res, next) => {
  try {
    const saida = [];
    for (const prov of PROVEDORES) {
      const cfg = await configDe(prov.chave);
      const salvo = (await store.filter('IntegracaoExterna', { id: prov.chave }, null, 1).catch(() => []))[0] || {};
      saida.push({
        chave: prov.chave,
        nome: prov.nome,
        categoria: prov.categoria,
        descricao: prov.descricao,
        docs: prov.docs || null,
        origem: cfg.origem,
        configurado: cfg.configurado,
        ativo: cfg.ativo,
        ultimo_teste: salvo.ultimo_teste || null,
        ultimo_teste_ok: salvo.ultimo_teste_ok ?? null,
        ultimo_teste_erro: salvo.ultimo_teste_erro || null,
        campos: prov.campos.map((c) => ({
          nome: c.nome,
          rotulo: c.rotulo,
          tipo: c.tipo || 'texto',
          segredo: !!c.segredo,
          obrigatorio: !!c.obrigatorio,
          dica: c.dica || null,
          opcoes: c.opcoes || null,
          // Segredo nunca sai por inteiro; o resto volta para preencher o form.
          valor: c.segredo ? mascarar(cfg.valores[c.nome]) : (cfg.valores[c.nome] || ''),
          preenchido: !!cfg.valores[c.nome],
        })),
      });
    }
    res.json(saida);
  } catch (err) { next(err); }
});

router.put('/:chave', async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'somente_admin' });

    const prov = provedorDe(req.params.chave);
    if (!prov) return res.status(404).json({ error: 'provedor_desconhecido' });
    if (vemDoEnv(prov)) return res.status(409).json({ error: 'definido_no_servidor' });

    const atual = (await store.filter('IntegracaoExterna', { id: prov.chave }, null, 1).catch(() => []))[0] || null;
    const body = req.body || {};

    const dados = { ativo: body.ativo !== false };
    for (const campo of prov.campos) {
      const novo = body[campo.nome];
      if (campo.segredo && (novo === undefined || novo === '')) {
        // Vazio em campo de segredo = "não mexi nele". Sobrescrever com vazio
        // apagaria a chave de quem só queria trocar o ambiente.
        if (atual?.[campo.nome] !== undefined) dados[campo.nome] = atual[campo.nome];
        continue;
      }
      dados[campo.nome] = novo === undefined ? (atual?.[campo.nome] ?? '') : String(novo).trim();
    }

    if (atual) await store.update('IntegracaoExterna', prov.chave, dados);
    else await store.create('IntegracaoExterna', { id: prov.chave, ...dados });

    // Derruba o cache de quem guarda config em memória, para a mudança valer
    // agora e não só no próximo restart do servidor.
    if (prov.chave === 'asaas') {
      // RECARREGA de fato, não só invalida. `recarregarAsaas()` sozinho zera o
      // cache, mas a leitura síncrona (asaasAtiva) cai no .env enquanto ninguém
      // recarrega — então logo após salvar a chave o painel ainda se dizia em
      // "modo manual" e os botões de emitir não apareciam.
      const { carregarAsaas } = await import('./pagamentos/asaas.js');
      await carregarAsaas();
    }
    if (prov.chave === 'email') {
      const { carregarEmail } = await import('./email.js');
      await carregarEmail(); // recarrega já, para emailConfigured() dizer a verdade
    }
    if (prov.chave === 'whatsapp') {
      const { carregarWhatsapp } = await import('./whatsapp.js');
      await carregarWhatsapp();
    }

    const cfg = await configDe(prov.chave);
    res.json({ ok: true, configurado: cfg.configurado, origem: cfg.origem });
  } catch (err) { next(err); }
});

// Testa a conexão de verdade — configuração salva não é o mesmo que funcionando.
router.post('/:chave/testar', async (req, res, next) => {
  try {
    const prov = provedorDe(req.params.chave);
    if (!prov) return res.status(404).json({ error: 'provedor_desconhecido' });

    const cfg = await configDe(prov.chave);
    if (!cfg.configurado) return res.json({ ok: false, erro: 'Faltam campos obrigatórios.' });

    const inicio = Date.now();
    let resultado;
    try {
      resultado = await testar(prov.chave, cfg.valores);
    } catch (e) {
      resultado = { ok: false, erro: e?.message || 'falha na conexão' };
    }
    const tempo = Date.now() - inicio;

    // Guarda o resultado para a tela mostrar quando foi o último teste.
    const patch = {
      ultimo_teste: new Date().toISOString(),
      ultimo_teste_ok: !!resultado.ok,
      ultimo_teste_erro: resultado.ok ? null : (resultado.erro || 'falhou'),
    };
    const existe = (await store.filter('IntegracaoExterna', { id: prov.chave }, null, 1).catch(() => []))[0];
    if (existe) await store.update('IntegracaoExterna', prov.chave, patch);
    else await store.create('IntegracaoExterna', { id: prov.chave, ...patch });

    res.json({ ...resultado, tempo_ms: tempo });
  } catch (err) { next(err); }
});

/** Teste específico de cada provedor. */
async function testar(chave, v) {
  if (chave === 'asaas') {
    const base = v.ambiente === 'producao' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
    const r = await fetch(`${base}/customers?limit=1`, { headers: { access_token: v.api_key } });
    if (r.status === 401) return { ok: false, erro: 'Chave de API recusada pela Asaas.' };
    if (!r.ok) return { ok: false, erro: `Asaas respondeu ${r.status}.` };
    const d = await r.json().catch(() => ({}));
    return { ok: true, detalhe: `Conectado (${d.totalCount ?? 0} cliente(s) na conta).` };
  }

  if (chave === 'whatsapp') {
    const base = String(v.url || '').replace(/\/+$/, '');
    const r = await fetch(`${base}/instance/connectionState/${encodeURIComponent(v.instancia)}`, {
      headers: { apikey: v.token },
    });
    if (r.status === 401 || r.status === 403) return { ok: false, erro: 'Token recusado pela API.' };
    if (!r.ok) return { ok: false, erro: `A API respondeu ${r.status}.` };
    const d = await r.json().catch(() => ({}));
    const estado = d?.instance?.state || d?.state || 'desconhecido';
    return estado === 'open'
      ? { ok: true, detalhe: 'Instância conectada.' }
      : { ok: false, erro: `Instância não conectada (estado: ${estado}).` };
  }

  if (chave === 'email') {
    const nodemailer = (await import('nodemailer')).default;
    const porta = Number(v.porta) || 465;
    const t = nodemailer.createTransport({
      host: v.host, port: porta, secure: porta === 465,
      auth: { user: v.usuario, pass: v.senha },
    });
    await t.verify();
    return { ok: true, detalhe: 'Servidor SMTP aceitou a autenticação.' };
  }

  return { ok: false, erro: 'Provedor sem teste implementado.' };
}

export default router;
