// Shim local — substitui o @base44/sdk no self-host.
// Expõe a mesma superfície que o app usa:
//   base44.auth.{me, updateMe, login, logout, redirectToLogin, getToken, setToken}
//   base44.entities[Nome].{list, filter, get, read, create, update, delete, bulkCreate}
//   base44.integrations.Core.{SendEmail, UploadFile, InvokeLLM, ExtractDataFromUploadedFile}
//   base44.functions.invoke(name, payload)
//   base44.asServiceRole.* → alias (no self-host tudo passa pelo JWT do usuário)

const API_BASE = '/api';
const TOKEN_KEY = 'construlog_token';

const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
const setToken = (t) => { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {} };

const apiFetch = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const isForm = options.body instanceof FormData;
  if (!isForm && options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    // Só sinaliza para chamadas que NÃO são de auth. O /auth/me e /auth/login
    // retornam 401 normalmente quando não há sessão — disparar o evento aqui
    // criaria um loop infinito (evento → checkAppState → me() 401 → evento → …).
    if (!path.startsWith('/auth/')) showLogin();
    // erro no formato axios (err.response.status) + err.status, p/ compatibilidade
    throw Object.assign(new Error('auth_required'), { status: 401, response: { status: 401, data: { error: 'auth_required' } } });
  }
  if (!res.ok) {
    let detail = null;
    try { detail = await res.json(); } catch {}
    throw Object.assign(new Error(detail?.error || res.statusText || 'request_failed'), {
      status: res.status,
      detail,
      // Espelha o formato do axios usado pelo @base44/sdk: muitos pontos do app
      // checam err.response.status (ex.: fallback de RBAC em 404).
      response: { status: res.status, data: detail },
    });
  }
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
};

// Sessão necessária/expirada → avisa o React (AuthContext escuta este evento e
// faz o App renderizar a LoginScreen). Sem overlay vanilla.
function showLogin() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('construlog:unauthorized'));
  }
}

// ───────────── Entities ─────────────
const makeEntity = (name) => ({
  list: (orderBy, limit) => {
    const qs = new URLSearchParams();
    if (orderBy) qs.set('orderBy', orderBy);
    if (limit != null) qs.set('limit', String(limit));
    const q = qs.toString();
    return apiFetch(`/entities/${name}${q ? `?${q}` : ''}`);
  },
  filter: (filter = {}, orderBy, limit) =>
    apiFetch(`/entities/${name}/filter`, { method: 'POST', body: JSON.stringify({ filter, orderBy, limit }) }),
  get: (id) => apiFetch(`/entities/${name}/${encodeURIComponent(id)}`),
  read: (id) => apiFetch(`/entities/${name}/${encodeURIComponent(id)}`),
  create: (data) => apiFetch(`/entities/${name}`, { method: 'POST', body: JSON.stringify(data) }),
  bulkCreate: (items) => apiFetch(`/entities/${name}/bulk`, { method: 'POST', body: JSON.stringify(items) }),
  update: (id, data) => apiFetch(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/entities/${name}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
});

// Proxy: qualquer base44.entities.NomeQualquer funciona, sem lista fixa.
const entities = new Proxy({}, {
  get: (cache, prop) => {
    if (typeof prop !== 'string') return undefined;
    if (!cache[prop]) cache[prop] = makeEntity(prop);
    return cache[prop];
  },
});

// ───────────── Auth ─────────────
const auth = {
  async me() { return apiFetch('/auth/me'); },
  async updateMe(data) {
    const res = await apiFetch('/auth/me', { method: 'PUT', body: JSON.stringify(data || {}) });
    // Backend reemite o token quando o e-mail muda (claims carregam o e-mail).
    if (res && res._token) { setToken(res._token); delete res._token; }
    return res;
  },
  async changePassword(senha_atual, nova_senha) {
    return apiFetch('/auth/me/password', { method: 'PUT', body: JSON.stringify({ senha_atual, nova_senha }) });
  },
  async login(email, password) {
    const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (res?.token) setToken(res.token);
    return res;
  },
  async logout() {
    try { await apiFetch('/auth/logout', { method: 'POST' }); } catch {}
    setToken(null);
    showLogin();
  },
  redirectToLogin() { showLogin(); },
  setToken,
  getToken,
};

// ───────────── Integrations ─────────────
const integrations = {
  Core: {
    SendEmail: (args) => apiFetch('/integrations/email', { method: 'POST', body: JSON.stringify(args || {}) }),
    UploadFile: ({ file }) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiFetch('/integrations/upload', { method: 'POST', body: fd });
    },
    InvokeLLM: (args) => apiFetch('/integrations/invoke-llm', { method: 'POST', body: JSON.stringify(args || {}) }),
    ExtractDataFromUploadedFile: (args) => apiFetch('/integrations/extract-data', { method: 'POST', body: JSON.stringify(args || {}) }),
  },
};

// ───────────── Functions ─────────────
const functions = {
  invoke: (name, payload) =>
    apiFetch(`/functions/${encodeURIComponent(name)}`, { method: 'POST', body: JSON.stringify(payload || {}) }),
};

// base44.appLogs.logUserInApp(pageName) — telemetria de navegação. No self-host
// é um no-op (não quebra o NavigationTracker).
const appLogs = {
  logUserInApp: async () => ({ ok: true }),
};

const client = { auth, entities, integrations, functions, appLogs };
// base44.api(path, opts) — chamada direta a uma rota do backend que não é
// entidade nem function (ex.: /instalacao/configurar, /licenca). Já leva o token
// e o tratamento de erro; evita cada tela reinventar o fetch.
client.api = (path, { method = 'GET', body } = {}) =>
  apiFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
// base44.users — coleção de usuários; mapeia para a entidade User.
client.users = makeEntity('User');
client.asServiceRole = client;

export const base44 = client;
export default base44;
