// ENVIO POR WHATSAPP.
//
// Fala com uma API de WhatsApp (Evolution API) configurada em
// Sistema › Integrações externas. Mesmo padrão do e-mail: config sob demanda,
// cache em memória, recarregada quando a tela salva.
//
// Não existe "WhatsApp oficial" aqui: é uma instância conectada por QR Code.
// Se o telefone desconectar, o envio falha — por isso o teste de conexão da
// tela verifica o estado da instância, e não só a credencial.

let cache = null;

export async function carregarWhatsapp() {
  let v = {};
  try {
    const { configDe } = await import('./integracoesExternas.js');
    v = (await configDe('whatsapp'))?.valores || {};
  } catch {
    v = {};
  }
  cache = {
    url: String(v.url || process.env.WHATSAPP_API_URL || '').replace(/\/+$/, ''),
    instancia: v.instancia || process.env.WHATSAPP_INSTANCIA || '',
    token: v.token || process.env.WHATSAPP_TOKEN || '',
  };
  return cache;
}

export function recarregarWhatsapp() { cache = null; }

const config = () => cache || {
  url: String(process.env.WHATSAPP_API_URL || '').replace(/\/+$/, ''),
  instancia: process.env.WHATSAPP_INSTANCIA || '',
  token: process.env.WHATSAPP_TOKEN || '',
};

export function whatsappConfigured() {
  const c = config();
  return !!(c.url && c.instancia && c.token);
}

/**
 * Normaliza o telefone para o formato que a API espera (DDI+DDD+número).
 *
 * Brasil: 10 dígitos (fixo) ou 11 (celular com o 9). Sem DDI, assume 55 — quase
 * todo cadastro é digitado sem ele. Devolve null quando não dá para confiar no
 * que veio, em vez de "consertar" um número e mandar cobrança para estranho.
 */
export function normalizarTelefone(bruto) {
  const d = String(bruto || '').replace(/\D/g, '');
  if (!d) return null;

  if (d.length === 10 || d.length === 11) return `55${d}`;
  // Já com DDI brasileiro.
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  // Outros países: aceita como veio se tiver tamanho plausível.
  if (d.length >= 11 && d.length <= 15) return d;
  return null;
}

/**
 * Manda uma mensagem de texto.
 * Retorna { ok, id? , erro? } — nunca levanta, para um canal não derrubar o outro.
 */
export async function enviarWhatsapp({ telefone, texto }) {
  if (!cache) await carregarWhatsapp();
  const c = config();
  if (!whatsappConfigured()) return { ok: false, erro: 'whatsapp_nao_configurado' };

  const numero = normalizarTelefone(telefone);
  if (!numero) return { ok: false, erro: 'telefone_invalido' };

  const url = `${c.url}/message/sendText/${encodeURIComponent(c.instancia)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);

  try {
    // Evolution API v2 usa { number, text }. A v1 espera o texto dentro de
    // textMessage — mandamos os dois campos para funcionar nas duas versões
    // sem obrigar o usuário a saber qual está rodando.
    const r = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', apikey: c.token },
      body: JSON.stringify({ number: numero, text: texto, textMessage: { text: texto } }),
    });

    const corpo = await r.text();
    if (!r.ok) {
      let detalhe = corpo.slice(0, 200);
      try {
        const j = JSON.parse(corpo);
        detalhe = j?.message || j?.error || detalhe;
      } catch { /* mantém o texto cru */ }
      return { ok: false, erro: `API respondeu ${r.status}: ${detalhe}` };
    }

    let id = null;
    try { id = JSON.parse(corpo)?.key?.id || null; } catch { /* ignore */ }
    return { ok: true, id, numero };
  } catch (e) {
    return { ok: false, erro: e?.name === 'AbortError' ? 'tempo esgotado' : (e?.message || 'falha de conexão') };
  } finally {
    clearTimeout(timer);
  }
}
