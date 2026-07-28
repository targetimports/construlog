import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { MessageSquare, Paperclip, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ComentariosAnexosContrato({ medicaoId }) {
  const [comentario, setComentario] = useState('');
  const [uploadando, setUploadando] = useState(false);
  const queryClient = useQueryClient();

  const { data: comentarios = [] } = useQuery({
    queryKey: ['comentarios', medicaoId],
    queryFn: async () => {
      const items = await base44.entities.ItemMedicao?.filter?.({ id: medicaoId });
      return items?.[0]?.comentarios || [];
    }
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos', medicaoId],
    queryFn: async () => {
      const items = await base44.entities.ItemMedicao?.filter?.({ id: medicaoId });
      return items?.[0]?.anexos || [];
    }
  });

  const adicionarComentarioMutation = useMutation({
    mutationFn: async (texto) => {
      const items = await base44.entities.ItemMedicao?.filter?.({ id: medicaoId });
      const medicao = items?.[0];
      
      const novoComentario = {
        texto,
        usuario: (await base44.auth.me()).full_name,
        data: new Date().toISOString()
      };

      const comentariosAtualizados = [...(medicao?.comentarios || []), novoComentario];
      
      return base44.entities.ItemMedicao?.update?.(medicaoId, {
        comentarios: comentariosAtualizados
      });
    },
    onSuccess: () => {
      toast.success('Comentário adicionado');
      setComentario('');
      queryClient.invalidateQueries({ queryKey: ['comentarios', medicaoId] });
    }
  });

  const uploadAnexoMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const items = await base44.entities.ItemMedicao?.filter?.({ id: medicaoId });
      const medicao = items?.[0];
      
      const novoAnexo = {
        nome: file.name,
        url: file_url,
        tipo: file.type,
        tamanho: file.size,
        data_upload: new Date().toISOString(),
        usuario: (await base44.auth.me()).full_name
      };

      const anexosAtualizados = [...(medicao?.anexos || []), novoAnexo];
      
      return base44.entities.ItemMedicao?.update?.(medicaoId, {
        anexos: anexosAtualizados
      });
    },
    onSuccess: () => {
      toast.success('Arquivo anexado');
      setUploadando(false);
      queryClient.invalidateQueries({ queryKey: ['anexos', medicaoId] });
    }
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadando(true);
      uploadAnexoMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-4">
      {/* Comentários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Comentários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Lista */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {comentarios.map((com, idx) => (
              <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                <p className="font-medium text-gray-800">{com.usuario}</p>
                <p className="text-gray-600 mb-1">{com.texto}</p>
                <p className="text-gray-400 text-xs">
                  {new Date(com.data).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar comentário..."
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  adicionarComentarioMutation.mutate(comentario);
                }
              }}
              className="text-sm h-8"
            />
            <Button
              size="sm"
              onClick={() => adicionarComentarioMutation.mutate(comentario)}
              disabled={!comentario.trim() || adicionarComentarioMutation.isPending}
              className="gap-1"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Paperclip className="w-4 h-4" />
            Anexos ({anexos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="space-y-1">
            {anexos.map((anexo, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                <div className="flex-1">
                  <a href={anexo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
                    {anexo.nome}
                  </a>
                  <p className="text-gray-500">{anexo.usuario} - {new Date(anexo.data_upload).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload */}
          <label className="block">
            <input
              type="file"
              onChange={handleUpload}
              disabled={uploadando}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploadando}
              className="w-full gap-1 text-xs"
              onClick={() => document.querySelector('input[type="file"]').click()}
            >
              <Paperclip className="w-3 h-3" />
              {uploadando ? 'Enviando...' : 'Adicionar Arquivo'}
            </Button>
          </label>
        </CardContent>
      </Card>
    </div>
  );
}