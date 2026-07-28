import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Paperclip, 
  Plus, 
  FileText,
  Image as ImageIcon,
  File,
  Download,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const tipoConfig = {
  planta: { label: 'Planta', icon: FileText, color: 'text-blue-400' },
  contrato: { label: 'Contrato', icon: FileText, color: 'text-purple-400' },
  licenca: { label: 'Licença', icon: FileText, color: 'text-emerald-400' },
  relatorio: { label: 'Relatório', icon: FileText, color: 'text-amber-400' },
  foto: { label: 'Foto', icon: ImageIcon, color: 'text-pink-400' },
  outro: { label: 'Outro', icon: File, color: 'text-gray-400' }
};

export default function AnexosSection({ anexos, obraId }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'outro',
    descricao: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      return base44.entities.AnexoObra.create({ 
        ...data, 
        obra_id: obraId,
        enviado_por: user.email
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anexos-obra', obraId] });
      toast.success('Anexo adicionado!');
      setDialogOpen(false);
      setFormData({ nome: '', tipo: 'outro', descricao: '' });
      setSelectedFile(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AnexoObra.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anexos-obra', obraId] });
      toast.success('Anexo removido');
    }
  });

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (!formData.nome) {
        setFormData({ ...formData, nome: file.name });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Selecione um arquivo');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });
      const tamanhoKB = Math.round(selectedFile.size / 1024);
      
      createMutation.mutate({
        ...formData,
        arquivo_url: file_url,
        tamanho_kb: tamanhoKB
      });
    } catch (error) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const anexosPorTipo = anexos.reduce((acc, anexo) => {
    const tipo = anexo.tipo || 'outro';
    if (!acc[tipo]) acc[tipo] = [];
    acc[tipo].push(anexo);
    return acc;
  }, {});

  return (
    <>
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-amber-500" />
            Documentos e Anexos
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {anexos.length === 0 ? (
            <div className="text-center py-8">
              <Paperclip className="w-12 h-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Nenhum anexo</p>
              <Button
                size="sm"
                onClick={() => setDialogOpen(true)}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Anexo
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(anexosPorTipo).map(([tipo, anexosTipo]) => {
                const config = tipoConfig[tipo] || tipoConfig.outro;
                const Icon = config.icon;

                return (
                  <div key={tipo}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className={cn("w-4 h-4", config.color)} />
                      <h4 className="text-white font-medium">{config.label}</h4>
                      <Badge variant="outline" className="border-gray-700 text-gray-400">
                        {anexosTipo.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {anexosTipo.map((anexo) => (
                        <div
                          key={anexo.id}
                          className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-amber-500/30 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h5 className="text-white font-medium truncate">{anexo.nome}</h5>
                              {anexo.descricao && (
                                <p className="text-gray-500 text-xs mt-1">{anexo.descricao}</p>
                              )}
                            </div>
                            <div className="flex gap-1 ml-2">
                              <a
                                href={anexo.arquivo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                              >
                                <Download className="w-4 h-4 text-gray-400" />
                              </a>
                              <button
                                onClick={() => deleteMutation.mutate(anexo.id)}
                                className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>{anexo.tamanho_kb ? `${anexo.tamanho_kb} KB` : 'Tamanho desconhecido'}</span>
                            <span>{new Date(anexo.created_date).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Novo Anexo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Adicionar Anexo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-gray-400">Arquivo *</Label>
              <input
                type="file"
                onChange={handleFileSelect}
                className="mt-1.5 w-full text-gray-400 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-amber-500 file:text-gray-900 hover:file:bg-amber-600 file:cursor-pointer"
                required
              />
            </div>
            <div>
              <Label className="text-gray-400">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                placeholder="Nome do arquivo"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Tipo</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="planta">Planta</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="licenca">Licença</SelectItem>
                  <SelectItem value="relatorio">Relatório</SelectItem>
                  <SelectItem value="foto">Foto</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Descrição</Label>
              <Input
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição opcional"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="border-gray-700 text-gray-400"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={uploading || createMutation.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                {uploading ? 'Enviando...' : 'Adicionar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}