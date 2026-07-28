import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Upload, 
  FileText, 
  Download,
  Trash2,
  ExternalLink,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const statusConfig = {
  em_analise: { label: 'Em Análise', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  habilitado: { label: 'Habilitado', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  proposta_enviada: { label: 'Proposta Enviada', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  vencedor: { label: 'Vencedor', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  perdedor: { label: 'Perdedor', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

export default function LicitacaoDetalhes() {
  const urlParams = new URLSearchParams(window.location.search);
  const licitacaoId = urlParams.get('id');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const [docForm, setDocForm] = useState({
    nome: '',
    tipo: 'edital',
    descricao: ''
  });

  const { data: licitacaoData, isLoading } = useQuery({
    queryKey: ['licitacao', licitacaoId],
    queryFn: () => base44.entities.Licitacao.filter({ id: licitacaoId }),
    enabled: !!licitacaoId
  });

  const { data: documentos = [] } = useQuery({
    queryKey: ['documentos-licitacao', licitacaoId],
    queryFn: () => base44.entities.DocumentoLicitacao.filter({ licitacao_id: licitacaoId }, '-created_date'),
    enabled: !!licitacaoId
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.DocumentoLicitacao.create({
        licitacao_id: licitacaoId,
        nome: docForm.nome || file.name,
        tipo: docForm.tipo,
        arquivo_url: file_url,
        tamanho_kb: Math.round(file.size / 1024),
        descricao: docForm.descricao,
        data_envio: new Date().toISOString().split('T')[0]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-licitacao'] });
      toast.success('Documento enviado!');
      setDialogOpen(false);
      setDocForm({ nome: '', tipo: 'edital', descricao: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DocumentoLicitacao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos-licitacao'] });
      toast.success('Documento excluído!');
    }
  });

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = e.target.arquivo.files[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync(file);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-64 bg-gray-800 rounded-2xl" /></div>;
  }

  const licitacao = licitacaoData?.[0];
  if (!licitacao) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Licitação não encontrada</p>
        <Link to={createPageUrl('Licitacoes')}>
          <Button className="mt-4">Voltar</Button>
        </Link>
      </div>
    );
  }

  const status = statusConfig[licitacao.status] || statusConfig.em_analise;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-white">{licitacao.numero_edital}</h1>
              <Badge className={cn("border", status.color)}>{status.label}</Badge>
            </div>
            <p className="text-gray-500">{licitacao.orgao}</p>
          </div>
        </div>
        <Link to={createPageUrl(`LicitacaoForm?id=${licitacao.id}`)}>
          <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900 gap-2">
            <Edit className="w-4 h-4" />
            Editar
          </Button>
        </Link>
      </div>

      {/* Informações Principais */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Objeto</p>
            <p className="text-white">{licitacao.objeto}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-400 text-sm mb-1">Modalidade</p>
              <p className="text-white font-medium capitalize">{licitacao.modalidade.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Tipo</p>
              <p className="text-white font-medium capitalize">{licitacao.tipo.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Prazo Execução</p>
              <p className="text-white font-medium">{licitacao.prazo_execucao || '-'} dias</p>
            </div>
            {licitacao.link_edital && (
              <div>
                <p className="text-gray-400 text-sm mb-1">Link Edital</p>
                <a href={licitacao.link_edital} target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 flex items-center gap-1">
                  <ExternalLink className="w-4 h-4" />
                  Acessar
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Datas e Valores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Cronograma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {licitacao.data_publicacao && (
              <div className="flex justify-between">
                <span className="text-gray-400">Publicação</span>
                <span className="text-white">{new Date(licitacao.data_publicacao).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {licitacao.data_abertura && (
              <div className="flex justify-between">
                <span className="text-gray-400">Abertura</span>
                <span className="text-white">{new Date(licitacao.data_abertura).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
            {licitacao.data_resultado && (
              <div className="flex justify-between">
                <span className="text-gray-400">Resultado</span>
                <span className="text-white">{new Date(licitacao.data_resultado).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-500" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {licitacao.valor_estimado && (
              <div className="flex justify-between">
                <span className="text-gray-400">Estimado</span>
                <span className="text-white font-medium">
                  {licitacao.valor_estimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            {licitacao.nossa_proposta && (
              <div className="flex justify-between">
                <span className="text-gray-400">Nossa Proposta</span>
                <span className="text-amber-500 font-medium">
                  {licitacao.nossa_proposta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
            {licitacao.vencedor_valor && (
              <div className="flex justify-between">
                <span className="text-gray-400">Valor Vencedor</span>
                <span className="text-white font-medium">
                  {licitacao.vencedor_valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documentos */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Documentos ({documentos.length})
          </CardTitle>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-amber-500 hover:bg-amber-600 text-gray-900">
            <Upload className="w-4 h-4 mr-2" />
            Enviar Documento
          </Button>
        </CardHeader>
        <CardContent>
          {documentos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum documento enviado</p>
          ) : (
            <div className="space-y-3">
              {documentos.map(doc => (
                <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-amber-500" />
                    <div>
                      <p className="text-white font-medium">{doc.nome}</p>
                      <p className="text-gray-500 text-sm capitalize">{doc.tipo.replace('_', ' ')} • {doc.tamanho_kb}KB</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" asChild className="border-gray-700 text-gray-400">
                      <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => deleteMutation.mutate(doc.id)}
                      className="border-red-700 text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Upload */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Enviar Documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label className="text-gray-400">Nome do Documento</Label>
              <Input
                value={docForm.nome}
                onChange={(e) => setDocForm({ ...docForm, nome: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Tipo *</Label>
              <Select value={docForm.tipo} onValueChange={(v) => setDocForm({ ...docForm, tipo: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="edital">Edital</SelectItem>
                  <SelectItem value="proposta_tecnica">Proposta Técnica</SelectItem>
                  <SelectItem value="proposta_comercial">Proposta Comercial</SelectItem>
                  <SelectItem value="habilitacao">Habilitação</SelectItem>
                  <SelectItem value="recurso">Recurso</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Arquivo *</Label>
              <Input
                type="file"
                name="arquivo"
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-700 text-gray-400">
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading} className="bg-amber-500 hover:bg-amber-600 text-gray-900">
                {uploading ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}