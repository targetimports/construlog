import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// Inicia uma Viagem: status → em_andamento, marca saída e km/combustível
// iniciais. Permissão: motorista da viagem ou admin. Usada por /ViagensAbastecimentos.

export default async function iniciarViagem({ body, user }) {
  const { viagem_id, km_inicial, combustivel_inicial_percent } = body || {};
  if (!viagem_id) {
    throw Object.assign(new Error('viagem_id obrigatório'), { status: 400 });
  }

  const [viagem] = await store.filter('Viagem', { id: viagem_id }, null, 1);
  if (!viagem) {
    throw Object.assign(new Error('Viagem não encontrada'), { status: 404 });
  }
  if (viagem.motorista_user_id !== user?.email && !isSuperAdmin(user)) {
    throw Object.assign(new Error('Sem permissão'), { status: 403 });
  }

  const atualizada = await store.update('Viagem', viagem_id, {
    status: 'em_andamento',
    saida_real: new Date().toISOString(),
    km_inicial: km_inicial ?? null,
    combustivel_inicial_percent: combustivel_inicial_percent ?? null
  });

  return { success: true, viagem: atualizada };
}
