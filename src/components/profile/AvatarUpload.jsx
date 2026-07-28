import React, { useState, useRef } from 'react';
import { Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function AvatarUpload({ user, onAvatarUpdated }) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Tipo de arquivo inválido. Use JPG, PNG ou WebP.');
      return;
    }

    // Validar tamanho
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2MB.');
      return;
    }

    // Criar preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error('Selecione uma imagem');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const appId = import.meta.env.VITE_APP_ID;
      const response = await fetch(
        `/api/apps/${appId}/functions/uploadAvatar`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      
      toast.success('Avatar atualizado com sucesso!');
      setPreview(null);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      if (onAvatarUpdated) {
        onAvatarUpdated(result.avatar_url);
      }

      // Recarregar para refletir mudanças
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Erro ao fazer upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      const appId = import.meta.env.VITE_APP_ID;
      const response = await fetch(
        `/api/apps/${appId}/functions/removeAvatar`,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Remove failed');
      }

      toast.success('Avatar removido com sucesso!');
      setPreview(null);

      if (onAvatarUpdated) {
        onAvatarUpdated(null);
      }

      // Recarregar para refletir mudanças
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Remove error:', error);
      toast.error(error.message || 'Erro ao remover avatar');
    } finally {
      setRemoving(false);
    }
  };

  const getInitials = () => {
    if (!user?.full_name) return '?';
    return user.full_name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Foto de Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Atual */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="flex-shrink-0">
            <div className="relative">
              {user?.avatar_url ? (
                <img
                  src={`${user.avatar_url}?v=${Date.now()}`}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-blue-600"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-600">{getInitials()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Preview ou Info */}
          <div className="flex-1">
            {preview ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-600">Prévia:</p>
                <img
                  src={preview}
                  alt="Preview"
                  className="w-32 h-32 rounded-lg object-cover border border-gray-300"
                />
                <p className="text-xs text-gray-500">
                  Clique em "Salvar" para confirmar a alteração
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {user?.avatar_url ? 'Altere sua foto clicando em "Escolher arquivo"' : 'Faça upload de uma foto de perfil'}
                </p>
                <p className="text-xs text-gray-500">
                  Formatos aceitos: JPG, PNG, WebP • Tamanho máximo: 2MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Input File (Escondido) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Botões */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Escolher Arquivo
          </Button>

          {preview && (
            <Button
              onClick={handleUpload}
              disabled={uploading || removing}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {uploading ? 'Salvando...' : 'Salvar'}
            </Button>
          )}

          {user?.avatar_url && !preview && (
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="gap-2"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {removing ? 'Removendo...' : 'Remover Foto'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}