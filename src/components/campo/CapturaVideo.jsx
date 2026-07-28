import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Video, Upload, Loader2, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function CapturaVideo({ onVideoUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [videos, setVideos] = useState([]);

  const handleVideoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    
    for (const file of files) {
      // Validar tamanho (máx 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`Vídeo "${file.name}" muito grande. Máximo 50MB.`);
        continue;
      }

      // Validar tipo
      if (!file.type.startsWith('video/')) {
        toast.error(`"${file.name}" não é um vídeo válido`);
        continue;
      }

      setUploading(true);
      try {
        const response = await base44.integrations.Core.UploadFile({ file });
        const videoInfo = {
          url: response.file_url,
          nome: file.name,
          tamanho: file.size
        };
        
        setVideos(prev => [...prev, videoInfo]);
        toast.success(`Vídeo "${file.name}" enviado!`);
        
        if (onVideoUploaded) {
          onVideoUploaded(videoInfo);
        }
      } catch (error) {
        toast.error(`Erro ao enviar "${file.name}"`);
        console.error(error);
      } finally {
        setUploading(false);
      }
    }
    
    // Limpar input
    e.target.value = '';
  };

  const removerVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-gray-400">Vídeos (máx 50MB cada)</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            type="file"
            accept="video/*"
            multiple
            onChange={handleVideoUpload}
            disabled={uploading}
            className="bg-gray-800 border-gray-700 text-white"
          />
          {uploading && (
            <Button disabled className="bg-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
            </Button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Formatos aceitos: MP4, MOV, AVI, WebM
        </p>
      </div>

      {videos.length > 0 && (
        <div className="space-y-2">
          {videos.map((video, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2 flex-1">
                <Video className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <p className="text-white text-sm">{video.nome}</p>
                  <p className="text-gray-500 text-xs">
                    {(video.tamanho / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Enviado
                </Badge>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removerVideo(idx)}
                className="text-red-400 hover:bg-red-500/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}