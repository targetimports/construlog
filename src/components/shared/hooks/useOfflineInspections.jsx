import { useEffect, useState } from 'react';
import {
  getAllInspectionsOffline,
  getPhotosForInspection
} from '../db/offlineDatabase';

export function useOfflineInspections() {
  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const allInspections = await getAllInspectionsOffline();

      // Carregar fotos para cada vistoria
      const withPhotos = await Promise.all(
        allInspections.map(async (insp) => {
          const photos = await getPhotosForInspection(insp.id_local);
          return {
            ...insp,
            photos,
            payload: JSON.parse(insp.payload_json)
          };
        })
      );

      setInspections(withPhotos);
    } catch (err) {
      console.error('Erro ao carregar vistorias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, []);

  return { inspections, loading, reload: loadInspections };
}