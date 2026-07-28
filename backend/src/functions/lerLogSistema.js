import fs from 'node:fs';
import { LOG_PATH } from '../logger.js';
import { isSuperAdmin } from '../rbac.js';

// Lê o log de auditoria em arquivo (app.log). Restrito a super/TI (admin, programador).
// Retorna as últimas `limite` linhas, mais recentes primeiro, já parseadas.
export default async function lerLogSistema({ body, user }) {
  if (!isSuperAdmin(user)) {
    throw Object.assign(new Error('Apenas TI/Admin podem ver o log do sistema'), { status: 403 });
  }
  const limite = Math.min(Math.max(Number(body?.limite) || 500, 1), 5000);

  let tamanho = 0;
  try {
    tamanho = fs.statSync(LOG_PATH).size;
  } catch {
    return { linhas: [], total: 0, tamanho: 0, path: LOG_PATH };
  }

  const todas = fs.readFileSync(LOG_PATH, 'utf8').split('\n').filter(Boolean);
  const linhas = todas
    .slice(-limite)
    .reverse()
    .map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });

  return { linhas, total: todas.length, tamanho, path: LOG_PATH };
}
