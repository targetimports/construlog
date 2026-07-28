import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, FolderPlus, FileUp, Clock, History, ChevronRight } from 'lucide-react';

export default function GestorDocumentosObra({ obra_id, fase_id }) {
  const [pastaAberta, setPastaAberta] = useState(null);
  const [termoBusca, setTermoBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroTags, setFiltroTags] = useState('');
  const [docSelecionado, setDocSelecionado] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const queryClient = useQueryClient();

  // Buscar pastas
  const { data: pastas } = useQuery({
    queryKey: ['pastas', fase_id],
    queryFn: () => base44.entities.PastaDocumentos.filter({ fase_id, pasta_pai_id: pastaAberta }),
    enabled: !!fase_id
  });

  // Buscar documentos
  const { data: documentos } = useQuery({
    queryKey: ['documentos', fase_id, pastaAberta],
    queryFn: () => base44.entities.DocumentoObra.filter({ 
      fase_id,
      pasta_id: pastaAberta 
    }),
    enabled: !!fase_id
  });

  // Busca avançada
  const { mutate: buscar, data: resultadosBusca } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('buscarDocumentosAvancada', {
        obra_id,
        termo_busca: termoBusca,
        tipo: filtroTipo || undefined,
        tags: filtroTags ? filtroTags.split(',').map(t => t.trim()) : undefined
      });
      return response.data;
    }
  });

  // Versões
  const { data: versoes, mutate: carregarVersoes } = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('gerenciarVersaoDocumento', {
        acao: 'listar_versoes',
        documento_id: docSelecionado.id
      });
      return response.data;
    }
  });

  // Upload arquivo
  const { mutate: uploadDocumento, isLoading: uploading } = useMutation({
    mutationFn: async (file) => {
      const uploadResponse = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.DocumentoObra.create({
        obra_id,
        fase_id,
        pasta_id: pastaAberta,
        nome: file.name,
        tipo: file.type.includes('pdf') ? 'planta' : file.type.includes('image') ? 'foto' : 'outro',
        arquivo_url: uploadResponse.file_url,
        tamanho_bytes: file.size,
        criado_por: (await base44.auth.me()).email
      });

      await base44.entities.LogDocumento.create({
        documento_id: undefined,
        obra_id,
        acao: 'criado',
        detalhes: `Documento ${file.name} criado`,
        usuario_email: (await base44.auth.me()).email,
        data_acao: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos'] });
      setShowUpload(false);
    }
  });

  // Criar pasta
  const { mutate: criarPasta } = useMutation({
    mutationFn: (nome) =>
      base44.entities.PastaDocumentos.create({
        fase_id,
        obra_id,
        nome,
        pasta_pai_id: pastaAberta,
        nivel: (pastaAberta ? 1 : 0)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pastas'] });
    }
  });

  const docs = resultadosBusca?.resultados || documentos || [];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="explorador" className="w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start md:grid md:grid-cols-3">
          <TabsTrigger value="explorador">Explorador</TabsTrigger>
          <TabsTrigger value="busca">Busca Avançada</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* ABA 1: EXPLORADOR */}
        <TabsContent value="explorador" className="space-y-4 mt-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <button onClick={() => setPastaAberta(null)} className="hover:text-blue-600">
              Raiz
            </button>
            {pastaAberta && (
              <>
                <ChevronRight className="w-4 h-4" />
                <span className="text-gray-900 font-medium">{pastaAberta}</span>
              </>
            )}
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              onClick={() => {
                const nome = prompt('Nome da pasta:');
                if (nome) criarPasta(nome);
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              Nova Pasta
            </Button>
            <Button
              onClick={() => setShowUpload(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FileUp className="w-4 h-4" />
              Upload
            </Button>
          </div>

          {/* Upload */}
          {showUpload && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <label className="block">
                  <input
                    type="file"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        uploadDocumento(e.target.files[0]);
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button className="w-full cursor-pointer" disabled={uploading}>
                    {uploading ? 'Enviando...' : 'Selecione um arquivo'}
                  </Button>
                </label>
              </CardContent>
            </Card>
          )}

          {/* Pastas */}
          {pastas && pastas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-700">Pastas</h3>
              {pastas.map(pasta => (
                <Card key={pasta.id} className="cursor-pointer hover:border-blue-500" onClick={() => setPastaAberta(pasta.id)}>
                  <CardContent className="pt-4">
                    <p className="font-medium text-gray-900">{pasta.nome}</p>
                    <p className="text-xs text-gray-600">{pasta.descricao}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Documentos */}
          {docs.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-700">Documentos</h3>
              {docs.map(doc => (
                <Card
                  key={doc.id}
                  className={`cursor-pointer transition ${docSelecionado?.id === doc.id ? 'border-blue-500 bg-blue-50' : ''}`}
                  onClick={() => {
                    setDocSelecionado(doc);
                    carregarVersoes();
                  }}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{doc.nome}</p>
                        <p className="text-xs text-gray-600 mt-1">v{doc.versao_atual} • {doc.tipo}</p>
                        {doc.tags && doc.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {doc.tags.map((tag, i) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-200 rounded text-xs">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">
                        {new Date(doc.modificado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {docs.length === 0 && pastas?.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              Pasta vazia. Crie uma subpasta ou faça upload de um documento.
            </div>
          )}
        </TabsContent>

        {/* ABA 2: BUSCA */}
        <TabsContent value="busca" className="space-y-4 mt-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Buscar por termo</label>
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Nome, descrição, tags, conteúdo..."
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <Button onClick={() => buscar()} className="gap-2">
                    <Search className="w-4 h-4" />
                    Buscar
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Tipo</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  >
                    <option value="">Todos</option>
                    <option value="planta">Planta</option>
                    <option value="especificacao">Especificação</option>
                    <option value="relatorio">Relatório</option>
                    <option value="contrato">Contrato</option>
                    <option value="foto">Foto</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tags (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={filtroTags}
                    onChange={(e) => setFiltroTags(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                    placeholder="estrutura, fundação"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          {resultadosBusca && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  {resultadosBusca.total_resultados} resultado(s) encontrado(s)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {resultadosBusca.resultados.map(doc => (
                  <Card key={doc.id} className="cursor-pointer" onClick={() => {
                    setDocSelecionado(doc);
                    carregarVersoes();
                  }}>
                    <CardContent className="pt-4">
                      <p className="font-medium text-gray-900">{doc.nome}</p>
                      <p className="text-xs text-gray-600">Fase: {doc.fase_nome} • {doc.tipo}</p>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ABA 3: HISTÓRICO */}
        {docSelecionado && versoes && (
          <TabsContent value="historico" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="w-4 h-4" />
                  {docSelecionado.nome}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Versões */}
                <div>
                  <h4 className="font-bold text-gray-900 mb-2">Versões ({versoes.versoes?.length || 0})</h4>
                  <div className="space-y-2">
                    {versoes.versoes?.map(v => (
                      <Card key={v.id} className="cursor-pointer hover:border-blue-500">
                        <CardContent className="pt-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium text-gray-900">v{v.numero_versao}</p>
                              <p className="text-xs text-gray-600">{v.descricao_mudancas}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                Por {v.criado_por} em {new Date(v.data_criacao).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                            <Button variant="outline" size="sm">
                              Restaurar
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Log de alterações */}
                <div className="border-t pt-4">
                  <h4 className="font-bold text-gray-900 mb-2">Log de Alterações</h4>
                  <div className="space-y-2">
                    {versoes.historico?.slice(0, 10).map((log, i) => (
                      <div key={i} className="flex gap-3 text-sm border-l-2 border-gray-300 pl-3 py-2">
                        <Clock className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{log.acao}</p>
                          <p className="text-xs text-gray-600">{log.detalhes}</p>
                          <p className="text-xs text-gray-500">
                            {log.usuario_email} • {new Date(log.data_acao).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}