/**
 * safeJson - lê o body de uma Request de forma segura, sem jamais lançar exceção.
 * Retorna `fallback` se: método GET/HEAD, body vazio ou JSON inválido.
 *
 * @param {Request} req
 * @param {object} fallback
 * @returns {Promise<object>}
 */
export async function safeJson(req, fallback = {}) {
  const method = (req.method || '').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return fallback;

  try {
    const text = await req.text();
    if (!text || text.trim() === '') return fallback;
    return JSON.parse(text);
  } catch (_) {
    return fallback;
  }
}