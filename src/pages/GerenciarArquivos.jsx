import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Upload, File, Download, Trash2, Lock, Users, Globe } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function GerenciarArquivos() {
  const [obraParamId, setObraParamId] = useState(null);
  const [obraFiltro, setObraFiltro] = useState('todos');
  const [tipoFiltro, setTipoFiltro] = useState('todos');
  const [busca, setBusca] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const obraId = params.get('obra_id');
    if (obraId) {
      setObraParamId(obraId);
      setObraFiltro(obraId);
    }
  }, []);
  
  const [novoArquivo, setNovoArquivo] = useState({
    obra_id: obraParamId || '',
    tipo: 'documentacao',
    visibilidade: 'privado',
    descricao: '',
    usuarios_acesso: []
  });

  const queryClient = useQueryClient();

  const { data: arquivos = [] } = useQuery({
    queryKey: ['arquivos-obra'],
    queryFn: () => base44.entities.ArquivoObra.list('-created_date')
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ArquivoObra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['arquivos-obra']);
      toast.success('Arquivo excluído');
    }
  });

  const arquivosFiltrados = arquivos.filter(arq => {
    const matchObra = obraFiltro === 'todos' || arq.obra_id === obraFiltro;
    const matchTipo = tipoFiltro === 'todos' || arq.tipo === tipoFiltro;
    const matchBusca = arq.nome_arquivo?.toLowerCase().includes(busca.toLowerCase()) ||
                       arq.descricao?.toLowerCase().includes(busca.toLowerCase());
    return matchObra && matchTipo && matchBusca;
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !novoArquivo.obra_id) {
      toast.error('Selecione a obra e os arquivos');
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        
        await base44.entities.ArquivoObra.create({
          obra_id: novoArquivo.obra_id,
          nome_arquivo: file.name,
          url: file_url,
          tipo: novoArquivo.tipo,
          visibilidade: novoArquivo.visibilidade,
          descricao: novoArquivo.descricao,
          usuarios_acesso: novoArquivo.usuarios_acesso,
          tamanho_bytes: file.size,
          extensao: file.name.split('.').pop(),
          data_upload: new Date().toISOString()
        });
      }

      queryClient.invalidateQueries(['arquivos-obra']);
      toast.success(`${files.length} arquivo(s) enviado(s)`);
      setDialogOpen(false);
      setNovoArquivo({
        obra_id: '',
        tipo: 'documentacao',
        visibilidade: 'privado',
        descricao: '',
        usuarios_acesso: []
      });
    } catch (error) {
      toast.error('Erro ao enviar: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const tipoConfig = {
    projeto: { label: 'Projeto', color: 'bg-blue-600' },
    contrato: { label: 'Contrato', color: 'bg-purple-600' },
    medicao: { label: 'Medição', color: 'bg-green-600' },
    nota_fiscal: { label: 'Nota Fiscal', color: 'bg-amber-600' },
    orcamento: { label: 'Orçamento', color: 'bg-indigo-600' },
    foto: { label: 'Foto', color: 'bg-pink-600' },
    relatorio: { label: 'Relatório', color: 'bg-emerald-600' },
    documentacao: { label: 'Documentação', color: 'bg-slate-600' },
    outro: { label: 'Outro', color: 'bg-gray-600' }
  };

  const visibilidadeIcons = {
    privado: <Lock className="w-4 h-4" />,
    equipe: <Users className="w-4 h-4" />,
    publico: <Globe className="w-4 h-4" />
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciar Arquivos"
        subtitle="Controle documentos e arquivos das obras"
        action={() => setDialogOpen(true)}
        actionLabel="Enviar Arquivos"
        actionIcon={Upload}
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(tipoConfig).slice(0, 4).map(([tipo, config]) => {
          const count = arquivos.filter(a => (obraParamId ? a.obra_id === obraParamId : true) && a.tipo === tipo).length;
          return (
            <Card key={tipo} className="bg-white border border-gray-200 hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${config.color} bg-opacity-10 flex items-center justify-center`}>
                    <File className={`w-5 h-5 ${config.color.replace('bg-', 'text-')}`} />
                  </div>
                  <div>
                    <p className="text-gray-600 text-xs font-semibold uppercase">{config.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{count}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <Card className="bg-white border border-gray-200">
        <CardContent className="p-5">
          <div className="grid grid-cols-3 gap-4">
            <Input
              placeholder="Buscar arquivos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="border-gray-300"
            />
            {!obraParamId && (
              <Select value={obraFiltro} onValueChange={setObraFiltro}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue placeholder="Filtrar por obra..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
              <SelectTrigger className="border-gray-300">
                <SelectValue placeholder="Filtrar por tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(tipoConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Arquivos */}
      <div className="grid gap-3">
        {arquivosFiltrados.length === 0 ? (
          <Card className="bg-white border border-gray-200">
            <CardContent className="p-12 text-center">
              <File className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum arquivo encontrado</p>
            </CardContent>
          </Card>
        ) : (
          arquivosFiltrados.map(arquivo => {
            const obra = obras.find(o => o.id === arquivo.obra_id);
            return (
              <Card key={arquivo.id} className="bg-white border border-gray-200 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-lg ${tipoConfig[arquivo.tipo]?.color} bg-opacity-10 flex items-center justify-center`}>
                        <File className={`w-6 h-6 ${tipoConfig[arquivo.tipo]?.color.replace('bg-', 'text-')}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="text-gray-900 font-semibold truncate">{arquivo.nome_arquivo}</p>
                          <Badge variant="default" className="text-xs">
                            {tipoConfig[arquivo.tipo]?.label}
                          </Badge>
                          <div className="flex items-center gap-1 text-gray-500">
                            {visibilidadeIcons[arquivo.visibilidade]}
                            <span className="text-xs capitalize">{arquivo.visibilidade}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
                          {!obraParamId && <span>{obra?.nome || 'Obra não identificada'}</span>}
                          {!obraParamId && <span>•</span>}
                          <span>{formatBytes(arquivo.tamanho_bytes || 0)}</span>
                          <span>•</span>
                          <span>{new Date(arquivo.created_date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {arquivo.descricao && (
                          <p className="text-gray-600 text-sm mt-2">{arquivo.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(arquivo.url, '_blank')}
                        className="text-blue-600 hover:bg-blue-50"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(arquivo.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog Upload */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-white border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Enviar Arquivos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!obraParamId && (
              <div>
                <label className="block text-gray-700 font-semibold mb-2 text-sm">Obra *</label>
                <Select value={novoArquivo.obra_id} onValueChange={(v) => setNovoArquivo({...novoArquivo, obra_id: v})}>
                  <SelectTrigger className="border-gray-300">
                    <SelectValue placeholder="Selecione a obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {obras.map(obra => (
                      <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">Tipo de Arquivo *</label>
              <Select value={novoArquivo.tipo} onValueChange={(v) => setNovoArquivo({...novoArquivo, tipo: v})}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(tipoConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">Visibilidade *</label>
              <Select value={novoArquivo.visibilidade} onValueChange={(v) => setNovoArquivo({...novoArquivo, visibilidade: v})}>
                <SelectTrigger className="border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="privado">Privado (apenas você)</SelectItem>
                  <SelectItem value="equipe">Equipe (membros da obra)</SelectItem>
                  <SelectItem value="publico">Público (todos)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">Descrição</label>
              <Textarea
                value={novoArquivo.descricao}
                onChange={(e) => setNovoArquivo({...novoArquivo, descricao: e.target.value})}
                className="border-gray-300"
                placeholder="Adicione uma descrição..."
              />
            </div>

            <div>
              <label className="block text-gray-700 font-semibold mb-2 text-sm">Selecione os arquivos *</label>
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="w-full text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={uploading}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button disabled={uploading} className="bg-blue-600 hover:bg-blue-700">
                {uploading ? 'Enviando...' : 'Enviar Arquivos'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}