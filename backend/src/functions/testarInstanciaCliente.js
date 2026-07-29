import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// TESTAR INSTÂNCIA DO CLIENTE
//
// Bate no /health da instância que o cliente usa e grava o resultado. Roda no
// backend de propósito: o navegador não consegue chamar outro domínio (CORS) e
// não deve conhecer as chaves de acesso das instâncias.
//
// Registra tanto sucesso quanto falha em LogIntegracao — é esse histórico que
// alimenta a tela de Relatórios; sem ele só se saberia o estado do último teste.

const TIMEOUT_MS = 8000;

export default async function testarInstanciaCliente({ body, user }) {
  if (!isSuperAdmin(user)) {
    throw Object.assign(new Error('Apenas administradores podem testar instâncias'), { status: 403 });
  }

  const id = String(body?.instancia_id || '').trim();
  if (!id) throw Object.assign(new Error('instancia_id é obrigatório'), { status: 400 });

  const inst = (await store.filter('InstanciaCliente', { id }))[0];
  if (!inst) throw Object.assign(new Error('Instância não encontrada'), { status: 404 });

  const base = String(inst.url || '').replace(/\/+$/, '');
  if (!base) throw Object.assign(new Error('A instância não tem URL cadastrada'), { status: 400 });

  const alvo = `${base}/api/health`;
  const inicio = Date.now();

  let status = 'offline';
  let httpStatus = null;
  let erro = null;
  let versao = inst.versao || null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(alvo, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);

    httpStatus = r.status;
    if (r.ok) {
      status = 'online';
      // O /health pode devolver a versão; se vier, atualiza o cadastro.
      const corpo = await r.json().catch(() => ({}));
      if (corpo?.versao) versao = String(corpo.versao);
    } else {
      status = 'instavel';
      erro = `HTTP ${r.status}`;
    }
  } catch (e) {
    status = 'offline';
    erro = e?.name === 'AbortError' ? `Sem resposta em ${TIMEOUT_MS / 1000}s` : (e?.message || 'Falha de conexão');
  }

  const tempo_ms = Date.now() - inicio;
  const agora = new Date().toISOString();

  // update faz merge do patch — mandar só o que mudou evita reescrever o cadastro.
  await store.update('InstanciaCliente', id, {
    status,
    versao,
    ultimo_teste: agora,
    ultimo_tempo_ms: tempo_ms,
    ultimo_erro: erro,
  });

  await store.create('LogIntegracao', {
    instancia_id: id,
    instancia_nome: inst.nome || inst.url,
    cliente_id: inst.cliente_id || null,
    cliente_nome: inst.cliente_nome || null,
    tipo: 'health',
    status,
    http_status: httpStatus,
    tempo_ms,
    erro,
    testado_em: agora,
    testado_por: user?.email || null,
  });

  return { ok: status === 'online', status, tempo_ms, http_status: httpStatus, erro, versao };
}
