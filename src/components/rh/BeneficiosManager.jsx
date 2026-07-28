import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign, Calendar, Percent } from 'lucide-react';
import { toast } from 'sonner';

export default function BeneficiosManager({ colaborador_id, canEdit }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBeneficio, setEditingBeneficio] = useState(null);
  const queryClient = useQueryClient();

  // Buscar catálogo
  const { data: catalogo = [] } = useQuery({
    queryKey: ['beneficio-catalogo'],
    queryFn: () => base44.entities.BeneficioCatalogo.filter({ ativo: true })
  });

  // Buscar benefícios do colaborador
  const { data: beneficios = [] } = useQuery({
    queryKey: ['colaborador-beneficios', colaborador_id],
    queryFn: () => base44.entities.ColaboradorBeneficio.filter({ colaborador_id }),
    enabled: !!colaborador_id
  });

  const salvarBeneficio = useMutation({
    mutationFn: async (data) => {
      if (editingBeneficio?.id) {
        return base44.entities.ColaboradorBeneficio.update(editingBeneficio.id, data);
      } else {
        return base44.entities.ColaboradorBeneficio.create({ ...data, colaborador_id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador-beneficios'] });
      setDialogOpen(false);
      setEditingBeneficio(null);
      toast.success('Benefício salvo');
    },
    onError: () => toast.error('Erro ao salvar benefício')
  });

  const removerBeneficio = useMutation({
    mutationFn: (id) => base44.entities.ColaboradorBeneficio.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colaborador-beneficios'] });
      toast.success('Benefício removido');
    }
  });

  const toggleAtivo = async (id, ativo) => {
    await base44.entities.ColaboradorBeneficio.update(id, { ativo });
    queryClient.invalidateQueries({ queryKey: ['colaborador-beneficios'] });
  };

  if (!colaborador_id) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Salve o colaborador primeiro para gerenciar benefícios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Benefícios Ativos</h4>
        {canEdit && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={() => setEditingBeneficio(null)}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Adicionar Benefício</DialogTitle>
              </DialogHeader>
              <BeneficioForm
                catalogo={catalogo}
                beneficio={editingBeneficio}
                onSave={(data) => salvarBeneficio.mutate(data)}
                onCancel={() => setDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {beneficios.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">Nenhum benefício cadastrado</p>
      ) : (
        <div className="space-y-2">
          {beneficios.map(ben => {
            const cat = catalogo.find(c => c.id === ben.beneficio_id);
            return (
              <div key={ben.id} className="flex items-center justify-between bg-white border rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={ben.ativo}
                    onCheckedChange={(checked) => toggleAtivo(ben.id, checked)}
                    disabled={!canEdit}
                  />
                  <div>
                    <p className="font-medium text-sm">{cat?.nome || 'Benefício'}</p>
                    <p className="text-xs text-gray-500">
                      {ben.tipo_calculo} - {ben.quem_paga}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    R$ {(ben.valor_mensal || 0).toFixed(2)}
                  </Badge>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removerBeneficio.mutate(ben.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BeneficioForm({ catalogo, beneficio, onSave, onCancel }) {
  const [form, setForm] = useState(beneficio || {
    beneficio_id: '',
    tipo_calculo: 'FIXO',
    valor_mensal: 0,
    quem_paga: 'EMPRESA',
    perc_empresa: 100,
    perc_funcionario: 0,
    ativo: true
  });

  const beneficioSelecionado = catalogo.find(c => c.id === form.beneficio_id);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (form.quem_paga === 'COMPARTILHADO') {
      const soma = (form.perc_empresa || 0) + (form.perc_funcionario || 0);
      if (Math.abs(soma - 100) > 0.01) {
        toast.error('Percentuais empresa + funcionário devem somar 100%');
        return;
      }
    }

    onSave(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Benefício</Label>
        <Select value={form.beneficio_id} onValueChange={(v) => {
          const cat = catalogo.find(c => c.id === v);
          setForm({
            ...form,
            beneficio_id: v,
            tipo_calculo: cat?.tipo_calculo || 'FIXO',
            valor_mensal: cat?.valor_padrao || 0,
            quem_paga: cat?.quem_paga_padrao || 'EMPRESA'
          });
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {catalogo.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Tipo de Cálculo</Label>
        <Select value={form.tipo_calculo} onValueChange={(v) => setForm({ ...form, tipo_calculo: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="FIXO">Valor Fixo Mensal</SelectItem>
            <SelectItem value="POR_DIA">Por Dia Trabalhado</SelectItem>
            <SelectItem value="PERCENTUAL">Percentual do Salário</SelectItem>
            <SelectItem value="MANUAL">Manual (variável)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.tipo_calculo === 'FIXO' && (
        <div>
          <Label>Valor Mensal (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor_mensal}
            onChange={(e) => setForm({ ...form, valor_mensal: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      {form.tipo_calculo === 'POR_DIA' && (
        <div>
          <Label>Valor por Dia (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor_por_dia}
            onChange={(e) => setForm({ ...form, valor_por_dia: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      {form.tipo_calculo === 'PERCENTUAL' && (
        <div>
          <Label>Percentual (%)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.percentual}
            onChange={(e) => setForm({ ...form, percentual: parseFloat(e.target.value) || 0 })}
          />
        </div>
      )}

      <div>
        <Label>Quem Paga</Label>
        <Select value={form.quem_paga} onValueChange={(v) => setForm({ ...form, quem_paga: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EMPRESA">Empresa (100%)</SelectItem>
            <SelectItem value="FUNCIONARIO">Funcionário (100%)</SelectItem>
            <SelectItem value="COMPARTILHADO">Compartilhado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {form.quem_paga === 'COMPARTILHADO' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>% Empresa</Label>
            <Input
              type="number"
              step="1"
              value={form.perc_empresa}
              onChange={(e) => setForm({ ...form, perc_empresa: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label>% Funcionário</Label>
            <Input
              type="number"
              step="1"
              value={form.perc_funcionario}
              onChange={(e) => setForm({ ...form, perc_funcionario: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}