import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

const DIAS_SEMANA = [
  { v: 0, l: 'Domingo' }, { v: 1, l: 'Segunda-feira' }, { v: 2, l: 'Terça-feira' },
  { v: 3, l: 'Quarta-feira' }, { v: 4, l: 'Quinta-feira' }, { v: 5, l: 'Sexta-feira' }, { v: 6, l: 'Sábado' },
];

export default function FormRelatorioAgendado({ relatorio, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    nome: '',
    obra_id: '',
    tipo_relatorio: 'completo',
    frequencia: 'semanal',
    dia_semana: 1,
    dia_mes: 1,
    hora_envio: '09:00',
    stakeholders: [{ email: '', nome: '' }],
    incluir_progresso: true,
    incluir_custos: true,
    incluir_cronograma: true,
    incluir_alertas: true,
    formatos_exportacao: ['pdf']
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (relatorio) {
      setFormData(relatorio);
    }
  }, [relatorio]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 50),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (relatorio?.id) {
        // Editar
        await base44.entities.RelatorioAgendado.update(relatorio.id, formData);
        toast.success('Relatório atualizado');
      } else {
        // Criar
        const response = await base44.functions.invoke('agendarRelatorioObra', formData);
        if (response.data.success) {
          toast.success('Relatório agendado com sucesso');
        } else {
          toast.error(response.data.error);
        }
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddStakeholder = () => {
    setFormData(prev => ({
      ...prev,
      stakeholders: [...prev.stakeholders, { email: '', nome: '' }]
    }));
  };

  const handleRemoveStakeholder = (index) => {
    setFormData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.filter((_, i) => i !== index)
    }));
  };

  const handleUpdateStakeholder = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      stakeholders: prev.stakeholders.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Nome */}
      <div>
        <Label className="mb-1 block text-sm font-medium text-gray-700">Nome do Relatório *</Label>
        <Input
          className="h-11"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Ex: Relatório Semanal"
          required
        />
      </div>

      {/* Obra */}
      <div>
        <Label className="mb-1 block text-sm font-medium text-gray-700">Obra *</Label>
        <ComboboxBusca
          options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
          value={formData.obra_id}
          onSelect={(v) => setFormData({ ...formData, obra_id: v || '' })}
          placeholder="Selecione a obra"
          searchPlaceholder="Buscar obra..."
          emptyMessage="Nenhuma obra."
        />
      </div>

      {/* Tipo e Frequência */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block text-sm font-medium text-gray-700">Tipo de Relatório *</Label>
          <Select value={formData.tipo_relatorio} onValueChange={(value) => setFormData({ ...formData, tipo_relatorio: value })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="completo">Completo</SelectItem>
              <SelectItem value="progresso">Progresso</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="cronograma">Cronograma</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1 block text-sm font-medium text-gray-700">Frequência *</Label>
          <Select value={formData.frequencia} onValueChange={(value) => setFormData({ ...formData, frequencia: value })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diario">Diário</SelectItem>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Dia (depende da frequência) + Hora */}
      <div className="grid grid-cols-2 gap-4">
        {formData.frequencia === 'semanal' && (
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-700">Dia da semana *</Label>
            <Select value={String(formData.dia_semana ?? 1)} onValueChange={(v) => setFormData({ ...formData, dia_semana: Number(v) })}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIAS_SEMANA.map(d => <SelectItem key={d.v} value={String(d.v)}>{d.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {formData.frequencia === 'mensal' && (
          <div>
            <Label className="mb-1 block text-sm font-medium text-gray-700">Dia do mês *</Label>
            <Input
              className="h-11"
              type="number"
              min="1"
              max="31"
              value={formData.dia_mes ?? 1}
              onChange={(e) => setFormData({ ...formData, dia_mes: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </div>
        )}
        <div className={formData.frequencia === 'diario' ? 'col-span-2' : ''}>
          <Label className="mb-1 block text-sm font-medium text-gray-700">Hora de Envio *</Label>
          <Input
            className="h-11"
            type="time"
            value={formData.hora_envio}
            onChange={(e) => setFormData({ ...formData, hora_envio: e.target.value })}
            required
          />
        </div>
      </div>

      {/* Stakeholders */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-center">
            <Label className="text-base font-semibold">Stakeholders *</Label>
            <Button type="button" size="sm" variant="outline" onClick={handleAddStakeholder}>
              + Adicionar
            </Button>
          </div>

          {formData.stakeholders.map((stakeholder, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
              <Input
                className="h-11"
                placeholder="Nome"
                value={stakeholder.nome}
                onChange={(e) => handleUpdateStakeholder(index, 'nome', e.target.value)}
                required
              />
              <Input
                className="h-11"
                type="email"
                placeholder="Email"
                value={stakeholder.email}
                onChange={(e) => handleUpdateStakeholder(index, 'email', e.target.value)}
                required
              />
              {formData.stakeholders.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveStakeholder(index)}
                  className="h-11 text-red-600"
                >
                  Remover
                </Button>
              ) : <span />}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Opções de Conteúdo */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <Label className="text-base font-semibold">Incluir no Relatório</Label>
          
          <div className="flex items-center gap-2">
            <Checkbox
              id="progresso"
              checked={formData.incluir_progresso}
              onCheckedChange={(checked) => setFormData({ ...formData, incluir_progresso: checked })}
            />
            <label htmlFor="progresso" className="text-sm cursor-pointer">Progresso Físico</label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="custos"
              checked={formData.incluir_custos}
              onCheckedChange={(checked) => setFormData({ ...formData, incluir_custos: checked })}
            />
            <label htmlFor="custos" className="text-sm cursor-pointer">Custos e Financeiro</label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="cronograma"
              checked={formData.incluir_cronograma}
              onCheckedChange={(checked) => setFormData({ ...formData, incluir_cronograma: checked })}
            />
            <label htmlFor="cronograma" className="text-sm cursor-pointer">Cronograma</label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="alertas"
              checked={formData.incluir_alertas}
              onCheckedChange={(checked) => setFormData({ ...formData, incluir_alertas: checked })}
            />
            <label htmlFor="alertas" className="text-sm cursor-pointer">Alertas e Desvios</label>
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
          {loading ? 'Salvando...' : relatorio ? 'Atualizar' : 'Agendar'}
        </Button>
      </div>
    </form>
  );
}