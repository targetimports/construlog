import { store } from '../entityStore.js';
import { requirePermission } from '../rbac.js';

// Frota -> Ativo (automático). Garante um Ativo (patrimônio) vinculado a um Veiculo.
// Idempotente: se já houver vínculo, apenas sincroniza nome/código/status.
export default async function criarAtivoDeVeiculo({ body, user }) {
  requirePermission(user, 'LOGISTICA_VIEW');
  const { veiculo_id } = body || {};
  if (!veiculo_id) throw new Error('veiculo_id é obrigatório');

  const veiculo = (await store.filter('Veiculo', { id: veiculo_id }))[0];
  if (!veiculo) throw new Error('Veículo não encontrado');

  const dados = {
    tipo: 'veiculo_pequeno',
    nome: veiculo.modelo || veiculo.placa || 'Veículo',
    codigo: veiculo.placa || '',
    status: veiculo.ativo !== false ? 'disponivel' : 'inativo',
    localizacao_atual: 'almoxarifado',
    placa: veiculo.placa || '',
    veiculo_id: veiculo.id,
  };

  // Já vinculado? Sincroniza e sai.
  if (veiculo.ativo_id) {
    const existe = (await store.filter('Ativo', { id: veiculo.ativo_id }))[0];
    if (existe) {
      await store.update('Ativo', veiculo.ativo_id, { nome: dados.nome, codigo: dados.codigo, status: dados.status, placa: dados.placa });
      return { success: true, ativo_id: veiculo.ativo_id };
    }
  }

  const a = await store.create('Ativo', dados, user?.email || null);
  await store.update('Veiculo', veiculo_id, { ativo_id: a.id });
  return { success: true, ativo_id: a.id };
}
