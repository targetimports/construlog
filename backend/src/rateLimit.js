// LIMITE DE REQUISIÇÕES por IP (janela fixa, em memória).
//
// Sem dependência externa de propósito: rodamos uma instância só do backend, então
// um Map local dá conta. Se um dia houver mais de um processo, cada um passa a ter
// sua própria contagem — aí o certo é trocar por Redis.
//
// IMPORTANTE: depende de `app.set('trust proxy', 1)` no server.js. Sem isso o
// Express enxerga todo mundo como 127.0.0.1 (o nginx), e o limite de um visitante
// abusivo derrubaria TODOS os usuários juntos.

const baldes = new Map(); // chave -> { contagem, expiraEm }

// Limpeza periódica: sem isso o Map cresce para sempre com IPs que nunca voltam.
const LIMPEZA_MS = 10 * 60 * 1000;
setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of baldes) if (v.expiraEm <= agora) baldes.delete(k);
}, LIMPEZA_MS).unref();

/**
 * @param {object} opts
 * @param {number} opts.janelaMs   tamanho da janela
 * @param {number} opts.max        requisições permitidas por IP na janela
 * @param {string} opts.nome       identificador (separa as contagens entre rotas)
 * @param {string} [opts.mensagem] texto devolvido ao estourar
 * @param {(req) => boolean} [opts.pular] pula a checagem (ex.: usuário autenticado)
 */
export function limitePorIP({ janelaMs, max, nome, mensagem, pular }) {
  return (req, res, next) => {
    if (pular?.(req)) return next();

    const ip = req.ip || req.connection?.remoteAddress || 'desconhecido';
    const chave = `${nome}:${ip}`;
    const agora = Date.now();
    const balde = baldes.get(chave);

    if (!balde || balde.expiraEm <= agora) {
      baldes.set(chave, { contagem: 1, expiraEm: agora + janelaMs });
      return next();
    }

    balde.contagem += 1;
    if (balde.contagem > max) {
      const faltaSeg = Math.ceil((balde.expiraEm - agora) / 1000);
      res.set('Retry-After', String(faltaSeg));
      return res.status(429).json({
        error: 'muitas_requisicoes',
        message: mensagem || `Muitas tentativas. Tente de novo em ${faltaSeg}s.`,
      });
    }
    return next();
  };
}
