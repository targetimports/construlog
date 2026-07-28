import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { FileText, Upload, Download, Trash2, FolderOpen, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function GestaoDocumentos() {
  const queryClient = useQueryClient();
  const [uploadDialog, setUploadDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [filterObra, setFilterObra] = useState('todas');
  const [uploadData, setUploadData] = useState({
    arquivo: null,
    nome: '',
    categoria: 'contrato',
    obra_id: '',
    descricao: ''
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['arquivos-obra'],
    queryFn: () => base44.entities.ArquivoObra.list('-created_date')
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-list'],
    queryFn: () => base44.entities.Obra.list()
  });

  const uploadMutation = useMutation({
    mutationFn: async (data) => {
      const { data: uploadResult } = await base44.integrations.Core.UploadFile({ file: data.arquivo });
      return base44.entities.ArquivoObra.create({
        nome: data.nome,
        categoria: data.categoria,
        obra_id: data.obra_id,
        descricao: data.descricao,
        arquivo_url: uploadResult.file_url,
        tamanho: data.arquivo.size,
        tipo: data.arquivo.type
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['arquivos-obra']);
      toast.success('Documento enviado!');
      setUploadDialog(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ArquivoObra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['arquivos-obra']);
      toast.success('Documento excluído!');
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadData({ ...uploadData, arquivo: file, nome: file.name });
    }
  };

  const resetForm = () => {
    setUploadData({
      arquivo: null,
      nome: '',
      categoria: 'contrato',
      obra_id: '',
      descricao: ''
    });
  };

  const categorias = [
    { value: 'contrato', label: 'Contratos', icon: '' },
    { value: 'projeto', label: 'Projetos', icon: '' },
    { value: 'medicao', label: 'Medições', icon: '' },
    { value: 'orcamento', label: 'Orçamentos', icon: '' },
    { value: 'nota_fiscal', label: 'Notas Fiscais', icon: '' },
    { value: 'alvara', label: 'Alvarás', icon: '' },
    { value: 'foto', label: 'Fotos', icon: '' },
    { value: 'outro', label: 'Outros', icon: '' }
  ];

  const documentosFiltrados = documentos.filter(doc => {
    const matchSearch = doc.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       doc.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCategoria = filterCategoria === 'todos' || doc.categoria === filterCategoria;
    const matchObra = filterObra === 'todas' || doc.obra_id === filterObra;
    return matchSearch && matchCategoria && matchObra;
  });

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Documentos</h1>
          <p className="text-gray-600 mt-1">Organize e gerencie todos os arquivos do sistema</p>
        </div>
        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Upload className="w-4 h-4" />
              Enviar Documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Enviar Novo Documento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Arquivo</Label>
                <Input
                  type="file"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
              </div>

              <div>
                <Label>Nome do Documento</Label>
                <Input
                  value={uploadData.nome}
                  onChange={(e) => setUploadData({ ...uploadData, nome: e.target.value })}
                  placeholder="Nome descritivo"
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <Select
                  value={uploadData.categoria}
                  onValueChange={(value) => setUploadData({ ...uploadData, categoria: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Obra (opcional)</Label>
                <Select
                  value={uploadData.obra_id}
                  onValueChange={(value) => setUploadData({ ...uploadData, obra_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma obra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Nenhuma</SelectItem>
                    {obras.map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>
                        {obra.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Descrição (opcional)</Label>
                <Input
                  value={uploadData.descricao}
                  onChange={(e) => setUploadData({ ...uploadData, descricao: e.target.value })}
                  placeholder="Informações adicionais"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUploadDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => uploadMutation.mutate(uploadData)}
                disabled={!uploadData.arquivo || !uploadData.nome}
              >
                Enviar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar documentos..."
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Categorias</SelectItem>
                {categorias.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterObra} onValueChange={setFilterObra}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Obras</SelectItem>
                {obras.map(obra => (
                  <SelectItem key={obra.id} value={obra.id}>
                    {obra.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {documentosFiltrados.map((doc) => {
              const categoria = categorias.find(c => c.value === doc.categoria);
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="text-2xl">{categoria?.icon || ''}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{doc.nome}</h3>
                      <div className="flex gap-2 mt-1 text-sm text-gray-600">
                        <Badge variant="outline">{categoria?.label}</Badge>
                        {doc.tamanho && <span>{formatFileSize(doc.tamanho)}</span>}
                        <span>• {new Date(doc.created_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(doc.arquivo_url, '_blank')}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(doc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {documentosFiltrados.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Nenhum documento encontrado</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}