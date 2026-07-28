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
  descricao_problema: '', acao_proposta: '', prioridade: 'media',
  responsavel: '', prazo: '', status: 'aberta', obra_id: '',
};

export default function FormAcaoCorretivaModal({ open, onClose, acao, obras = [] }) {
  const qc = useQueryClient();
  const isEdit = !!acao?.id;
  const [form, setForm] = useState(VAZIO);

  useEffect(() => {
    if (!open) return;
    setForm(isEdit ? { ...VAZIO, ...acao } : VAZIO);
  }, [open, acao?.id]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => isEdit
      ? base44.entities.AcaoCorretiva.update(acao.id, { ...form })
      : base44.entities.AcaoCorretiva.create({ ...form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acoes-corretivas'] });
      toast.success(isEdit ? 'Ação atualizada!' : 'Ação registrada!');
      onClose();
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const salvar = () => {
    if (!form.descricao_problema.trim()) { toast.error('Descreva o problema'); return; }
    if (!form.acao_proposta.trim()) { toast.error('Descreva a ação proposta'); return; }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? 'Editar Ação Corretiva' : 'Nova Ação Corretiva'}</DialogTitle></DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Problema identificado *</Label>
            <Textarea rows={2} value={form.descricao_problema} onChange={(e) => set('descricao_problema', e.target.value)} placeholder="O que está errado / risco identificado" />
          </div>
          <div>
            <Label className="text-xs text-gray-600 mb-1 block">Ação proposta *</Label>
            <Textarea rows={2} value={form.acao_proposta} onChange={(e) => set('acao_proposta', e.target.value)} placeholder="O que será feito para corrigir" />
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
              <Label className="text-xs text-gray-600 mb-1 block">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => set('prioridade', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="critica">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Aberta</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Responsável</Label>
              <Input className="h-11" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} placeholder="Nome do responsável" />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Prazo</Label>
              <Input type="date" className="h-11" value={form.prazo} onChange={(e) => set('prazo', e.target.value)} />
            </div>
          </div>
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
