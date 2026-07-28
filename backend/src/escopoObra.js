import { query, entityTable } from './db.js';
import { isGlobal, empresaIdDe } from './middleware.js';

// Auditoria 2026-07-01: funções que recebem obra_id não checavam o dono → um membro
// informando obra_id de OUTRA empresa via a função. Este helper barra o acesso cruzado.
// Matriz/global acessa qualquer obra; membro só a da própria empresa.
export async function podeAcessarObra(user, obra_id) {
  if (isGlobal(user)) return true;
  if (!obra_id) return true; // sem obra: a própria função decide
  const eid = empresaIdDe(user);
  if (!eid) return false;
  const { rows } = await query(`SELECT data->>'empresa_id' AS eid FROM ${entityTable('Obra')} WHERE id = $1`, [obra_id]);
  if (!rows[0]) return true; // obra inexistente: deixa a função tratar o 404
  return rows[0].eid === eid;
}

// empresa_id a filtrar em leituras amplas dentro de functions (null = global, sem filtro).
export function escopoEmpresaDe(user) {
  return isGlobal(user) ? null : empresaIdDe(user);
}
