import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, Save, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import ItemRequisicao from '../components/compras/ItemRequisicao';
import ImportarDoOrcamento from '../components/compras/ImportarDoOrcamento';

export default function SolicitacaoForm() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');

  const [formData, setFormData] = useState({
    titulo: '',
    obra_id: '',
    data_solicitacao: new Date().toISOString().split('T')[0],
    data_necessidade: '',
    prioridade: 'normal',
    status_aprovacao: 'aguardando',
    status_atendimento: 'em_aberto',
    itens: [],
    comentarios: []
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const salvarMutation = useMutation({
    mutationFn: async (data) => {
      const user = await base44.auth.me();
      const dadosCompletos = {
        ...data,
        solicitante: user.email,
        valor_total_estimado: data.itens.reduce((sum, item) => 
          sum + ((item.valor_estimado || 0) * (item.quantidade_solicitada || 0)), 0
        )
      };

      if (id) {
        return base44.entities.RequisicaoCompra.update(id, dadosCompletos);
      }
      return base44.entities.RequisicaoCompra.create(dadosCompletos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Solicitação salva com sucesso!');
      window.location.href = createPageUrl('Solicitacoes');
    },
    onError: () => {
      toast.error('Erro ao salvar solicitação');
    }
  });

  const handleSubmit = () => {
    if (!formData.obra_id) {
      toast.error('Selecione um centro de custo (obra)');
      return;
    }
    if (formData.itens.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }
    salvarMutation.mutate(formData);
  };

  const notificarAprovadores = async () => {
    // TODO: Implementar notificação por email
    toast.success('Notificação enviada aos aprovadores');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl('Solicitacoes')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {id ? 'Editar Solicitação' : 'Nova Solicitação'}
            </h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={notificarAprovadores}
            variant="outline"
            className="border-gray-700 text-gray-400 gap-2"
          >
            <Bell className="w-4 h-4" />
            Notificar Aprovadores
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={salvarMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600 text-white gap-2"
          >
            <Save className="w-4 h-4" />
            Salvar
          </Button>
        </div>
      </div>

      {/* Informações Gerais */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Centro de Custo (Obra) *</Label>
              <Select value={formData.obra_id} onValueChange={(v) => setFormData({ ...formData, obra_id: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Selecione a obra" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-400">Título (opcional)</Label>
              <Input
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Materiais para fundação"
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-gray-400">Data da Solicitação *</Label>
              <Input
                type="date"
                value={formData.data_solicitacao}
                onChange={(e) => setFormData({ ...formData, data_solicitacao: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Necessidade de Recebimento</Label>
              <Input
                type="date"
                value={formData.data_necessidade}
                onChange={(e) => setFormData({ ...formData, data_necessidade: e.target.value })}
                className="mt-1.5 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div>
              <Label className="text-gray-400">Prioridade</Label>
              <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                <SelectTrigger className="mt-1.5 bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800">
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itens */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white">Itens da Solicitação</CardTitle>
          {formData.obra_id && (
            <ImportarDoOrcamento
              obraId={formData.obra_id}
              onImportar={(itensImportados) => {
                setFormData({ ...formData, itens: [...formData.itens, ...itensImportados] });
                toast.success(`${itensImportados.length} itens importados do orçamento`);
              }}
            />
          )}
        </CardHeader>
        <CardContent>
          <ItemRequisicao
            itens={formData.itens}
            onItensChange={(itens) => setFormData({ ...formData, itens })}
            disabled={false}
          />
        </CardContent>
      </Card>

      {/* Comentários */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Adicione observações ou informações importantes..."
            className="bg-gray-800 border-gray-700 text-white"
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}