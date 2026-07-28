import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export default function WorkflowForm({ workflow, onClose }) {
  const { empresaId } = useEmpresa();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(workflow || {
    nome: '',
    descricao: '',
    tipo: 'customizado',
    etapas: [],
    ativa: true
  });
  const [novaEtapa, setNovaEtapa] = useState({
    ordem: 0,
    nome: '',
    tipo_etapa: 'aprovacao',
    tempo_limite_horas: 24,
    obrigatorio: true
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis', empresaId],
    queryFn: () => base44.entities.Perfil.filter({ empresa_id: empresaId }),
    enabled: !!empresaId
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      const payload = { ...data, empresa_id: empresaId };
      if (workflow?.id) {
        return base44.entities.WorkflowDefinicao.update(workflow.id, payload);
      }
      return base44.entities.WorkflowDefinicao.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      onClose();
    }
  });

  const adicionarEtapa = () => {
    const etapas = [...(formData.etapas || [])];
    etapas.push({
      ...novaEtapa,
      ordem: etapas.length
    });
    setFormData({ ...formData, etapas });
    setNovaEtapa({
      ordem: 0,
      nome: '',
      tipo_etapa: 'aprovacao',
      tempo_limite_horas: 24,
      obrigatorio: true
    });
  };

  const removerEtapa = (index) => {
    const etapas = formData.etapas.filter((_, i) => i !== index);
    setFormData({ ...formData, etapas });
  };

  return (
    <div className="space-y-6">
      {/* Dados básicos */}
      <div className="space-y-4">
        <div>
          <Label>Nome do Workflow</Label>
          <Input
            value={formData.nome}
            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
            placeholder="Ex: Aprovação de Medição"
          />
        </div>

        <div>
          <Label>Descrição</Label>
          <Input
            value={formData.descricao || ''}
            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
            placeholder="Descrição do workflow"
          />
        </div>

        <div>
          <Label>Tipo</Label>
          <Select value={formData.tipo} onValueChange={(tipo) => setFormData({ ...formData, tipo })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="medicao">Medição</SelectItem>
              <SelectItem value="compra">Compra</SelectItem>
              <SelectItem value="pagamento">Pagamento</SelectItem>
              <SelectItem value="contrato">Contrato</SelectItem>
              <SelectItem value="customizado">Customizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Etapas */}
      <div className="border-t pt-6">
        <h3 className="font-semibold mb-4">Etapas do Workflow</h3>
        
        {formData.etapas?.map((etapa, index) => (
          <div key={index} className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg mb-3">
            <div className="flex-1">
              <p className="font-medium text-sm">{index + 1}. {etapa.nome}</p>
              <p className="text-xs text-gray-600">{etapa.tipo_etapa} • {etapa.tempo_limite_horas}h</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removerEtapa(index)}
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </Button>
          </div>
        ))}

        {/* Adicionar etapa */}
        <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium">Nova Etapa</h4>
          
          <Input
            value={novaEtapa.nome}
            onChange={(e) => setNovaEtapa({ ...novaEtapa, nome: e.target.value })}
            placeholder="Nome da etapa"
          />

          <Select value={novaEtapa.tipo_etapa} onValueChange={(tipo) => setNovaEtapa({ ...novaEtapa, tipo_etapa: tipo })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aprovacao">Aprovação</SelectItem>
              <SelectItem value="revisao">Revisão</SelectItem>
              <SelectItem value="assinatura">Assinatura</SelectItem>
              <SelectItem value="notificacao">Notificação</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="number"
            value={novaEtapa.tempo_limite_horas}
            onChange={(e) => setNovaEtapa({ ...novaEtapa, tempo_limite_horas: parseInt(e.target.value) })}
            placeholder="Tempo limite (horas)"
          />

          <Button
            type="button"
            variant="outline"
            onClick={adicionarEtapa}
            className="w-full gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Etapa
          </Button>
        </div>
      </div>

      {/* Ações */}
      <div className="flex justify-end gap-3 border-t pt-6">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate(formData)}
          disabled={mutation.isPending || !formData.nome || !formData.etapas?.length}
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar Workflow'}
        </Button>
      </div>
    </div>
  );
}