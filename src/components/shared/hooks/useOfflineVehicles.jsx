import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getVehiclesFromCache, saveVehiclesToCache } from '../db/offlineDatabase';

export function useOfflineVehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Carregar veículos: online → baixar do servidor; offline → do cache
  useEffect(() => {
    const loadVehicles = async () => {
      setLoading(true);
      try {
        if (isOnline) {
          // Baixar do servidor
          const data = await base44.entities.Veiculo.list('-updated_date', 500);
          const formatted = data.map((v) => ({
            id: v.id,
            placa: v.placa || '',
            nome: v.modelo || v.placa || '',
            modelo: v.modelo || '',
            ativo: v.status === 'ativo',
            updated_at: v.updated_date || new Date().toISOString()
          }));

          setVehicles(formatted);

          // Salvar em cache para offline
          await saveVehiclesToCache(formatted);
        } else {
          // Carregar do cache
          const cached = await getVehiclesFromCache();
          setVehicles(cached);

          if (cached.length === 0) {
            console.warn('Sem internet e sem cache de veículos');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar veículos:', err);

        // Tentar cache em caso de erro
        const cached = await getVehiclesFromCache();
        if (cached.length > 0) {
          setVehicles(cached);
          console.log('Carregou veículos do cache (fallback)');
        }
      } finally {
        setLoading(false);
      }
    };

    loadVehicles();
  }, [isOnline]);

  return { vehicles, loading, isOnline };
}