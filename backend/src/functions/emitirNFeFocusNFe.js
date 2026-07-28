// Proxy para a API Focus NFe (ambiente de HOMOLOGAÇÃO): emitir e consultar NF-e.
// Requer FOCUS_NFE_TOKEN no .env do servidor.
const BASE_URL = 'https://homologacao.focusnfe.com.br';

export default async function emitirNFeFocusNFe({ body, user }) {
  if (!user) throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const token = process.env.FOCUS_NFE_TOKEN;
  if (!token) {
    throw Object.assign(new Error('FOCUS_NFE_TOKEN não configurado nas variáveis de ambiente do servidor.'), { status: 500 });
  }
  const AUTH = 'Basic ' + Buffer.from(`${token}:`).toString('base64');

  const { action, ref, body: nfeBody } = body || {};

  if (action === 'emitir') {
    if (!ref || !nfeBody) throw Object.assign(new Error('ref e body são obrigatórios'), { status: 400 });
    const r = await fetch(`${BASE_URL}/v2/nfe?ref=${encodeURIComponent(ref)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: AUTH },
      body: JSON.stringify(nfeBody)
    });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }

  if (action === 'consultar') {
    if (!ref) throw Object.assign(new Error('ref é obrigatório'), { status: 400 });
    const r = await fetch(`${BASE_URL}/v2/nfe/${encodeURIComponent(ref)}`, { headers: { Authorization: AUTH } });
    const data = await r.json().catch(() => ({}));
    return { status: r.status, data };
  }

  throw Object.assign(new Error('action inválida. Use "emitir" ou "consultar".'), { status: 400 });
}
