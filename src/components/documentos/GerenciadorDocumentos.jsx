import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download, Trash2, FileText, Search, Filter, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

export default function GerenciadorDocumentos({ 
  entityType, // 'contrato', 'medicao-contrato', 'nao-conformidade'
  entityId,
  userRole 
}) {
  const [searchText, setSearchText] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [sortBy, setSortBy] = useState('data-desc');
  const [showFilters, setShowFilters] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [filterRole, setFilterRole] = useState('todos');
  const queryClient = useQueryClient();

  // Map de entidades
  const entityMap = {
    'contrato': { entity: 'DocumentoContrato', idField: 'contrato_id' },
    'medicao-contrato': { entity: 'DocumentoMedicaoContrato', idField: 'medicao_contrato_id' },
    'nao-conformidade': { entity: 'DocumentoNaoConformidade', idField: 'nao_conformidade_id' }
  };

  const config = entityMap[entityType];
  if (!config) return <div>Tipo de entidade inválido</div>;

  // Buscar documentos
  const { data: documentos = [], isLoading } = useQuery({
    queryKey: [config.entity, entityId],
    queryFn: () => base44.entities[config.entity]?.filter({ [config.idField]: entityId }) || [],
    staleTime: 2 * 60 * 1000
  });

  // Deletar documento
  const deleteMutation = useMutation({
    mutationFn: (docId) => base44.entities[config.entity].delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [config.entity, entityId] });
      toast.success('Documento removido');
    }
  });

  // Upload de arquivo
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Upload do arquivo
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Criar registro do documento
      await base44.entities[config.entity].create({
        [config.idField]: entityId,
        titulo: file.name,
        tipo: 'outro',
        arquivo_url: file_url,
        arquivo_nome: file.name,
        arquivo_tamanho_kb: (file.size / 1024).toFixed(2),
        tags: [],
        visivel_para_roles: [userRole]
      });

      queryClient.invalidateQueries({ queryKey: [config.entity, entityId] });
      toast.success('Documento enviado com sucesso');
      e.target.value = '';
    } catch (error) {
      toast.error('Erro ao enviar documento');
      console.error(error);
    }
  };

  // Filtrar e ordenar documentos
  const filtrados = useMemo(() => {
    let resultado = documentos.filter(doc => {
      // Filtro de busca
      const matchesSearch = !searchText || 
        doc.titulo.toLowerCase().includes(searchText.toLowerCase()) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(searchText.toLowerCase()));
      
      // Filtro por tipo
      const matchesTipo = filterTipo === 'todos' || doc.tipo === filterTipo;
      
      // Filtro por data
      let matchesData = true;
      if (dataInicio || dataFim) {
        const docDate = new Date(doc.data_upload);
        if (dataInicio) {
          const inicio = new Date(dataInicio);
          matchesData = matchesData && docDate >= inicio;
        }
        if (dataFim) {
          const fim = new Date(dataFim);
          fim.setHours(23, 59, 59, 999);
          matchesData = matchesData && docDate <= fim;
        }
      }
      
      // Filtro por role
      const matchesRole = filterRole === 'todos' || 
        (doc.visivel_para_roles && doc.visivel_para_roles.includes(filterRole));
      
      return matchesSearch && matchesTipo && matchesData && matchesRole;
    });

    // Ordenar
    resultado.sort((a, b) => {
      switch (sortBy) {
        case 'titulo-asc':
          return a.titulo.localeCompare(b.titulo);
        case 'titulo-desc':
          return b.titulo.localeCompare(a.titulo);
        case 'data-asc':
          return new Date(a.data_upload) - new Date(b.data_upload);
        case 'data-desc':
        default:
          return new Date(b.data_upload) - new Date(a.data_upload);
        case 'tipo':
          return a.tipo.localeCompare(b.tipo);
      }
    });

    return resultado;
  }, [documentos, searchText, filterTipo, dataInicio, dataFim, filterRole, sortBy]);

  if (isLoading) {
    return <Loader2 className="w-6 h-6 animate-spin" />;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Documentos</CardTitle>
          <label className="cursor-pointer">
            <input
              type="file"
              onChange={handleUpload}
              className="hidden"
            />
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="w-4 h-4" /> Upload
              </span>
            </Button>
          </label>
        </div>

        {/* Busca Principal */}
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por título ou tag..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="gap-2"
          >
            <Filter className="w-4 h-4" /> Filtros
          </Button>
        </div>

        {/* Filtros Avançados */}
        {showFilters && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tipo */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Tipo</label>
                <select
                  value={filterTipo}
                  onChange={(e) => setFilterTipo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="todos">Todos os tipos</option>
                  {entityType === 'contrato' && (
                    <>
                      <option value="contrato">Contrato</option>
                      <option value="aditivo">Aditivo</option>
                      <option value="anexo">Anexo</option>
                      <option value="comprovante">Comprovante</option>
                      <option value="termo">Termo</option>
                    </>
                  )}
                  {entityType === 'medicao-contrato' && (
                    <>
                      <option value="medicao">Medição</option>
                      <option value="foto">Foto</option>
                      <option value="laudo">Laudo</option>
                      <option value="planilha">Planilha</option>
                    </>
                  )}
                  {entityType === 'nao-conformidade' && (
                    <>
                      <option value="evidencia">Evidência</option>
                      <option value="correcao">Correção</option>
                      <option value="plano_acao">Plano Ação</option>
                    </>
                  )}
                </select>
              </div>

              {/* Ordenar */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Ordenar por</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="data-desc">Data (Mais recentes)</option>
                  <option value="data-asc">Data (Mais antigos)</option>
                  <option value="titulo-asc">Título (A-Z)</option>
                  <option value="titulo-desc">Título (Z-A)</option>
                  <option value="tipo">Tipo</option>
                </select>
              </div>

              {/* Data Início */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">De</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Data Fim */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Até</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                />
              </div>

              {/* Role */}
              <div>
                <label className="text-xs font-medium text-gray-700 block mb-1">Acesso por Role</label>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                >
                  <option value="todos">Todos</option>
                  <option value="admin">Admin</option>
                  <option value="diretoria">Diretoria</option>
                  <option value="engenharia">Engenharia</option>
                  <option value="qualidade">Qualidade</option>
                  <option value="field">Campo</option>
                </select>
              </div>
            </div>

            {/* Botão Limpar Filtros */}
            {(dataInicio || dataFim || filterTipo !== 'todos' || filterRole !== 'todos' || sortBy !== 'data-desc') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDataInicio('');
                  setDataFim('');
                  setFilterTipo('todos');
                  setFilterRole('todos');
                  setSortBy('data-desc');
                }}
                className="gap-1 text-xs"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </Button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-6">
        {filtrados.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum documento encontrado</p>
            {(searchText || dataInicio || dataFim || filterTipo !== 'todos' || filterRole !== 'todos') && (
              <p className="text-xs mt-2">Tente ajustar os filtros</p>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-3">{filtrados.length} documento(s)</p>
          <div className="space-y-2">
            {filtrados.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{doc.titulo}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.data_upload).toLocaleDateString('pt-BR')} · {doc.arquivo_tamanho_kb} KB
                      </p>
                    </div>
                  </div>
                  {doc.versao > 1 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded mt-1 inline-block">
                      v{doc.versao}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(doc.arquivo_url, '_blank')}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(doc.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          </>
          )}
          </CardContent>
          </Card>
          );
          }