import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ProjetoTecnicoForm() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    obra_id: '',
    codigo: '',
    nome: '',
    tipo: 'arquitetonico',
    disciplina: '',
    status: 'em_elaboracao',
    versao_atual: '1.0',
    responsavel_tecnico: '',
    observacoes: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return await base44.entities.ProjetoTecnico.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projetos-tecnicos'] });
      toast.success('Projeto cadastrado!');
      window.location.href = createPageUrl('Engenharia');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const file = e.target.arquivo?.files[0];
    
    setUploading(true);
    try {
      let arquivo_url = null;
      let tamanho_kb = null;

      if (file) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        arquivo_url = file_url;
        tamanho_kb = Math.round(file.size / 1024);
      }

      await createMutation.mutateAsync({
        ...formData,
        arquivo_url,
        tamanho_kb
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.href = createPageUrl('Engenharia')}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Novo Projeto Técnico</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Informações do Projeto</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-gray-400">Obra *</Label>
              <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Código</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                placeholder="Ex: ARQ-001"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Nome do Projeto *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Tipo *</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="arquitetonico">Arquitetônico</SelectItem>
                  <SelectItem value="estrutural">Estrutural</SelectItem>
                  <SelectItem value="hidraulico">Hidráulico</SelectItem>
                  <SelectItem value="eletrico">Elétrico</SelectItem>
                  <SelectItem value="paisagismo">Paisagismo</SelectItem>
                  <SelectItem value="fundacao">Fundação</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Disciplina</Label>
              <Input
                value={formData.disciplina}
                onChange={(e) => setFormData({ ...formData, disciplina: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Versão</Label>
              <Input
                value={formData.versao_atual}
                onChange={(e) => setFormData({ ...formData, versao_atual: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Responsável Técnico</Label>
              <Input
                value={formData.responsavel_tecnico}
                onChange={(e) => setFormData({ ...formData, responsavel_tecnico: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Arquivo do Projeto</Label>
              <Input
                type="file"
                name="arquivo"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-gray-400">Observações</Label>
              <Textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.location.href = createPageUrl('Engenharia')}
            className="border-gray-700 text-gray-400"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={uploading}
            className="bg-amber-500 hover:bg-amber-600 text-gray-900"
          >
            <Save className="w-4 h-4 mr-2" />
            {uploading ? 'Salvando...' : 'Cadastrar Projeto'}
          </Button>
        </div>
      </form>
    </div>
  );
}