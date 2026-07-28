import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const TIPOS_MIDIA = [
  { value: 'FOTO', label: 'Foto' },
  { value: 'VIDEO', label: 'Vídeo' }
];

export default function UploadMidiaMovimentacao({ midias, onMidiasChange }) {
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const handleUpload = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingIndex(index);

      const uploadResult = await base44.integrations.Core.UploadFile({
        file: file
      });

      if (!uploadResult.file_url) {
        throw new Error('Erro ao fazer upload');
      }

      const novasMidias = [...midias];
      const tipo = file.type.startsWith('video') ? 'VIDEO' : 'FOTO';
      
      novasMidias[index] = {
        tipo: tipo,
        arquivo_url: uploadResult.file_url,
        legenda: `${tipo} - ${new Date().toLocaleString('pt-BR')}`
      };
      
      onMidiasChange(novasMidias);
      toast.success(`${tipo} enviada!`);
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemover = (index) => {
    const novasMidias = midias.filter((_, i) => i !== index);
    onMidiasChange(novasMidias);
  };

  const handleAdicionarSlot = () => {
    onMidiasChange([...midias, { tipo: 'FOTO', arquivo_url: '', legenda: '' }]);
  };

  const midiasFilled = midias.filter((m) => m.arquivo_url).length;

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Evidências (Fotos/Vídeos)
          <Badge className="bg-gray-900/30 text-gray-400 border-0 text-xs">
            {midiasFilled} enviado
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Slots de upload */}
        <div className="space-y-3">
          {midias.map((midia, idx) => (
            <div key={idx} className="border border-gray-700 rounded-lg p-3 bg-gray-700/20">
              {midia.arquivo_url ? (
                <div className="space-y-2">
                  {midia.tipo === 'FOTO' ? (
                    <img
                      src={midia.arquivo_url}
                      alt={midia.legenda}
                      className="w-full h-24 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-gray-400">
                      Vídeo
                    </div>
                  )}
                  <p className="text-xs text-gray-400">{midia.legenda}</p>
                  <div className="flex gap-2">
                    <label className="flex-1">
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleUpload(e, idx)}
                        className="hidden"
                      />
                      <Button
                        asChild
                        variant="outline"
                        className="w-full border-gray-600 text-gray-300 text-xs cursor-pointer"
                      >
                        <span>Trocar</span>
                      </Button>
                    </label>
                    <Button
                      onClick={() => handleRemover(idx)}
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleUpload(e, idx)}
                    className="hidden"
                  />
                  <Button
                    asChild
                    variant="ghost"
                    className="w-full h-24 cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <div>
                      <Upload className="w-5 h-5 text-gray-500" />
                      <div className="text-xs text-gray-400 mt-1">Clique para enviar</div>
                    </div>
                  </Button>
                </label>
              )}
            </div>
          ))}
        </div>

        {/* Adicionar slot */}
        <Button
          onClick={handleAdicionarSlot}
          variant="outline"
          className="w-full border-gray-600 text-gray-300 gap-2"
        >
          <Upload className="w-4 h-4" />
          Adicionar Mídia
        </Button>

        <p className="text-xs text-gray-400">
          Envie fotos do painel/km, danos, locais de trabalho, etc.
        </p>
      </CardContent>
    </Card>
  );
}