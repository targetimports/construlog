import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  getPendingInspections,
  getPhotosForInspection,
  markInspectionAsSynced,
  markPhotosAsSynced
} from '../db/offlineDatabase';

export function useSyncQueue() {
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    pendingCount: 0
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Contar pendentes
  const updatePendingCount = async () => {
    const pending = await getPendingInspections();
    setSyncStatus(prev => ({ ...prev, pendingCount: pending.length }));
  };

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000); // A cada 5s
    return () => clearInterval(interval);
  }, []);

  // Sincronizar automaticamente quando voltar online
  useEffect(() => {
    if (isOnline && syncStatus.pendingCount > 0) {
      console.log('Online detectado — sincronizando...');
      processSyncQueue();
    }
  }, [isOnline, syncStatus.pendingCount]);

  const processSyncQueue = async () => {
    if (syncStatus.isSyncing) return;

    setSyncStatus(prev => ({ ...prev, isSyncing: true, lastError: undefined }));

    try {
      const pending = await getPendingInspections();

      for (const inspection of pending) {
        await syncInspection(inspection);
      }

      await updatePendingCount();
      console.log('Sincronização completa');
    } catch (err) {
      const msg = err?.message || 'Erro desconhecido';
      console.error('Erro na sincronização:', msg);
      setSyncStatus(prev => ({ ...prev, lastError: msg }));
    } finally {
      setSyncStatus(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const syncInspection = async (inspection) => {
    try {
      // 1. Enviar vistoria
      const payload = JSON.parse(inspection.payload_json);
      const response = await base44.functions.invoke('syncOfflineInspections', {
        operation: 'create_inspection',
        id_local: inspection.id_local,
        data: payload
      });

      const id_servidor = response.data?.id;

      if (!id_servidor) {
        throw new Error('Servidor não retornou ID da vistoria');
      }

      // 2. Enviar fotos
      const photos = await getPhotosForInspection(inspection.id_local);
      if (photos.length > 0) {
        await syncPhotos(id_servidor, photos);
      }

      // 3. Marcar como sincronizado
      await markInspectionAsSynced(inspection.id_local, id_servidor);
      await markPhotosAsSynced(photos.map(p => p.id_local));

      console.log(`Vistoria ${inspection.id_local} sincronizada`);
    } catch (err) {
      console.error(`Erro ao sincronizar ${inspection.id_local}:`, err);
      throw err;
    }
  };

  const syncPhotos = async (
    inspection_id,
    photos
  ) => {
    // Implementar upload de fotos
    // POST /api/inspections/:id/photos com FormData
    console.log(`Sincronizando ${photos.length} fotos da vistoria ${inspection_id}`);
  };

  return {
    syncStatus,
    processSyncQueue,
    isOnline
  };
}