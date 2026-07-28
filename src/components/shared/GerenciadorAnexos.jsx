import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Download, Eye, Trash2, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

const TIPOS_ARQUIVO_PERMITIDOS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'jpg', 'jpeg', 'png', 'gif'];
const TAMANHO_MAXIMO_MB = 10;

export default function GerenciadorAnexos({ 
  entidadeId, 
  tipoEntidade, 
  podeEditar = true,
  userRole = 'user'
}) {
  const [descricao, setDescricao] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const queryClient = useQueryClient();

  // Determinar nome da entidade e campo ID
  const entidadeConfig = {
    contrato: { entidade: 'AnexoContrato', campoId: 'contrato_id' },
    medicao: { entidade: 'AnexoMedicao', campoId: 'medicao_id' }
  };

  const config = entidadeConfig[tipoEntidade];

  // Buscar anexos
  const { data: anexos = [] } = useQuery({
    queryKey: ['anexos', tipoEntidade, entidadeId],
    queryFn: async () => {
      if (!entidadeId) return [];
      const filtro = { [config.campoId]: entidadeId };
      return await base44.entities[config.entidade].filter(filtro) || [];
    },
    enabled: !!entidadeId
  });

  // Upload de arquivo
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      if (!file) throw new Error('Selecione um arquivo');
      if (file.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
        throw new Error(`Arquivo deve ter no máximo ${TAMANHO_MAXIMO_MB}MB`);
      }

      // Upload do arquivo
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      const arquivo_url = uploadResponse.file_url;

      // Determinar tipo do arquivo
      const extensao = file.name.split('.').pop().toLowerCase();
      const tipo_arquivo = TIPOS_ARQUIVO_PERMITIDOS.includes(extensao) ? extensao : 'outro';

      // Criar registro de anexo
      const dados = {
        [config.campoId]: entidadeId,
        nome: file.name,
        tipo_arquivo,
        arquivo_url,
        tamanho_kb: Math.round(file.size / 1024),
        descricao,
        enviado_por: (await base44.auth.me()).email,
        visivel_para_roles: ['admin', 'diretoria', 'mestre_obra']
      };

      const resultado = await base44.entities[config.entidade].create(dados);
      return resultado;
    },
    onSuccess: () => {
      toast.success('Anexo enviado com sucesso');
      setDescricao('');
      queryClient.invalidateQueries({ queryKey: ['anexos', tipoEntidade, entidadeId] });
    },
    onError: (error) => {
      toast.error(error.message);
    }
  });

  // Deletar anexo
  const deleteMutation = useMutation({
    mutationFn: async (anexoId) => {
      return await base44.entities[config.entidade].delete(anexoId);
    },
    onSuccess: () => {
      toast.success('Anexo removido');
      queryClient.invalidateQueries({ queryKey: ['anexos', tipoEntidade, entidadeId] });
    },
    onError: (error) => {
      toast.error('Erro ao remover anexo');
    }
  });

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
      e.target.value = '';
    }
  };

  const ehImagem = (tipoArquivo) => ['jpg', 'jpeg', 'png', 'gif'].includes(tipoArquivo);

  return (
    <Card className="border-blue-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Anexos ({anexos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload */}
        {podeEditar && (
          <div className="space-y-2">
            <label className="text-xs font-medium">Adicionar Documento</label>
            <div className="flex gap-2">
              <Input
                type="file"
                onChange={handleUpload}
                disabled={uploadMutation.isPending}
                className="h-8 text-xs"
                accept={TIPOS_ARQUIVO_PERMITIDOS.map(t => `.${t}`).join(',')}
              />
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
            <Input
              type="text"
              placeholder="Descrição (opcional)"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="h-8 text-xs"
              disabled={uploadMutation.isPending}
            />
          </div>
        )}

        {/* Lista de anexos */}
        {anexos.length > 0 ? (
          <div className="space-y-2">
            {anexos.map((anexo) => (
              <div key={anexo.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {ehImagem(anexo.tipo_arquivo) ? (
                    <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{anexo.nome}</p>
                    {anexo.descricao && (
                      <p className="text-xs text-gray-600 truncate">{anexo.descricao}</p>
                    )}
                    <p className="text-xs text-gray-500">
                      {anexo.tamanho_kb}KB • {new Date(anexo.data_upload).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {ehImagem(anexo.tipo_arquivo) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setPreviewUrl(anexo.arquivo_url);
                        setMostrarPreview(true);
                      }}
                      className="h-6 w-6 hover:bg-blue-100"
                      title="Visualizar"
                    >
                      <Eye className="w-3 h-3 text-blue-500" />
                    </Button>
                  )}
                  <a
                    href={anexo.arquivo_url}
                    download
                    className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-green-100"
                    title="Baixar"
                  >
                    <Download className="w-3 h-3 text-green-600" />
                  </a>
                  {podeEditar && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(anexo.id)}
                      disabled={deleteMutation.isPending}
                      className="h-6 w-6 hover:bg-red-100"
                      title="Remover"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">Nenhum anexo adicionado</p>
        )}

        {/* Preview de imagem */}
        <Dialog open={mostrarPreview} onOpenChange={setMostrarPreview}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Visualização</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="w-full h-auto rounded" />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}