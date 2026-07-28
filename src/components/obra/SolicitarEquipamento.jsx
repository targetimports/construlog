import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';

export default function SolicitarEquipamento({ obraId, onBack }) {
  const [formData, setFormData] = useState({
    equipamento_id: '',
    data_inicio: '',
    data_fim: '',
    motivo: '',
    prioridade: 'media',
    observacao: ''
  });

  const queryClient = useQueryClient();

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const createMutation = useMutation({
    mutationFn: async (dados) => {
      const equip = equipamentos.find(e => e.id === dados.equipamento_id);
      return base44.entities.SolicitacaoEquipamentoObra.create({
        ...dados,
        obra_id: obraId,
        equipamento_nome: equip?.nome
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-equipamento', obraId] });
      setFormData({
        equipamento_id: '',
        data_inicio: '',
        data_fim: '',
        motivo: '',
        prioridade: 'media',
        observacao: ''
      });
      onBack();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.equipamento_id || !formData.data_inicio || !formData.data_fim || !formData.motivo) {
      alert('Preencha todos os campos obrigatórios');
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>

      <Card>
        <CardHeader>
          <CardTitle>Solicitar Equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Equipamento *</label>
              <select
                value={formData.equipamento_id}
                onChange={(e) => setFormData({...formData, equipamento_id: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="">-- Selecione --</option>
                {equipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Data Início *</label>
                <input
                  type="date"
                  value={formData.data_inicio}
                  onChange={(e) => setFormData({...formData, data_inicio: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Data Fim *</label>
                <input
                  type="date"
                  value={formData.data_fim}
                  onChange={(e) => setFormData({...formData, data_fim: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Motivo *</label>
              <textarea
                value={formData.motivo}
                onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                rows="3"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Descreva o motivo da solicitação"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Prioridade *</label>
              <select
                value={formData.prioridade}
                onChange={(e) => setFormData({...formData, prioridade: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Observação</label>
              <textarea
                value={formData.observacao}
                onChange={(e) => setFormData({...formData, observacao: e.target.value})}
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={onBack}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Enviando...' : 'Solicitar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}