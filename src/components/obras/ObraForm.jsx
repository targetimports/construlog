import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function ObraForm({ obra, onClose }) {
  const [form, setForm] = useState(obra || {
    nome: '',
    codigo: '',
    tipo: 'privada',
    tipo_obra: 'edificacao',
    cliente: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    area_total: 0,
    data_inicio: '',
    data_prevista_fim: '',
    responsavel_tecnico: '',
    responsavel_obra: '',
    total_orcamento: 0,
    bdi_percent: 0,
    fase: 'pre_orcamento',
    status: 'orcamento'
  });

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (data) => {
      const dataWithBDI = {
        ...data,
        total_final_orcamento: data.total_orcamento * (1 + (data.bdi_percent / 100))
      };
      if (obra?.id) {
        return base44.entities.Obra.update(obra.id, dataWithBDI);
      } else {
        return base44.entities.Obra.create(dataWithBDI);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      toast.success(obra ? 'Obra atualizada!' : 'Obra criada!');
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{obra ? 'Editar Obra' : 'Nova Obra'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome *</label>
              <Input className="h-11" required value={form.nome} onChange={(e) => setForm({...form, nome: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Código</label>
              <Input className="h-11" value={form.codigo} onChange={(e) => setForm({...form, codigo: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <Input className="h-11" required value={form.cliente} onChange={(e) => setForm({...form, cliente: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tipo</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({...form, tipo: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="privada">Privada</SelectItem>
                  <SelectItem value="publica">Pública</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Tipo Obra</label>
              <Select value={form.tipo_obra} onValueChange={(v) => setForm({...form, tipo_obra: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="edificacao">Edificação</SelectItem>
                  <SelectItem value="infraestrutura">Infraestrutura</SelectItem>
                  <SelectItem value="reforma">Reforma</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fase</label>
              <Select value={form.fase} onValueChange={(v) => setForm({...form, fase: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_orcamento">Pré-Orçamento</SelectItem>
                  <SelectItem value="orcamento">Orçamento</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Endereço</label>
              <Input className="h-11" value={form.endereco} onChange={(e) => setForm({...form, endereco: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <Input className="h-11" value={form.cidade} onChange={(e) => setForm({...form, cidade: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <Input className="h-11" value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value})} maxLength="2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CEP</label>
              <Input className="h-11" value={form.cep} onChange={(e) => setForm({...form, cep: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Área Total (m²)</label>
              <Input className="h-11" type="number" value={form.area_total} onChange={(e) => setForm({...form, area_total: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Orçamento Total</label>
              <Input className="h-11" type="number" step="0.01" value={form.total_orcamento} onChange={(e) => setForm({...form, total_orcamento: parseFloat(e.target.value)})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">BDI (%)</label>
              <Input className="h-11" type="number" step="0.01" value={form.bdi_percent} onChange={(e) => setForm({...form, bdi_percent: parseFloat(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="orcamento">Orçamento</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}