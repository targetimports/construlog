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

const TIPOS = [
  { value: 'ADIANTAMENTO', label: 'Adiantamento' },
  { value: 'MEDICAO', label: 'Medição' },
  { value: 'PARCELA', label: 'Parcela' },
  { value: 'OUTRO', label: 'Outro' }
];

// 'Recebido' NÃO entra aqui de propósito: recebido só pelo botão ✓ (Confirmar
// Recebimento), que credita o caixa. Marcar aqui seria só rótulo, sem entrada real.
// 'Atrasado' é derivado automaticamente pela data prevista.
const STATUS = [
  { value: 'PREVISTO', label: 'Previsto' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'CANCELADO', label: 'Cancelado' }
];

export default function RecebimentoPrevistoForm({ open, onOpenChange, obraId, recebimento = null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    descricao: '',
    data_prevista: '',
    valor_previsto: '',
    tipo: 'PARCELA',
    status: 'PREVISTO',
    observacao: ''
  });

  useEffect(() => {
    if (recebimento) {
      setForm({
        descricao: recebimento.descricao || '',
        data_prevista: recebimento.data_prevista || '',
        valor_previsto: recebimento.valor_previsto || '',
        tipo: recebimento.tipo || 'PARCELA',
        status: recebimento.status || 'PREVISTO',
        observacao: recebimento.observacao || ''
      });
    } else {
      setForm({ descricao: '', data_prevista: '', valor_previsto: '', tipo: 'PARCELA', status: 'PREVISTO', observacao: '' });
    }
  }, [recebimento, open]);

  const [errors, setErrors] = useState({});
  useEffect(() => { setErrors({}); }, [open, recebimento]);

  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }));
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

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RecebimentoPrevisto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos-previstos', obraId] });
      toast.success('Recebimento criado!');
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.RecebimentoPrevisto.update(recebimento.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recebimentos-previstos', obraId] });
      toast.success('Recebimento atualizado!');
      onOpenChange(false);
    },
    onError: (e) => toast.error(`Erro: ${e.message}`)
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    const data = {
      obra_id: obraId,
      descricao: form.descricao.trim(),
      data_prevista: form.data_prevista,
      valor_previsto: Number(form.valor_previsto),
      tipo: form.tipo,
      status: form.status,
      observacao: form.observacao.trim() || null
    };

    if (recebimento) updateMutation.mutate(data);
    else createMutation.mutate(data);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white border-gray-200 max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="text-gray-900">
            {recebimento ? 'Editar Recebimento' : 'Novo Recebimento Previsto'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-gray-700 text-xs font-semibold">Descrição *</Label>
            <Input
              value={form.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Ex: Medição nº 3 – Etapa Estrutura"
              className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('descricao')}`}
              disabled={isLoading}
            />
            {errors.descricao && <p className="text-xs text-red-600 mt-1">{errors.descricao}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)} disabled={isLoading}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v)} disabled={isLoading}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-gray-400 mt-1">"Recebido" é definido ao confirmar o recebimento (botão ✓), que credita o caixa.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Data Prevista *</Label>
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => set('data_prevista', e.target.value)}
                className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('data_prevista')}`}
                disabled={isLoading}
              />
              {errors.data_prevista && <p className="text-xs text-red-600 mt-1">{errors.data_prevista}</p>}
            </div>
            <div>
              <Label className="text-gray-700 text-xs font-semibold">Valor Previsto (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.valor_previsto}
                onChange={(e) => set('valor_previsto', e.target.value)}
                placeholder="0,00"
                className={`bg-white border-gray-300 text-gray-900 mt-1 ${cls('valor_previsto')}`}
                disabled={isLoading}
              />
              {errors.valor_previsto && <p className="text-xs text-red-600 mt-1">{errors.valor_previsto}</p>}
            </div>
          </div>

          <div>
            <Label className="text-gray-700 text-xs font-semibold">Observação</Label>
            <Textarea
              value={form.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              placeholder="Observações adicionais..."
              className="bg-white border-gray-300 text-gray-900 mt-1"
              rows={2}
              disabled={isLoading}
            />
          </div>
        </form>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto border-gray-300 text-gray-700" disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 gap-2" disabled={isLoading}>
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            {recebimento ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}