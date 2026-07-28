import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, MessageSquare, Paperclip, X, Upload, File } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ComentariosAnexos({ 
  comentarios = [], 
  anexos = [], 
  onComentariosChange,
  onAnexosChange,
  disabled = false
}) {
  const [novoComentario, setNovoComentario] = useState('');
  const [uploading, setUploading] = useState(false);

  const adicionarComentario = async () => {
    if (!novoComentario.trim()) return;
    
    try {
      const user = await base44.auth.me();
      const comentario = {
        texto: novoComentario,
        usuario: user.email,
        data: new Date().toISOString()
      };
      onComentariosChange([...comentarios, comentario]);
      setNovoComentario('');
      toast.success('Comentário adicionado');
    } catch (error) {
      toast.error('Erro ao adicionar comentário');
    }
  };

  const removerComentario = (index) => {
    onComentariosChange(comentarios.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const user = await base44.auth.me();
      const novosAnexos = [];

      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        novosAnexos.push({
          nome: file.name,
          url: file_url,
          tipo: file.type,
          tamanho: file.size,
          data_upload: new Date().toISOString(),
          usuario: user.email
        });
      }

      onAnexosChange([...anexos, ...novosAnexos]);
      toast.success(`${novosAnexos.length} arquivo(s) enviado(s)`);
    } catch (error) {
      toast.error('Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const removerAnexo = (index) => {
    onAnexosChange(anexos.filter((_, i) => i !== index));
  };

  const formatarTamanho = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="space-y-6">
      {/* Comentários */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Comentários
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!disabled && (
            <div className="space-y-2">
              <Textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder="Adicione um comentário..."
                className="bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={adicionarComentario}
                  disabled={!novoComentario.trim()}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Comentário
                </Button>
              </div>
            </div>
          )}

          {comentarios.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum comentário adicionado</p>
          ) : (
            <div className="space-y-3">
              {comentarios.map((comentario, index) => (
                <div key={index} className="p-4 bg-gray-800 rounded-xl border border-gray-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-white font-medium text-sm">{comentario.usuario}</span>
                        <span className="text-gray-500 text-xs">
                          {new Date(comentario.data).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm whitespace-pre-wrap">{comentario.texto}</p>
                    </div>
                    {!disabled && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removerComentario(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anexos */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5" />
            Anexos ({anexos.length})
          </CardTitle>
          {!disabled && (
            <label>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button
                size="sm"
                disabled={uploading}
                className="bg-purple-500 hover:bg-purple-600 text-white"
                asChild
              >
                <span>
                  {uploading ? (
                    <>Enviando...</>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Adicionar Arquivo
                    </>
                  )}
                </span>
              </Button>
            </label>
          )}
        </CardHeader>
        <CardContent>
          {anexos.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">Nenhum arquivo anexado</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {anexos.map((anexo, index) => {
                const isImage = anexo.tipo?.startsWith('image/');
                return (
                  <div key={index} className="p-4 bg-gray-800 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors">
                    <div className="flex items-start gap-3">
                      {isImage ? (
                        <img 
                          src={anexo.url} 
                          alt={anexo.nome}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center">
                          <File className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a 
                          href={anexo.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-white hover:text-blue-400 text-sm font-medium block truncate"
                        >
                          {anexo.nome}
                        </a>
                        <p className="text-gray-500 text-xs mt-1">
                          {formatarTamanho(anexo.tamanho)} • {new Date(anexo.data_upload).toLocaleDateString('pt-BR')}
                        </p>
                        {anexo.usuario && (
                          <p className="text-gray-500 text-xs">Por {anexo.usuario}</p>
                        )}
                      </div>
                      {!disabled && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removerAnexo(index)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}