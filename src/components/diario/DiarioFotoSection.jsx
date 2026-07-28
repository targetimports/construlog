import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, X, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DiarioFotoSection({ fotos, onChange, usuario }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          return {
            url_arquivo: file_url,
            legenda: '',
            usuario_upload: usuario || '',
            data_upload: new Date().toISOString(),
            _preview: URL.createObjectURL(file)
          };
        })
      );
      onChange([...fotos, ...uploads]);
      toast.success(`${uploads.length} foto(s) adicionada(s)`);
    } catch (err) {
      toast.error('Erro ao fazer upload: ' + err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const remover = (idx) => onChange(fotos.filter((_, i) => i !== idx));

  const atualizarLegenda = (idx, legenda) => {
    const novo = [...fotos];
    novo[idx] = { ...novo[idx], legenda };
    onChange(novo);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-sm">Fotos do Dia <span className="text-red-500">*</span></span>
          <span className="text-xs text-gray-500">(obrigatório para concluir)</span>
        </div>
        <label className={`cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Enviando...' : 'Adicionar Fotos'}
          </div>
        </label>
      </div>

      {fotos.length === 0 && (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
          <Camera className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Nenhuma foto adicionada</p>
          <p className="text-xs text-gray-400">Pelo menos 1 foto é obrigatória para concluir o diário</p>
        </div>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {fotos.map((foto, idx) => (
            <div key={idx} className="relative group">
              <img
                src={foto._preview || foto.url_arquivo}
                alt={foto.legenda || `Foto ${idx + 1}`}
                className="w-full h-28 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => remover(idx)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
              <input
                type="text"
                value={foto.legenda || ''}
                onChange={(e) => atualizarLegenda(idx, e.target.value)}
                placeholder="Legenda..."
                className="mt-1 w-full text-xs px-2 py-1 border border-gray-200 rounded"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}