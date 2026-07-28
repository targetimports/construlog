import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

export default function FormApontamentoHoraModal({ apontamento, onSave, onClose }) {
  const isEdit = !!apontamento;
  const [formData, setFormData] = useState(apontamento || {
    obra_id: '',
    colaborador_id: '',
    data: '',
    horas_normais: 0,
    horas_extras: 0,
    observacao: ''
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('nome', 100),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 5000),
  });

  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setFormData((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!formData.obra_id) e.obra_id = 'Selecione a obra';
    if (!formData.colaborador_id) e.colaborador_id = 'Selecione o colaborador';

    if (!formData.data) e.data = 'Informe a data';
    else if (formData.data > new Date().toISOString().split('T')[0]) e.data = 'A data não pode ser futura';

    const normais = Number(formData.horas_normais) || 0;
    const extras = Number(formData.horas_extras) || 0;
    if (normais < 0) e.horas_normais = 'Horas não podem ser negativas';
    if (extras < 0) e.horas_extras = 'Horas não podem ser negativas';
    // Apontamento zerado não vira nada na folha nem no custo da obra — só ruído.
    if (normais + extras <= 0) e.horas_normais = 'Informe as horas trabalhadas';
    else if (normais + extras > 24) e.horas_normais = 'Total não pode passar de 24h no dia';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    onSave(formData);
  };

  const obraNome = obras.find((o) => o.id === formData.obra_id)?.nome || '';
  const colabNome = colaboradores.find((c) => c.id === formData.colaborador_id)?.nome || '';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Apontamento' : 'Novo Apontamento de Horas'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Obra *</Label>
            {isEdit ? (
              <Input value={obraNome} disabled className="h-11 bg-gray-50" />
            ) : (
              <ComboboxBusca
                options={obras.map((o) => ({ value: o.id, label: o.nome }))}
                value={formData.obra_id}
                onSelect={(v) => set('obra_id', v)}
                placeholder="Selecione a obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra encontrada."
                className={errors.obra_id ? 'border-red-400' : ''}
              />
            )}
            {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Colaborador *</Label>
            {isEdit ? (
              <Input value={colabNome} disabled className="h-11 bg-gray-50" />
            ) : (
              <ComboboxBusca
                options={colaboradores.map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }))}
                value={formData.colaborador_id}
                onSelect={(v) => set('colaborador_id', v)}
                placeholder="Selecione o colaborador"
                searchPlaceholder="Buscar colaborador..."
                emptyMessage="Nenhum colaborador encontrado."
                className={errors.colaborador_id ? 'border-red-400' : ''}
              />
            )}
            {errors.colaborador_id && <p className="text-xs text-red-500 mt-1">{errors.colaborador_id}</p>}
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Data *</Label>
            <Input
              type="date"
              value={formData.data}
              onChange={(e) => set('data', e.target.value)}
              disabled={isEdit}
              className={`h-11 ${isEdit ? 'bg-gray-50' : ''} ${errors.data ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.data && <p className="text-xs text-red-500 mt-1">{errors.data}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Horas Normais *</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={formData.horas_normais}
                onChange={(e) => { set('horas_normais', parseFloat(e.target.value) || 0); setErrors((p) => ({ ...p, horas_extras: null })); }}
                className={`h-11 ${errors.horas_normais ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Horas Extras</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={formData.horas_extras}
                onChange={(e) => { set('horas_extras', parseFloat(e.target.value) || 0); setErrors((p) => ({ ...p, horas_normais: null })); }}
                className={`h-11 ${errors.horas_extras ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
            </div>
            {(errors.horas_normais || errors.horas_extras) && (
              <p className="text-xs text-red-500 sm:col-span-2 -mt-1">{errors.horas_normais || errors.horas_extras}</p>
            )}
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Observação</Label>
            <Textarea
              rows={3}
              value={formData.observacao || ''}
              onChange={(e) => set('observacao', e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
