import { store } from '../entityStore.js';

// Edita um contrato existente. Recebe { contrato_id, ...campos }.

const num = (v) => Number(v) || 0;

export default async function editarContrato({ body }) {
  const { contrato_id, id, created_date, updated_date, created_by, ...rest } = body || {};
  const cid = contrato_id || id;
  if (!cid) throw Object.assign(new Error('contrato_id é obrigatório.'), { status: 400 });

  const payload = { ...rest };
  if (rest.valor_inicial != null) payload.valor_inicial = num(rest.valor_inicial);
  if (rest.valor_total != null) payload.valor_total = num(rest.valor_total);

  await store.update('Contrato', cid, payload);
  return { ok: true, contrato_id: cid };
}
