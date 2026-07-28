import React, { useState, useRef } from 'react';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Upload, Download, Trash2, FileText, Search, Loader2, File,
  FileImage, FileSpreadsheet, Eye, X, FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIAS = [
  { id: 'contrato',    label: 'Contratos',      color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'laudo',       label: 'Laudos',          color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { id: 'planta',      label: 'Plantas',         color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'orcamento',   label: 'Orçamentos',      color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'medicao',     label: 'Medições',        color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  { id: 'nota_fiscal', label: 'Notas Fiscais',   color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { id: 'foto',        label: 'Fotos',           color: 'bg-pink-100 text-pink-800 border-pink-200' },
  { id: 'relatorio',   label: 'Relatórios',      color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { id: 'outro',       label: 'Outros',          color: 'bg-gray-100 text-gray-800 border-gray-200' },
];

function getFileIcon(nome, tipo) {
  const ext = (nome || '').split('.').pop()?.toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext) || (tipo || '').startsWith('image/'))
    return <FileImage className="w-5 h-5 text-pink-500 flex-shrink-0" />;
  if (['xlsx','xls','csv'].includes(ext))
    return <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />;
  if (['pdf'].includes(ext))
    return <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />;
  return <File className="w-5 h-5 text-gray-400 flex-shrink-0" />;
}

function formatBytes(kb) {
  if (!kb) return '';
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export default function SecaoDocumentos({ obraId, obra, user }) {
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [busca, setBusca] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [form, setForm] = useState({ titulo: '', categoria: '', descricao: '' });
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [errosDoc, setErrosDoc] = useState({});
  const fileInputRef = useRef();
  const setCampoDoc = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrosDoc((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };
  const queryClient = useQueryClient();

  const PERFIS_EDIT = ['admin', 'programador', 'engenharia', 'engenheiro', 'diretoria', 'supervisor', 'encarregado', 'gestor', 'mestre', 'mestre_obra', 'mestre_de_obra', 'owner', 'superadmin'];
  const canEdit = !user || PERFIS_EDIT.includes(user?.role) || PERFIS_EDIT.includes(user?.perfil_acesso);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['obra-documentos-v2', obraId],
    queryFn: () => base44.entities.ObraDocumento.filter({ obra_id: obraId }),
    enabled: !!obraId,
  });

  const ativos = documentos.filter(d => d.status !== 'arquivado');

  const filtrados = ativos.filter(d => {
    const matchCat = !filtroCategoria || d.categoria === filtroCategoria || d.tipo_documento === filtroCategoria;
    const matchBusca = !busca || (d.titulo || '').toLowerCase().includes(busca.toLowerCase()) ||
      (d.arquivo_nome || '').toLowerCase().includes(busca.toLowerCase());
    return matchCat && matchBusca;
  });

  const excluirMutation = useMutation({
    mutationFn: (id) => base44.entities.ObraDocumento.update(id, { status: 'arquivado' }),
    onSuccess: () => {
      toast.success('Documento removido');
      queryClient.invalidateQueries({ queryKey: ['obra-documentos-v2', obraId] });
    },
    onError: (e) => toast.error('Erro ao remover: ' + (e?.response?.data?.error || e.message)),
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivoSelecionado(file);
    setErrosDoc((er) => (er.arquivo ? { ...er, arquivo: undefined } : er));
    if (!form.titulo) setForm(f => ({ ...f, titulo: file.name.replace(/\.[^.]+$/, '') }));
    // Auto-detectar categoria por extensão
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['jpg','jpeg','png','gif','webp'].includes(ext) && !form.categoria) {
      setForm(f => ({ ...f, categoria: 'foto' }));
    } else if (['pdf'].includes(ext) && !form.categoria) {
      setForm(f => ({ ...f, categoria: 'relatorio' }));
    } else if (['xlsx','xls','csv'].includes(ext) && !form.categoria) {
      setForm(f => ({ ...f, categoria: 'orcamento' }));
    }
  };

  const handleSubmit = async () => {
    const e = {};
    if (!arquivoSelecionado) e.arquivo = 'Selecione um arquivo.';
    if (!form.titulo.trim()) e.titulo = 'Informe o título.';
    if (!form.categoria) e.categoria = 'Selecione a categoria.';
    if (Object.keys(e).length) { setErrosDoc(e); toast.error('Verifique os campos destacados.'); return; }
    setErrosDoc({});

    setUploadando(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: arquivoSelecionado });
      await base44.entities.ObraDocumento.create({
        obra_id: obraId,
        titulo: form.titulo.trim(),
        descricao: form.descricao || undefined,
        categoria: form.categoria,
        tipo_documento: form.categoria.toUpperCase(),
        arquivo_url: file_url,
        arquivo_nome: arquivoSelecionado.name,
        arquivo_tamanho_kb: Math.round(arquivoSelecionado.size / 1024),
        data_upload: new Date().toISOString(),
        enviado_por: user?.email,
        status: 'ativo',
      });
      toast.success('Documento enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['obra-documentos-v2', obraId] });
      setModalOpen(false);
      setForm({ titulo: '', categoria: '', descricao: '' });
      setErrosDoc({});
      setArquivoSelecionado(null);
    } catch (e) {
      toast.error('Erro no upload: ' + (e?.response?.data?.error || e.message));
    } finally {
      setUploadando(false);
    }
  };

  // Contar por categoria
  const countByCategoria = {};
  ativos.forEach(d => {
    const cat = d.categoria || d.tipo_documento?.toLowerCase() || 'outro';
    countByCategoria[cat] = (countByCategoria[cat] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Documentos</h2>
          <p className="text-gray-500 text-sm hidden sm:block">{ativos.length} documento{ativos.length !== 1 ? 's' : ''} anexado{ativos.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span className="sm:hidden">Enviar</span>
            <span className="hidden sm:inline">Enviar Documento</span>
          </Button>
        )}
      </div>

      {/* Filtros por categoria */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroCategoria('')}
          className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
            !filtroCategoria ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-100'
          }`}
        >
          Todos ({ativos.length})
        </button>
        {CATEGORIAS.filter(cat => countByCategoria[cat.id] > 0).map(cat => (
          <button
            key={cat.id}
            onClick={() => setFiltroCategoria(cat.id)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filtroCategoria === cat.id ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-600 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {cat.label} ({countByCategoria[cat.id]})
          </button>
        ))}
      </div>

      {/* Barra de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar documentos..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="pl-9 bg-white border-gray-300 text-gray-900 placeholder:text-gray-400"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {/* Lista de documentos */}
      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : filtrados.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderOpen className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">
              {busca || filtroCategoria ? 'Nenhum documento encontrado' : 'Nenhum documento enviado'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {canEdit && !busca && !filtroCategoria ? 'Clique em "Enviar Documento" para começar' : ''}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtrados.map(doc => {
            const cat = CATEGORIAS.find(c => c.id === doc.categoria || c.id === doc.tipo_documento?.toLowerCase());
            return (
              <Card key={doc.id} className="bg-white border-gray-200 hover:border-gray-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {getFileIcon(doc.arquivo_nome, doc.arquivo_tipo)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-gray-900 font-medium truncate">{doc.titulo}</p>
                          <p className="text-gray-500 text-xs truncate mt-0.5">
                            {doc.arquivo_nome} {doc.arquivo_tamanho_kb ? `• ${formatBytes(doc.arquivo_tamanho_kb)}` : ''}
                          </p>
                          {doc.descricao && (
                            <p className="text-gray-600 text-xs mt-1 line-clamp-2">{doc.descricao}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900" title="Visualizar / Baixar">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </a>
                          <a href={doc.arquivo_url} download={doc.arquivo_nome} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-gray-900" title="Download">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                          {canEdit && (
                            <Button
                              variant="ghost" size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-600"
                              onClick={() => excluirMutation.mutate(doc.id)}
                              disabled={excluirMutation.isPending}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {cat && (
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${cat.color}`}>
                            {cat.label}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {doc.data_upload ? new Date(doc.data_upload).toLocaleDateString('pt-BR') : ''}
                        </span>
                        {doc.enviado_por && (
                          <span className="text-xs text-gray-400 truncate">• {doc.enviado_por}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Upload */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!uploadando) setModalOpen(v); }}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Enviar Documento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Área de drop/seleção */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors ${errosDoc.arquivo ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="*/*"
              />
              {arquivoSelecionado ? (
                <div className="flex items-center justify-center gap-2">
                  {getFileIcon(arquivoSelecionado.name, arquivoSelecionado.type)}
                  <span className="text-sm text-gray-900 truncate max-w-[200px]">{arquivoSelecionado.name}</span>
                  <button onClick={e => { e.stopPropagation(); setArquivoSelecionado(null); }}>
                    <X className="w-4 h-4 text-gray-400 hover:text-red-600" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Clique para selecionar ou arraste um arquivo</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, Excel, Word, Imagens, etc.</p>
                </>
              )}
            </div>
            {errosDoc.arquivo && <p className="text-xs text-red-600">{errosDoc.arquivo}</p>}

            {/* Título */}
            <div className="space-y-1.5">
              <Label className="text-gray-700">Título *</Label>
              <Input
                value={form.titulo}
                onChange={e => setCampoDoc('titulo', e.target.value)}
                placeholder="Ex: Contrato de execução - Rev.01"
                className={`bg-white border-gray-300 text-gray-900 ${errosDoc.titulo ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errosDoc.titulo && <p className="text-xs text-red-600">{errosDoc.titulo}</p>}
            </div>

            {/* Categoria */}
            <div className="space-y-1.5">
              <Label className="text-gray-700">Categoria *</Label>
              <Select value={form.categoria} onValueChange={v => setCampoDoc('categoria', v)}>
                <SelectTrigger className={`bg-white border-gray-300 text-gray-900 ${errosDoc.categoria ? 'border-red-400 focus-visible:ring-red-400' : ''}`}>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errosDoc.categoria && <p className="text-xs text-red-600">{errosDoc.categoria}</p>}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-gray-700">Descrição <span className="text-gray-400">(opcional)</span></Label>
              <Input
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Breve descrição do documento"
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={uploadando}
              className="border-gray-300 text-gray-700">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={uploadando}
              className="bg-blue-600 hover:bg-blue-700 gap-2">
              {uploadando ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              ) : (
                <><Upload className="w-4 h-4" /> Enviar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
