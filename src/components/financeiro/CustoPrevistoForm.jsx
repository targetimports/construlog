import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';

const CATEGORIAS = [
  { value: 'material', label: 'Material' },
  { value: 'mao_de_obra', label: 'Mão de obra' },
  { value: 'servico', label: 'Serviços' },
  { value: 'equipamento', label: 'Equipamentos' },
  { value: 'locacao', label: 'Locação' },
  { value: 'frota', label: 'Frota' },
  { value: 'outro', label: 'Outros' },
];

const STATUS = [
  { value: 'PREVISTO', label: 'Previsto' },
  { value: 'COMPROMETIDO', label: 'Comprometido' },
  { value: 'PAGO', label: 'Pago' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export default function CustoPrevistoForm({ open, onOpenChange, obraId, custo = null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    descricao: '',
    categoria: 'material',
    etapa: '',
    data_prevista: '',
    valor_previsto: '',
    status: 'PREVISTO',
    observacao: '',
  });

  useEffect(() => {
    if (custo) {
      setForm({
        descricao: custo.descricao || '',
        categoria: custo.categoria || 'material',
        etapa: custo.etapa || '',
        data_prevista: custo.data_prevista || '',
        valor_previsto: custo.valor_previsto ?? custo.valor_estimado ?? '',
        status: custo.status || 'PREVISTO',
        observacao: custo.observacao || '',
      });
    } else {
      setForm({ descricao: '', categoria: 'material', etapa: '', data_prevista: '', valor_previsto: '', status: 'PREVISTO', observacao: '' });
    }
  }, [custo, open]);

  const [errors, setErrors] = useState({});
  useEffect(() => { setErrors({}); }, [open, custo]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors(e => (e[field] ? { ...e, [field]: undefined } : e));
  };
  const cls = (campo) => (errors[campo] ? 'border-red-400 focus-visible:ring-red-400' : '');

  const validar = () => {
    const e = {};
    if (!form.descricao.trim()) e.descricao = 'Informe a descrição.';
    if (!form.data_prevista) e.data_prevista = 'Informe a data prevista.';
    if (!(Number(form.valor_previsto) > 0)) e.valor_previsto = 'Informe um valor maior que zero.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['custos-previstos', obraId] });
    queryClient.invalidateQueries({ queryKey: ['viabilidade-obra', obraId] });
  };

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PlannedCostItem.create(data),
    onSuccess: () => { invalidate(); toast.success('Custo previsto criado!'); onOpenChange(false); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.PlannedCostItem.update(custo.id, data),
    onSuccess: () => { invalidate(); toast.success('Custo previsto atualizado!'); onOpenChange(false); },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    const data = {
      obra_id: obraId,
      descricao: form.descricao.trim(),
      categoria: form.categoria,
      etapa: form.etapa.trim() || null,
      data_prevista: form.data_prevista,
      // Mantém valor_previsto e valor_estimado iguais p/ compatibilidade com as
      // funções que leem PlannedCostItem (validarInicioObra/simularViabilidadeObra).
      valor_previsto: Number(form.valor_previsto),
      valor_estimado: Number(form.valor_previsto),
      status: form.status,
      observacao: form.observacao.trim() || null,
    };

    if (custo) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-gray-900">{custo ? 'Editar Custo Previsto' : 'Novo Custo Previsto'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-700 text-xs font-semibold">Descrição *</Label>
            <Input value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Ex: Concreto usinado - Fundações" className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('descricao')}`} disabled={isLoading} />
            {errors.descricao && <p className="text-xs text-red-600 mt-1">{errors.descricao}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set('categoria', v)} disabled={isLoading}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)} disabled={isLoading}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Data Prevista *</Label>
              <Input type="date" value={form.data_prevista} onChange={(e) => set('data_prevista', e.target.value)} className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('data_prevista')}`} disabled={isLoading} />
              {errors.data_prevista && <p className="text-xs text-red-600 mt-1">{errors.data_prevista}</p>}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Valor Previsto (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor_previsto} onChange={(e) => set('valor_previsto', e.target.value)} placeholder="0,00" className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('valor_previsto')}`} disabled={isLoading} />
              {errors.valor_previsto && <p className="text-xs text-red-600 mt-1">{errors.valor_previsto}</p>}
            </div>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Etapa <span className="text-gray-400 font-normal">(opcional)</span></Label>
            <Input value={form.etapa} onChange={(e) => set('etapa', e.target.value)} placeholder="Ex: Fundações" className="bg-white border-gray-300 text-gray-900 mt-1" disabled={isLoading} />
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Observação</Label>
            <Textarea value={form.observacao} onChange={(e) => set('observacao', e.target.value)} placeholder="Observações adicionais..." className="bg-white border-gray-300 text-gray-900 mt-1" rows={2} disabled={isLoading} />
          </div>
        </form>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto border-gray-300 text-gray-700" disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 gap-2" disabled={isLoading}>
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            {custo ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
