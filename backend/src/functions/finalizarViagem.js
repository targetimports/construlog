import { store } from '../entityStore.js';
import { isSuperAdmin } from '../rbac.js';

// Finaliza uma Viagem: status → finalizada, marca retorno e km/combustível
// finais, e conclui a SolicitacaoVeiculo vinculada (best-effort).

export default async function finalizarViagem({ body, user }) {
  const { viagem_id, km_inicial, km_final, combustivel_final_percent, combustivel_inicial_percent, observacoes } = body || {};
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

  // KM inicial: a finalização também o aceita, pois rotas iniciadas pelo fluxo
  // de GPS (iniciarViagemComRastreamento) pulam a captura do KM inicial. Só
  // grava quando vier um valor (não apaga o que já existe).
  const patch = {
    status: 'finalizada',
    // Não sobrescreve o retorno já registrado (permite corrigir KM depois sem
    // mexer na hora original de retorno).
    retorno_real: viagem.retorno_real || new Date().toISOString(),
    km_final: km_final ?? null,
    combustivel_final_percent: combustivel_final_percent ?? null,
    observacoes: observacoes || ''
  };
  if (km_inicial != null) patch.km_inicial = km_inicial;
  if (combustivel_inicial_percent != null) patch.combustivel_inicial_percent = combustivel_inicial_percent;

  const viagemAtualizada = await store.update('Viagem', viagem_id, patch);

  // Conclui a solicitação de veículo vinculada (best-effort).
  if (viagem.solicitacao_id) {
    try {
      const [sol] = await store.filter('SolicitacaoVeiculo', { id: viagem.solicitacao_id }, null, 1);
      if (sol) await store.update('SolicitacaoVeiculo', viagem.solicitacao_id, { status: 'concluida' });
    } catch { /* best-effort */ }
  }

  // Se a Viagem nasceu de uma Rota do motorista, conclui a rota também
  // (fecha o ciclo e popula o Histórico de /MinhasViagens). Best-effort.
  if (viagem.rota_id) {
    try {
      await store.update('RotaMotorista', viagem.rota_id, {
        status: 'concluida',
        data_hora_chegada: new Date().toISOString()
      });
    } catch { /* best-effort */ }
  }

  return { success: true, viagem: viagemAtualizada };
}
