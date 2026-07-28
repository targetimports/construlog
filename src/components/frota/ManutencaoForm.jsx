import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

// Coerção numérica segura: '' / null / NaN → 0 (evita gravar NaN→null no JSONB
// e concatenação de string no valor_total).
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ManutencaoForm({ manutencao, onClose }) {
  const [form, setForm] = useState(() => ({
    veiculo_id: manutencao?.veiculo_id || '',
    tipo: manutencao?.tipo || 'preventiva',
    descricao: manutencao?.descricao || '',
    data_entrada: manutencao?.data_entrada || new Date().toISOString().split('T')[0],
    data_saida: manutencao?.data_saida || '',
    km: manutencao?.km ?? '',
    valor_pecas: manutencao?.valor_pecas ?? '',
    valor_mao_obra: manutencao?.valor_mao_obra ?? '',
    oficina: manutencao?.oficina || '',
    status: manutencao?.status || 'agendada',
    observacoes: manutencao?.observacoes || ''
  }));

  const queryClient = useQueryClient();

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const veiculoOptions = useMemo(
    () => veiculos.map((v) => ({
      value: v.id,
      label: `${v.placa || 'Sem placa'}${v.modelo ? ` - ${v.modelo}` : ''}`
    })),
    [veiculos]
  );

  const valorTotal = num(form.valor_pecas) + num(form.valor_mao_obra);

  const mutation = useMutation({
    mutationFn: (payload) => (manutencao?.id
      ? base44.entities.Manutencao.update(manutencao.id, payload)
      : base44.entities.Manutencao.create(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manutencoes'] });
      toast.success(manutencao ? 'Manutenção atualizada!' : 'Manutenção criada!');
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Erro ao salvar manutenção')
  });

  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.veiculo_id) { toast.error('Selecione o veículo'); return; }
    if (!form.data_entrada) { toast.error('Informe a data de entrada'); return; }

    const payload = {
      ...form,
      km: num(form.km),
      valor_pecas: num(form.valor_pecas),
      valor_mao_obra: num(form.valor_mao_obra),
      valor_total: valorTotal,
      data_saida: form.data_saida || null
    };
    mutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Veículo *</Label>
          <ComboboxBusca
            options={veiculoOptions}
            value={form.veiculo_id}
            onSelect={(v) => set('veiculo_id', v)}
            placeholder="Selecione o veículo"
            searchPlaceholder="Buscar por placa ou modelo..."
            emptyMessage="Nenhum veículo encontrado."
          />
        </div>
        <div>
          <Label className="mb-1 block">Tipo</Label>
          <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="preventiva">Preventiva</SelectItem>
              <SelectItem value="corretiva">Corretiva</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Data Entrada *</Label>
          <Input type="date" className="h-11" value={form.data_entrada} onChange={(e) => set('data_entrada', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Data Saída</Label>
          <Input type="date" className="h-11" value={form.data_saida} onChange={(e) => set('data_saida', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className="mb-1 block">KM</Label>
          <Input type="number" min="0" className="h-11" value={form.km} onChange={(e) => set('km', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Valor Peças (R$)</Label>
          <Input type="number" min="0" step="0.01" className="h-11" value={form.valor_pecas} onChange={(e) => set('valor_pecas', e.target.value)} />
        </div>
        <div>
          <Label className="mb-1 block">Mão de Obra (R$)</Label>
          <Input type="number" min="0" step="0.01" className="h-11" value={form.valor_mao_obra} onChange={(e) => set('valor_mao_obra', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1 block">Oficina</Label>
          <Input className="h-11" value={form.oficina} onChange={(e) => set('oficina', e.target.value)} placeholder="Nome da oficina" />
        </div>
        <div>
          <Label className="mb-1 block">Status</Label>
          <Select value={form.status} onValueChange={(v) => set('status', v)}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluida">Concluída</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-1 block">Descrição</Label>
        <Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} rows={2} placeholder="Descreva o serviço de manutenção" />
      </div>

      <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
        <span className="text-sm font-medium text-gray-600">Valor Total</span>
        <span className="text-lg font-bold text-purple-600">
          {valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
