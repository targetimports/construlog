import { store } from '../entityStore.js';

// Bloqueia/libera a edição de um contrato (trava as medições associadas).

export default async function toggleEdicaoContrato({ body }) {
  const { contratoId, permitirEdicao } = body || {};
  if (!contratoId) {
    throw Object.assign(new Error('Contrato não informado.'), { status: 400 });
  }
  // permitirEdicao = true  -> bloqueia (edicao_habilitada: false)
  // permitirEdicao = false -> libera   (edicao_habilitada: true)
  const habilitada = !permitirEdicao;
  const contrato = await store.update('Contrato', contratoId, { edicao_habilitada: habilitada });
  if (!contrato) {
    throw Object.assign(new Error('Contrato não encontrado.'), { status: 404 });
  }
  return { ok: true, contrato, edicao_habilitada: habilitada };
}
