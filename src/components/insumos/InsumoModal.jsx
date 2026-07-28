import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const UNIDADES = [
  { value: 'm', label: 'Metro (m)' }, { value: 'm2', label: 'Metro Quadrado (m²)' }, { value: 'm3', label: 'Metro Cúbico (m³)' },
  { value: 'un', label: 'Unidade (un)' }, { value: 'kg', label: 'Quilograma (kg)' }, { value: 'l', label: 'Litro (L)' },
  { value: 'sc', label: 'Saco (sc)' }, { value: 'cx', label: 'Caixa (cx)' }, { value: 'h', label: 'Hora (h)' },
  { value: 'dia', label: 'Dia' }, { value: 'mes', label: 'Mês' }, { value: 't', label: 'Tonelada (t)' }, { value: 'vb', label: 'Viagem (vb)' },
];
const GRUPOS = [
  { value: 'material', label: 'Material' }, { value: 'mao_obra', label: 'Mão de Obra' }, { value: 'equipamento', label: 'Equipamento' },
  { value: 'servico', label: 'Serviço' }, { value: 'outros', label: 'Outros' },
];
const BASES = [{ value: 'sinapi', label: 'SINAPI' }, { value: 'propria', label: 'Base Própria' }, { value: 'fornecedor', label: 'Fornecedor' }];

const hoje = () => new Date().toISOString().split('T')[0];
const EMPTY = {
  codigo: '', descricao: '', unidade: 'un', grupo: 'material', tipo: 'material', base: 'propria',
  preco_unitario: '', data_preco: hoje(), ativo: true, salario: '', encargos_percentual: '', beneficios: '', observacoes: '',
};

export default function InsumoModal({ open, onClose, insumo }) {
  const qc = useQueryClient();
  const isEdit = !!insumo?.id;
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(isEdit ? { ...EMPTY, ...insumo } : { ...EMPTY, data_preco: hoje() });
      setErrors({});
    }
  }, [open, insumo?.id]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value, ...(field === 'grupo' ? { tipo: value } : {}) }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: null }));
  };

  const isMaoObra = form.grupo === 'mao_obra';
  const custoMaoObra = (parseFloat(form.salario) || 0) + ((parseFloat(form.salario) || 0) * (parseFloat(form.encargos_percentual) || 0) / 100) + (parseFloat(form.beneficios) || 0);

  const mutation = useMutation({
    mutationFn: () => {
      const data = { ...form };
      if (isMaoObra) {
        data.custo_total_mao_obra = custoMaoObra;
        data.preco_unitario = custoMaoObra;
      } else {
        data.preco_unitario = Number(data.preco_unitario) || 0;
      }
      return isEdit ? base44.entities.Insumo.update(insumo.id, data) : base44.entities.Insumo.create(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insumos'] });
      toast.success(isEdit ? 'Insumo atualizado com sucesso' : 'Insumo criado com sucesso');
      onClose();
    },
    onError: (e) => toast.error('Erro ao salvar insumo: ' + (e?.message || 'tente novamente')),
  });

  const validar = () => {
    const e = {};
    if (!form.codigo?.trim()) e.codigo = 'Código é obrigatório';
    if (!form.descricao?.trim()) e.descricao = 'Descrição é obrigatória';
    if (isMaoObra) { if (!(parseFloat(form.salario) > 0)) e.salario = 'Informe o salário'; }
    else if (!(Number(form.preco_unitario) >= 0) || form.preco_unitario === '') e.preco_unitario = 'Informe o custo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const salvar = () => {
    if (validar()) mutation.mutate();
    else toast.error('Verifique os campos destacados.');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Insumo' : 'Novo Insumo'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Código + Unidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-600">Código *</Label>
              <Input value={form.codigo} onChange={(e) => set('codigo', e.target.value)} placeholder="Ex: MAT-001" className={`h-11 mt-1 ${errors.codigo ? 'border-red-400' : ''}`} />
              {errors.codigo && <p className="text-xs text-red-500 mt-1">{errors.codigo}</p>}
            </div>
            <div>
              <Label className="text-xs text-gray-600">Unidade *</Label>
              <div className="mt-1">
                <ComboboxBusca options={UNIDADES} value={form.unidade} onSelect={(v) => set('unidade', v)} placeholder="Selecionar unidade" searchPlaceholder="Buscar unidade..." />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label className="text-xs text-gray-600">Descrição *</Label>
            <Input value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descreva o insumo" className={`h-11 mt-1 ${errors.descricao ? 'border-red-400' : ''}`} />
            {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
          </div>

          {/* Grupo + Base + Ativo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-gray-600">Grupo *</Label>
              <Select value={form.grupo} onValueChange={(v) => set('grupo', v)}>
                <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{GRUPOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Base de Preço *</Label>
              <Select value={form.base} onValueChange={(v) => set('base', v)}>
                <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{BASES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-gray-600">Status</Label>
              <button type="button" onClick={() => set('ativo', !form.ativo)} className="flex items-center gap-2 h-11 mt-1 text-sm font-medium text-gray-700">
                {form.ativo ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6 text-gray-400" />}
                {form.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          </div>

          {/* Preço (não mão de obra) */}
          {!isMaoObra && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-600">Custo Unitário (R$) *</Label>
                <Input type="number" step="0.01" min="0" value={form.preco_unitario} onChange={(e) => set('preco_unitario', e.target.value)} placeholder="0,00" className={`h-11 mt-1 ${errors.preco_unitario ? 'border-red-400' : ''}`} />
                {errors.preco_unitario && <p className="text-xs text-red-500 mt-1">{errors.preco_unitario}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">Data do Preço</Label>
                <Input type="date" value={form.data_preco} onChange={(e) => set('data_preco', e.target.value)} className="h-11 mt-1" />
              </div>
            </div>
          )}

          {/* Mão de obra */}
          {isMaoObra && (
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-600">Cálculo de Mão de Obra</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Salário (R$) *</Label>
                  <Input type="number" step="0.01" min="0" value={form.salario} onChange={(e) => set('salario', e.target.value)} placeholder="0,00" className={`h-11 mt-1 ${errors.salario ? 'border-red-400' : ''}`} />
                  {errors.salario && <p className="text-xs text-red-500 mt-1">{errors.salario}</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Encargos (%)</Label>
                  <Input type="number" step="0.01" min="0" value={form.encargos_percentual} onChange={(e) => set('encargos_percentual', e.target.value)} placeholder="0" className="h-11 mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Benefícios (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.beneficios} onChange={(e) => set('beneficios', e.target.value)} placeholder="0,00" className="h-11 mt-1" />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-semibold text-blue-900">Custo Unitário total: {custoMaoObra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-xs text-gray-600">Observações</Label>
            <Textarea value={form.observacoes || ''} onChange={(e) => set('observacoes', e.target.value)} placeholder="Adicione notas sobre este insumo..." rows={3} className="mt-1" />
          </div>
        </div>

        <DialogFooter className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} className="border-gray-300 text-gray-700">Cancelar</Button>
          <Button onClick={salvar} disabled={mutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {mutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
