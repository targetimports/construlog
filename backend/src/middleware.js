import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET não definido');
  process.exit(1);
}

export const signToken = (user) => {
  // user pode ser a linha do banco (extras em .data) ou um objeto já achatado.
  const extra = user.data || user;
  const empresa_id = extra.empresa_id ?? null;
  const acesso_global = user.role === 'admin' || extra.acesso_global === true;
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.full_name, empresa_id, acesso_global },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
};

// ─── Escopo multi-empresa ───
// GLOBAL = admin (role) ou staff da matriz (acesso_global) → vê tudo.
// MEMBRO = qualquer outro usuário → escopado à própria empresa; se estiver
// sem empresa_id vinculado (e sem acesso_global), NÃO é global: cai em
// fail-closed (vê nada) em vez de vazar o grupo inteiro.
// Obs.: signToken já força acesso_global p/ admin e o seed marca a matriz
// com acesso_global=true, então ambos seguem globais sem depender de empresa_id.
export const isGlobal = (user) =>
  !!user && (user.role === 'admin' || user.acesso_global === true);

export const empresaIdDe = (user) => (user && user.empresa_id) || null;

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    // Normaliza: req.user.email sempre disponível, req.user.id = sub
    req.user.id = req.user.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'auth_required' });
  }
};

export const errorHandler = (err, req, res, _next) => {
  const status = err.status || 500;
  res.locals.errMsg = err.message || 'internal_error'; // usado pelo log de auditoria em arquivo
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} —`, err.message);
    if (err.stack) console.error(err.stack);
  }
  res.status(status).json({ error: err.message || 'internal_error' });
};
