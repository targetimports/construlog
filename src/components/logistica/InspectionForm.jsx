import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Upload, X } from 'lucide-react';
import { createInspectionOffline, addPhotoToInspection } from '@/components/shared/db/offlineDatabase';
import { compressImage } from '@/components/logistica/imageUtils';

export default function InspectionForm({
  vehicles,
  onSaved,
  onCancel
}) {
  const [selectedVehicle, setSelectedVehicle] = useState('');

  // Mostra todos os veículos da frota. Não dá pra filtrar por status aqui: o
  // useOfflineVehicles entrega só um booleano `ativo` (= status==='ativo'), que
  // fica falso para veículos sem status preenchido — filtrar por ele esvaziava
  // a lista.
  const veiculoOptions = useMemo(() => (vehicles || [])
    .map(v => ({ value: v.id, label: `${v.nome || v.placa || 'Veículo'}${v.placa ? ` (${v.placa})` : ''}` })),
  [vehicles]);
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handlePhotoSelect = async (e) => {
    const files = Array.from(e.target.files || []);

    for (const file of files) {
      try {
        // Validar tamanho original
        if (file.size > 50 * 1024 * 1024) {
          setError(`Arquivo muito grande: ${file.name}`);
          continue;
        }

        // Comprimir se for imagem
        if (file.type.startsWith('image/')) {
          const compressed = await compressImage(file);
          setPhotos(prev => [...prev, compressed]);
        } else {
          setPhotos(prev => [...prev, file]);
        }
      } catch (err) {
        setError(`Erro ao processar ${file.name}`);
      }
    }
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedVehicle) {
      setError('Selecione um veículo');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Criar vistoria
      const inspectionId = await createInspectionOffline(selectedVehicle, {
        vehicle_id: selectedVehicle,
        timestamp: new Date().toISOString(),
        notes: ''
      });

      // Adicionar fotos
      for (const photo of photos) {
        const blob = await photo.arrayBuffer().then(ab => new Blob([ab], { type: photo.type }));
        await addPhotoToInspection(inspectionId, blob, photo.type);
      }

      onSaved();
      } catch (err) {
      setError(err?.message || 'Erro ao salvar vistoria');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">Veículo *</Label>
        <ComboboxBusca
          options={veiculoOptions}
          value={selectedVehicle}
          onSelect={setSelectedVehicle}
          placeholder="Selecione um veículo"
          searchPlaceholder="Buscar por nome ou placa..."
          emptyMessage="Nenhum veículo disponível."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Fotos</label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handlePhotoSelect}
            disabled={saving}
            className="hidden"
            id="photo-input"
          />
          <label htmlFor="photo-input" className="cursor-pointer">
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Clique ou arraste fotos</p>
          </label>
        </div>

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative bg-gray-100 rounded p-2">
                <p className="text-xs text-gray-600 truncate">{photo.name}</p>
                <button
                  onClick={() => handleRemovePhoto(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !selectedVehicle}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {saving ? 'Salvando...' : 'Salvar Vistoria'}
        </Button>
      </div>
    </div>
  );
}