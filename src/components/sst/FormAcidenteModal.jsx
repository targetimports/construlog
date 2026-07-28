import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

const VAZIO = {
  colaborador_id: '', obra_id: '', data_hora: '', gravidade: 'leve', tipo: 'tipico',
  descricao: '', local_corpo: '', cat_emitida: false,
};

// datetime-local quer "yyyy-MM-ddTHH:mm"
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FormAcidenteModal({ open, onClose, acidente, colaboradores = [], obras = [] }) {
  const qc = useQueryClient();
  const isEdit = !!acidente?.id;
  const [form, setForm] = useState(VAZIO);

  useEffect(() => {
    if (!open) return;
    setForm(isEdit
      ? { ...VAZIO, ...acidente, data_hora: toLocalInput(acidente.data_hora) }
      : { ...VAZIO, data_hora: toLocalInput(new Date().toISOString()) });
  }, [open, acidente?.id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, data_hora: form.data_hora ? new Date(form.data_hora).toISOString() : null };
      return isEdit
        ? base44.entities.AcidenteTrabalho.update(acidente.id, payload)
        : base44.entities.AcidenteTrabalho.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acidentes'] });
      toast.success(isEdit ? 'Acidente atualizado!' : 'Acidente registrado!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const salvar = () => {
    if (!form.colaborador_id) { toast.error('Selecione o colaborador'); return; }
    if (!form.data_hora) { toast.error('Informe a data/hora do acidente'); return; }
    if (!form.descricao.trim()) { toast.error('Descreva o acidente'); return; }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Acidente' : 'Registrar Acidente'}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Colaborador *</Label>
            <ComboboxBusca
              options={colaboradores.filter((c) => (c.status || 'ativo') !== 'inativo').map((c) => ({ value: c.id, label: c.cargo ? `${c.nome} (${c.cargo})` : c.nome }))}
              value={form.colaborador_id}
              onSelect={(v) => set('colaborador_id', v)}
              placeholder="Selecione o colaborador"
              searchPlaceholder="Buscar colaborador..."
              emptyMessage="Nenhum colaborador."
            />
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
            <ComboboxBusca
              options={obras.filter((o) => !['encerrada', 'cancelada'].includes(o.status)).map((o) => ({ value: o.id, label: o.nome }))}
              value={form.obra_id}
              onSelect={(v) => set('obra_id', v)}
              placeholder="Selecione a obra (opcional)"
              searchPlaceholder="Buscar obra..."
              emptyMessage="Nenhuma obra."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Data/Hora *</Label>
              <Input type="datetime-local" className="h-11" value={form.data_hora} onChange={(e) => set('data_hora', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Gravidade *</Label>
              <Select value={form.gravidade} onValueChange={(v) => set('gravidade', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderado">Moderado</SelectItem>
                  <SelectItem value="grave">Grave</SelectItem>
                  <SelectItem value="fatal">Fatal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tipico">Típico</SelectItem>
                  <SelectItem value="trajeto">Trajeto</SelectItem>
                  <SelectItem value="doenca_ocupacional">Doença ocupacional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Parte do corpo</Label>
              <Input className="h-11" value={form.local_corpo} onChange={(e) => set('local_corpo', e.target.value)} placeholder="Ex: mão direita" />
            </div>
          </div>

          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Descrição *</Label>
            <Textarea rows={3} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="O que aconteceu, causas e providências..." />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={!!form.cat_emitida} onChange={(e) => set('cat_emitida', e.target.checked)} className="w-4 h-4" />
            CAT (Comunicação de Acidente de Trabalho) emitida
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={salvar} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {mutation.isPending ? 'Salvando...' : (isEdit ? 'Salvar' : 'Registrar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
