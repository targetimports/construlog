// ============ OFFLINE DATABASE WITH LOCALSTORAGE ============

const DB_KEYS = {
  VEHICLES: 'offline_vehicles',
  INSPECTIONS: 'offline_inspections',
  PHOTOS: 'offline_photos',
  SYNC_QUEUE: 'offline_sync_queue'
};

// Carregar veículos do cache
export async function getVehiclesFromCache() {
  try {
    const data = localStorage.getItem(DB_KEYS.VEHICLES);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Erro ao carregar veículos do cache:', err);
    return [];
  }
}

// Salvar veículos no cache
export async function saveVehiclesToCache(vehicles) {
  try {
    localStorage.setItem(DB_KEYS.VEHICLES, JSON.stringify(vehicles));
    console.log(`${vehicles.length} veículos salvos em cache`);
  } catch (err) {
    console.error('Erro ao salvar veículos no cache:', err);
  }
}

// Criar vistoria offline
export async function createInspectionOffline(vehicle_id, payload) {
  const id_local = `insp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  try {
    const inspections = JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
    inspections.push({
      id_local,
      vehicle_id,
      payload_json: JSON.stringify(payload),
      status_sync: 'pending',
      created_at: now,
      updated_at: now
    });
    localStorage.setItem(DB_KEYS.INSPECTIONS, JSON.stringify(inspections));
    console.log(`Vistoria offline criada: ${id_local}`);
    return id_local;
  } catch (err) {
    console.error('Erro ao criar vistoria offline:', err);
    throw err;
  }
}

// Obter vistorias pendentes
export async function getPendingInspections() {
  try {
    const inspections = JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
    return inspections.filter(i => i.status_sync === 'pending');
  } catch (err) {
    console.error('Erro ao obter vistorias pendentes:', err);
    return [];
  }
}

// Obter todas as vistorias offline
export async function getAllInspectionsOffline() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
  } catch (err) {
    console.error('Erro ao obter vistorias:', err);
    return [];
  }
}

// Adicionar foto à vistoria offline
export async function addPhotoToInspection(inspection_id_local, blob, mime) {
  const id_local = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  try {
    const photos = JSON.parse(localStorage.getItem(DB_KEYS.PHOTOS) || '[]');
    photos.push({
      id_local,
      inspection_id_local,
      blob_url: blob instanceof Blob ? URL.createObjectURL(blob) : blob,
      mime,
      created_at: now,
      status_sync: 'pending'
    });
    localStorage.setItem(DB_KEYS.PHOTOS, JSON.stringify(photos));
    console.log(`Foto adicionada: ${id_local}`);
    return id_local;
  } catch (err) {
    console.error('Erro ao adicionar foto:', err);
    throw err;
  }
}

// Obter fotos de uma vistoria
export async function getPhotosForInspection(inspection_id_local) {
  try {
    const photos = JSON.parse(localStorage.getItem(DB_KEYS.PHOTOS) || '[]');
    return photos.filter(p => p.inspection_id_local === inspection_id_local);
  } catch (err) {
    console.error('Erro ao obter fotos:', err);
    return [];
  }
}

// Marcar vistoria como sincronizada
export async function markInspectionAsSynced(id_local, id_servidor) {
  try {
    const inspections = JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
    const idx = inspections.findIndex(i => i.id_local === id_local);
    if (idx !== -1) {
      inspections[idx].status_sync = 'synced';
      inspections[idx].id_servidor = id_servidor;
      inspections[idx].updated_at = new Date().toISOString();
      localStorage.setItem(DB_KEYS.INSPECTIONS, JSON.stringify(inspections));
      console.log(`Vistoria marcada como sincronizada: ${id_local}`);
    }
  } catch (err) {
    console.error('Erro ao marcar vistoria como sincronizada:', err);
  }
}

// Marcar fotos como sincronizadas
export async function markPhotosAsSynced(photo_ids) {
  try {
    const photos = JSON.parse(localStorage.getItem(DB_KEYS.PHOTOS) || '[]');
    const now = new Date().toISOString();
    photo_ids.forEach(id => {
      const idx = photos.findIndex(p => p.id_local === id);
      if (idx !== -1) {
        photos[idx].status_sync = 'synced';
        photos[idx].updated_at = now;
      }
    });
    localStorage.setItem(DB_KEYS.PHOTOS, JSON.stringify(photos));
    console.log(`${photo_ids.length} fotos marcadas como sincronizadas`);
  } catch (err) {
    console.error('Erro ao marcar fotos como sincronizadas:', err);
  }
}

// Limpar todas as vistorias sincronizadas
export async function cleanupSyncedInspections() {
  try {
    const inspections = JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
    const synced_ids = inspections.filter(i => i.status_sync === 'synced').map(i => i.id_local);

    if (synced_ids.length > 0) {
      const photos = JSON.parse(localStorage.getItem(DB_KEYS.PHOTOS) || '[]');
      const remaining = photos.filter(p => !synced_ids.includes(p.inspection_id_local) || p.status_sync !== 'synced');
      localStorage.setItem(DB_KEYS.PHOTOS, JSON.stringify(remaining));
    }

    const remaining = inspections.filter(i => i.status_sync !== 'synced');
    localStorage.setItem(DB_KEYS.INSPECTIONS, JSON.stringify(remaining));
    console.log(`Limpeza completa: ${synced_ids.length} vistorias removidas`);
  } catch (err) {
    console.error('Erro ao limpar vistorias sincronizadas:', err);
  }
}

// Excluir uma vistoria offline específica (e suas fotos).
export async function deleteInspectionOffline(id_local) {
  try {
    const inspections = JSON.parse(localStorage.getItem(DB_KEYS.INSPECTIONS) || '[]');
    localStorage.setItem(DB_KEYS.INSPECTIONS, JSON.stringify(inspections.filter(i => i.id_local !== id_local)));
    const photos = JSON.parse(localStorage.getItem(DB_KEYS.PHOTOS) || '[]');
    localStorage.setItem(DB_KEYS.PHOTOS, JSON.stringify(photos.filter(p => p.inspection_id_local !== id_local)));
    return true;
  } catch (err) {
    console.error('Erro ao excluir vistoria offline:', err);
    return false;
  }
}