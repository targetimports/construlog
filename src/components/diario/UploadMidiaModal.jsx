import React, { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4'
};

const MAX_SIZE_MB = 50; // 50MB
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function UploadMidiaModal({ open, onClose, diarioId }) {
  const [arquivo, setArquivo] = useState(null);
  const [legenda, setLegenda] = useState('');
  const [erro, setErro] = useState('');
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Mutation para upload
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!arquivo) throw new Error('Selecione um arquivo');

      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivo });

      // Detectar tipo (foto ou vídeo)
      const tipo = arquivo.type.startsWith('image') ? 'FOTO' : 'VIDEO';

      // Salvar no banco
      const midia = await base44.entities.DiarioObraMidia.create({
        diario_id: diarioId,
        tipo,
        arquivo_url: file_url,
        legenda: legenda || null
      });

      return midia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diario-midias', diarioId] });
      toast.success('Mídia adicionada com sucesso');
      handleFechar();
    },
    onError: (err) => {
      setErro(err.message || 'Erro ao fazer upload');
      toast.error('Erro ao fazer upload');
    }
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErro('');

    // Validar tipo
    if (!ALLOWED_TYPES[file.type]) {
      setErro('Apenas JPG, PNG e MP4 são permitidos');
      return;
    }

    // Validar tamanho
    if (file.size > MAX_SIZE_BYTES) {
      setErro(`Tamanho máximo é ${MAX_SIZE_MB}MB`);
      return;
    }

    setArquivo(file);
  };

  const handleFechar = () => {
    setArquivo(null);
    setLegenda('');
    setErro('');
    onClose();
  };

  const handleUpload = () => {
    uploadMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="bg-white border-gray-200 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-gray-900">Adicionar Evidência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Seletor de arquivo */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.mp4"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-gray-400 transition-colors text-center"
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
              <p className="text-sm text-gray-700">
                {arquivo ? arquivo.name : 'Clique para selecionar arquivo'}
              </p>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, MP4 até {MAX_SIZE_MB}MB</p>
            </button>
          </div>

          {/* Legenda */}
          {arquivo && (
            <div>
              <label className="text-sm text-gray-700 mb-1 block">
                Legenda (opcional)
              </label>
              <Input
                type="text"
                placeholder="Descreva a evidência..."
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                disabled={uploadMutation.isPending}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded flex gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{erro}</p>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-gray-500">
            {arquivo ? `${arquivo.type.startsWith('image') ? 'Foto' : 'Vídeo'} selecionado` : ''}
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleFechar}
            disabled={uploadMutation.isPending}
            className="border-gray-300 text-gray-700"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!arquivo || uploadMutation.isPending}
            className="bg-gray-900 hover:bg-gray-800"
          >
            {uploadMutation.isPending ? 'Enviando...' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}