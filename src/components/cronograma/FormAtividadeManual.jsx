import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

export default function FormAtividadeManual({ obraId, onAtividadeCriada, onCancelar }) {
  const [form, setForm] = useState({
    nomeAtividade: '',
    und: 'un',
    quantidadePlanejada: 1,
    dataInicioPlanejada: '',
    dataFimPlanejada: '',
    responsavel: ''
  });

  const criarMutation = useMutation({
    mutationFn: async () => {
      if (!form.nomeAtividade?.trim()) throw new Error('Nome da atividade é obrigatório');
      if (!form.dataInicioPlanejada) throw new Error('Data de início é obrigatória');
      if (!form.dataFimPlanejada) throw new Error('Data de fim é obrigatória');

      const atividade = await base44.entities.CronogramaItem.create({
        obraId,
        nomeAtividade: form.nomeAtividade.trim(),
        und: form.und,
        quantidadePlanejada: parseFloat(form.quantidadePlanejada) || 1,
        dataInicioPlanejada: form.dataInicioPlanejada,
        dataFimPlanejada: form.dataFimPlanejada,
        responsavel: form.responsavel?.trim() || '',
        status: 'Não iniciado'
      });

      return atividade;
    },
    onSuccess: (atividade) => {
      toast.success('Atividade criada com sucesso');
      setForm({
        nomeAtividade: '',
        und: 'un',
        quantidadePlanejada: 1,
        dataInicioPlanejada: '',
        dataFimPlanejada: '',
        responsavel: ''
      });
      if (onAtividadeCriada) {
        onAtividadeCriada(atividade);
      }
    },
    onError: (error) => {
      toast.error('Erro ao criar atividade: ' + error.message);
    }
  });

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-gray-900">Adicionar Atividade Manual</h4>
        <button
          onClick={onCancelar}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label className="text-gray-700 font-medium mb-1">Nome da Atividade *</Label>
          <Input
            placeholder="Ex: Fundação, Estrutura, Alvenaria"
            value={form.nomeAtividade}
            onChange={(e) => setForm({ ...form, nomeAtividade: e.target.value })}
          />
        </div>

        <div>
          <Label className="text-gray-700 font-medium mb-1">Quantidade *</Label>
          <Input
            type="number"
            placeholder="1"
            min="0"
            step="0.01"
            value={form.quantidadePlanejada}
            onChange={(e) => setForm({ ...form, quantidadePlanejada: e.target.value })}
          />
        </div>

        <div>
          <Label className="text-gray-700 font-medium mb-1">Unidade</Label>
          <Select value={form.und} onValueChange={(val) => setForm({ ...form, und: val })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="un">Unidade (un)</SelectItem>
              <SelectItem value="m">Metro (m)</SelectItem>
              <SelectItem value="m2">Metro Quadrado (m²)</SelectItem>
              <SelectItem value="m3">Metro Cúbico (m³)</SelectItem>
              <SelectItem value="kg">Quilograma (kg)</SelectItem>
              <SelectItem value="l">Litro (l)</SelectItem>
              <SelectItem value="sc">Saco (sc)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-gray-700 font-medium mb-1">Início Planejado *</Label>
          <Input
            type="date"
            value={form.dataInicioPlanejada}
            onChange={(e) => setForm({ ...form, dataInicioPlanejada: e.target.value })}
          />
        </div>

        <div>
          <Label className="text-gray-700 font-medium mb-1">Fim Planejado *</Label>
          <Input
            type="date"
            value={form.dataFimPlanejada}
            onChange={(e) => setForm({ ...form, dataFimPlanejada: e.target.value })}
          />
        </div>

        <div className="md:col-span-2">
          <Label className="text-gray-700 font-medium mb-1">Responsável</Label>
          <Input
            placeholder="Ex: João Silva, eng@example.com"
            value={form.responsavel}
            onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button
          variant="outline"
          onClick={onCancelar}
        >
          Cancelar
        </Button>
        <Button
          onClick={() => criarMutation.mutate()}
          disabled={criarMutation.isPending}
          className="bg-green-600 hover:bg-green-700 gap-2"
        >
          {criarMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Criar Atividade
            </>
          )}
        </Button>
      </div>
    </div>
  );
}