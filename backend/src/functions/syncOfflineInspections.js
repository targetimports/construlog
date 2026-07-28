import { store } from '../entityStore.js';

// Sincroniza vistorias criadas offline (IndexedDB em /FrotaVistorias) para o
// servidor. Cada vistoria vira um DiarioObra. Idempotente por id_local: se já
// existe um DiarioObra com aquele id_local, devolve o id existente sem duplicar.

export default async function syncOfflineInspections({ body, user }) {
  const { operation, id_local, data } = body || {};

  if (operation === 'create_inspection') {
    if (id_local) {
      const existentes = await store.filter('DiarioObra', { id_local }, null, 1);
      if (existentes[0]) {
        return { id: existentes[0].id, message: 'Vistoria já existe (idempotente)' };
      }
    }
    const inspection = await store.create('DiarioObra', {
      ...(data || {}),
      id_local: id_local || null,
      created_by_offline: user?.email,
      sync_status: 'synced'
    }, user?.email || null);
    return { id: inspection.id, message: 'Vistoria sincronizada com sucesso' };
  }

  throw Object.assign(new Error('Operação inválida'), { status: 400 });
}
