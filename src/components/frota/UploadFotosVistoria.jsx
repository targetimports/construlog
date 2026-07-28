import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

const LOCAIS_OBRIGATORIOS = [
  { id: 'frente', label: 'Frente do Veículo' },
  { id: 'lateral', label: 'Lateral' },
  { id: 'traseira', label: 'Traseira' },
  { id: 'painel', label: 'Painel/KM' }
];

export default function UploadFotosVistoria({ fotos, onFotosChange, isLoading = false }) {
  const [uploadingIndex, setUploadingIndex] = useState(null);

  const handleUploadFoto = async (e, index) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Apenas imagens são permitidas');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem não pode exceder 5MB');
      return;
    }

    try {
      setUploadingIndex(index);

      // Fazer upload da imagem
      const uploadResult = await base44.integrations.Core.UploadFile({
        file: file
      });

      if (!uploadResult.file_url) {
        throw new Error('Erro ao fazer upload');
      }

      // Atualizar fotos
      const novasFotos = [...fotos];
      novasFotos[index] = {
        local: LOCAIS_OBRIGATORIOS[index].id,
        arquivo_url: uploadResult.file_url,
        legenda: `${LOCAIS_OBRIGATORIOS[index].label}`
      };
      onFotosChange(novasFotos);

      toast.success('Foto enviada!');
    } catch (error) {
      toast.error(`Erro ao enviar foto: ${error.message}`);
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoverFoto = (index) => {
    const novasFotos = fotos.filter((_, i) => i !== index);
    onFotosChange(novasFotos);
  };

  // Verificar locais obrigatórios preenchidos
  const fotosPreenchidas = fotos.filter((f) => f.arquivo_url).length;
  const todosLocaisCobertos = LOCAIS_OBRIGATORIOS.every((local) =>
    fotos.some((f) => f.local === local.id && f.arquivo_url)
  );

  return (
    <Card className="border-gray-700 bg-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          Fotos Obrigatórias (mín. 4)
          {todosLocaisCobertos ? (
            <Badge className="bg-green-900/30 text-green-400 border-0 gap-1">
              <CheckCircle className="w-3 h-3" />
              Completo
            </Badge>
          ) : (
            <Badge className="bg-red-900/30 text-red-400 border-0 gap-1">
              <AlertTriangle className="w-3 h-3" />
              Incompleto
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Grid de uploads */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LOCAIS_OBRIGATORIOS.map((local, idx) => {
            const fotoExistente = fotos.find((f) => f.local === local.id);
            const isUploading = uploadingIndex === idx;

            return (
              <div
                key={local.id}
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                  fotoExistente
                    ? 'border-green-700/50 bg-green-900/10'
                    : 'border-gray-600 bg-gray-700/10 hover:bg-gray-700/20'
                }`}
              >
                {fotoExistente ? (
                  <div className="space-y-3">
                    <div className="w-full h-24 bg-gray-700 rounded overflow-hidden flex items-center justify-center">
                      <img
                        src={fotoExistente.arquivo_url}
                        alt={local.label}
                        className="h-full object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadFoto(e, idx)}
                          className="hidden"
                          disabled={isUploading}
                        />
                        <Button
                          asChild
                          variant="outline"
                          className="w-full border-gray-600 text-gray-300 text-xs cursor-pointer"
                          disabled={isUploading}
                        >
                          <span>Trocar</span>
                        </Button>
                      </label>
                      <Button
                        onClick={() => handleRemoverFoto(idx)}
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
                      accept="image/*"
                      onChange={(e) => handleUploadFoto(e, idx)}
                      className="hidden"
                      disabled={isUploading}
                    />
                    <Button
                      asChild
                      variant="ghost"
                      className="w-full cursor-pointer h-32 flex flex-col items-center justify-center gap-2"
                      disabled={isUploading}
                    >
                      <div>
                        <Upload className="w-6 h-6 text-gray-500" />
                        <div className="text-xs text-gray-400 mt-1">{local.label}</div>
                        {isUploading && <div className="text-xs text-blue-400">Enviando...</div>}
                      </div>
                    </Button>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {/* Status */}
        <div className="bg-gray-700/20 rounded p-3 text-sm space-y-2">
          <p className="text-gray-300">
            <strong>{fotosPreenchidas}/4</strong> fotos obrigatórias enviadas
          </p>
          {!todosLocaisCobertos && (
            <p className="text-yellow-300 text-xs">
              Faltam fotos dos locais: {LOCAIS_OBRIGATORIOS.filter(
                (l) => !fotos.find((f) => f.local === l.id && f.arquivo_url)
              )
                .map((l) => l.label)
                .join(', ')}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}