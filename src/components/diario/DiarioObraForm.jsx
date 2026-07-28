import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function DiarioObraForm({ diario, onClose }) {
  const [form, setForm] = useState(diario || {
    obra_id: '',
    data: new Date().toISOString().split('T')[0],
    clima: 'nublado',
    temperatura: '',
    atividades_realizadas: '',
    qtd_funcionarios: 0,
    responsavel: '',
    observacoes: '',
    status: 'rascunho'
  });

  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const mutation = useMutation({
    mutationFn: async (data) => {
      if (diario?.id) {
        return base44.entities.DiarioObra.update(diario.id, data);
      } else {
        return base44.entities.DiarioObra.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diarios-obra'] });
      toast.success(diario ? 'Diário atualizado!' : 'Diário criado!');
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.obra_id || !String(form.obra_id).trim()) {
      toast.error('Selecione uma obra para prosseguir');
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{diario ? 'Editar Diário' : 'Novo Diário de Obra'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Obra *</label>
              <select
                required
                value={form.obra_id}
                onChange={(e) => setForm({...form, obra_id: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Selecione uma obra</option>
                {obras.map(o => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data *</label>
              <Input
                type="date"
                required
                value={form.data}
                onChange={(e) => setForm({...form, data: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Clima</label>
              <select
                value={form.clima}
                onChange={(e) => setForm({...form, clima: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="ensolarado">Ensolarado</option>
                <option value="nublado">Nublado</option>
                <option value="chuvoso">Chuvoso</option>
                <option value="tempestade">Tempestade</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Temperatura</label>
              <Input
                value={form.temperatura}
                onChange={(e) => setForm({...form, temperatura: e.target.value})}
                placeholder="25°C"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Qtd. Funcionários</label>
              <Input
                type="number"
                value={form.qtd_funcionarios}
                onChange={(e) => setForm({...form, qtd_funcionarios: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Atividades Realizadas</label>
            <textarea
              value={form.atividades_realizadas}
              onChange={(e) => setForm({...form, atividades_realizadas: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="3"
              placeholder="Descreva as atividades..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Responsável</label>
            <Input
              value={form.responsavel}
              onChange={(e) => setForm({...form, responsavel: e.target.value})}
              placeholder="Nome do responsável"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm({...form, observacoes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              rows="2"
            />
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