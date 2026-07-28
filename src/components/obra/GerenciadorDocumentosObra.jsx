import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, FileText, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS_DOCUMENTO = {
  CONTRATO: { label: 'Contrato', color: 'bg-blue-100 text-blue-800' },
  ADITIVO: { label: 'Aditivo', color: 'bg-green-100 text-green-800' },
  ART: { label: 'ART', color: 'bg-yellow-100 text-yellow-800' },
  PROJETO: { label: 'Projeto', color: 'bg-purple-100 text-purple-800' },
  OUTRO: { label: 'Outro', color: 'bg-gray-100 text-gray-800' }
};

export default function GerenciadorDocumentosObra({ obraId, user }) {
  const [filtroTipo, setFiltroTipo] = useState('');
  const [uploadando, setUploadando] = useState(false);
  const queryClient = useQueryClient();

  // Listar documentos da obra
  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['obra-documentos', obraId],
    queryFn: () => base44.entities.ObraDocumento.filter({ obra_id: obraId }),
    enabled: !!obraId
  });

  const documentosFiltrados = filtroTipo
    ? documentos.filter(doc => doc.tipo_documento === filtroTipo && doc.status === 'ativo')
    : documentos.filter(doc => doc.status === 'ativo');

  // Upload de arquivo
  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploadando(true);
      try {
        const res = await base44.integrations.Core.UploadFile({ file });
        return res.file_url;
      } finally {
        setUploadando(false);
      }
    }
  });

  // Criar documento
  const criarDocumento = useMutation({
    mutationFn: async (dados) => {
      return base44.entities.ObraDocumento.create({
        ...dados,
        obra_id: obraId,
        data_upload: new Date().toISOString(),
        enviado_por: user?.email
      });
    },
    onSuccess: () => {
      toast.success('Documento anexado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['obra-documentos', obraId] });
    },
    onError: (error) => {
      toast.error('Erro ao anexar: ' + error.message);
    }
  });

  // Remover documento
  const removerDocumento = useMutation({
    mutationFn: async (docId) => {
      return base44.entities.ObraDocumento.update(docId, { status: 'arquivado' });
    },
    onSuccess: () => {
      toast.success('Documento removido');
      queryClient.invalidateQueries({ queryKey: ['obra-documentos', obraId] });
    },
    onError: (error) => {
      toast.error('Erro ao remover: ' + error.message);
    }
  });

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const tipo = prompt('Tipo de documento:\n1 = CONTRATO\n2 = ADITIVO\n3 = ART\n4 = PROJETO\n5 = OUTRO');
    const tipoMap = { '1': 'CONTRATO', '2': 'ADITIVO', '3': 'ART', '4': 'PROJETO', '5': 'OUTRO' };
    const tipoSelecionado = tipoMap[tipo];

    if (!tipoSelecionado) {
      toast.error('Tipo inválido');
      return;
    }

    // Validar PDF para CONTRATO
    if (tipoSelecionado === 'CONTRATO' && !file.type.includes('pdf')) {
      toast.error('Contratos devem ser PDF');
      return;
    }

    const titulo = prompt('Título do documento:');
    if (!titulo) return;

    try {
      const fileUrl = await uploadMutation.mutateAsync(file);
      await criarDocumento.mutateAsync({
        tipo_documento: tipoSelecionado,
        titulo,
        arquivo_url: fileUrl,
        arquivo_nome: file.name,
        arquivo_tamanho_kb: Math.round(file.size / 1024)
      });
    } catch (error) {
      toast.error('Erro no upload: ' + error.message);
    }

    e.target.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documentos da Obra
          </CardTitle>
          <label>
            <Button
              variant="default"
              size="sm"
              disabled={uploadando || criarDocumento.isPending}
              className="cursor-pointer"
              asChild
            >
              <div>
                {uploadando || criarDocumento.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-1" />
                    Enviar Documento
                  </>
                )}
                <input
                  type="file"
                  onChange={handleFileSelect}
                  disabled={uploadando || criarDocumento.isPending}
                  className="hidden"
                />
              </div>
            </Button>
          </label>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtro */}
        {documentosFiltrados.length > 0 && (
          <div className="flex gap-2 flex-wrap items-center">
            <Filter className="w-4 h-4 text-gray-500" />
            <button
              onClick={() => setFiltroTipo('')}
              className={`px-3 py-1 rounded text-sm ${
                !filtroTipo ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Todos
            </button>
            {Object.entries(TIPOS_DOCUMENTO).map(([tipo, info]) => (
              <button
                key={tipo}
                onClick={() => setFiltroTipo(tipo)}
                className={`px-3 py-1 rounded text-sm ${
                  filtroTipo === tipo ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>
        )}

        {/* Lista de Documentos */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
          </div>
        ) : documentosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum documento anexado</p>
            <p className="text-sm">Clique em "Enviar Documento" para começar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documentosFiltrados.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{doc.titulo}</p>
                      <p className="text-xs text-gray-500">{doc.arquivo_nome} ({doc.arquivo_tamanho_kb}KB)</p>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge className={TIPOS_DOCUMENTO[doc.tipo_documento]?.color}>
                      {TIPOS_DOCUMENTO[doc.tipo_documento]?.label}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(doc.data_upload).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 ml-3 flex-shrink-0">
                  <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" title="Baixar arquivo">
                      <Download className="w-4 h-4" />
                    </Button>
                  </a>
                  {user?.role === 'admin' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removerDocumento.mutate(doc.id)}
                      disabled={removerDocumento.isPending}
                      className="text-red-600 hover:bg-red-50"
                      title="Remover documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}