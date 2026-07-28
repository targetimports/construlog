import { store } from '../entityStore.js';
import { podeEditarObra } from '../rbac.js';

// Porte de removerColaboradorDaObra: inativa o vínculo (soft-delete) preservando
// o histórico da equipe da obra.
export default async function removerColaboradorDaObra({ body, user }) {
  const { vinculo_id } = body || {};
  if (!vinculo_id) throw Object.assign(new Error('vinculo_id obrigatório'), { status: 400 });

  const vinculo = (await store.filter('ObraColaborador', { id: vinculo_id }))[0];
  if (!vinculo) throw Object.assign(new Error('Vínculo não encontrado'), { status: 404 });

  const obra = vinculo.obra_id ? (await store.filter('Obra', { id: vinculo.obra_id }))[0] : null;
  if (!podeEditarObra(user, obra)) {
    throw Object.assign(new Error('Apenas responsáveis pela obra (ou Admin/TI/Financeiro) podem alterar a equipe.'), { status: 403 });
  }

  await store.update('ObraColaborador', vinculo_id, {
    status: 'inativo',
    data_fim: new Date().toISOString().split('T')[0],
    removido_por: user?.email || null,
  });

  return { ok: true };
}
