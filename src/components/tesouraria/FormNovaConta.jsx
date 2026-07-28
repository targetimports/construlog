import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'caixa', label: 'Caixa' },
  { value: 'banco_corrente', label: 'Banco — Conta Corrente' },
  { value: 'banco_poupanca', label: 'Banco — Poupança' },
  { value: 'banco_investimento', label: 'Banco — Investimento' },
  { value: 'conta_obra', label: 'Conta vinculada a Obra' },
  { value: 'conta_garantia', label: 'Conta Garantia' },
  { value: 'aplicacao', label: 'Aplicação' },
  { value: 'outro', label: 'Outro' },
];

export default function FormNovaConta({ open, onClose, conta = null, obras = [], empresas = [], podeEscolherEmpresa = false, onSubmit, saving }) {
  const editando = !!conta;
  const vazio = {
    nome: '', tipo: 'caixa', banco: '', agencia: '', numero_conta: '',
    obra_id: '', empresa_id: '', saldo_inicial: '', data_saldo_inicial: new Date().toISOString().split('T')[0],
    permite_saldo_negativo: false,
  };
  const [form, setForm] = useState(vazio);
  const [errors, setErrors] = useState({});

  // Prefill ao abrir (edição) ou limpa (novo).
  useEffect(() => {
    if (!open) return;
    setForm(conta ? {
      nome: conta.nome || '', tipo: conta.tipo || 'caixa', banco: conta.banco || '', agencia: conta.agencia || '',
      numero_conta: conta.numero_conta || '', obra_id: conta.obra_id || '', empresa_id: conta.empresa_id || '',
      saldo_inicial: conta.saldo_inicial ?? '', data_saldo_inicial: conta.data_saldo_inicial || new Date().toISOString().split('T')[0],
      permite_saldo_negativo: !!conta.permite_saldo_negativo,
    } : vazio);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta?.id]);

  const validar = () => {
    const e = {};
    if (!form.nome?.trim()) e.nome = 'Informe o nome da conta';
    // A empresa dona do caixa é o que sustenta o isolamento multi-empresa: sem ela,
    // o caixa fica órfão e some dos filtros por empresa.
    if (podeEscolherEmpresa && !form.empresa_id) e.empresa_id = 'Selecione a empresa dona do caixa';
    if (form.tipo === 'conta_obra' && !form.obra_id) e.obra_id = 'Selecione a obra vinculada';
    if (!editando && form.saldo_inicial !== '' && isNaN(parseFloat(form.saldo_inicial))) e.saldo_inicial = 'Valor inválido';
    if (!editando && !form.data_saldo_inicial) e.data_saldo_inicial = 'Informe a data do saldo inicial';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    onSubmit({ ...form, saldo_inicial: parseFloat(form.saldo_inicial) || 0, id: conta?.id });
  };

  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-gray-700">Nome da Conta *</Label>
              <Input className={`h-11 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex: Bradesco CC 1234" />
              {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
            </div>
            {podeEscolherEmpresa && (
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-sm font-medium text-gray-700">Empresa (dona do caixa) *</Label>
                <ComboboxBusca
                  options={empresas.filter((e) => e.nome || e.nome_fantasia || e.razao_social).map((e) => ({ value: e.id, label: e.nome || e.nome_fantasia || e.razao_social }))}
                  value={form.empresa_id}
                  onSelect={(v) => set('empresa_id', v || '')}
                  placeholder="Selecione a empresa"
                  searchPlaceholder="Buscar empresa..."
                  emptyMessage="Nenhuma empresa."
                  className={errors.empresa_id ? 'border-red-400' : ''}
                />
                {errors.empresa_id && <p className="text-xs text-red-500 mt-1">{errors.empresa_id}</p>}
                <p className="text-xs text-gray-400 mt-1">O caixa fica vinculado a esta empresa (usado no isolamento de pagamentos/verba).</p>
              </div>
            )}
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => set('tipo', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Banco</Label>
              <Input className="h-11" value={form.banco} onChange={(e) => set('banco', e.target.value)} placeholder="Nome do banco" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Agência</Label>
              <Input className="h-11" value={form.agencia} onChange={(e) => set('agencia', e.target.value)} placeholder="0001" />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Número da Conta</Label>
              <Input className="h-11" value={form.numero_conta} onChange={(e) => set('numero_conta', e.target.value)} placeholder="12345-6" />
            </div>
            {form.tipo === 'conta_obra' && (
              <div className="sm:col-span-2">
                <Label className="mb-1 block text-sm font-medium text-gray-700">Obra Vinculada *</Label>
                <ComboboxBusca
                  options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                  value={form.obra_id}
                  onSelect={(v) => set('obra_id', v || '')}
                  placeholder="Selecione uma obra"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra."
                  className={errors.obra_id ? 'border-red-400' : ''}
                />
                {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
              </div>
            )}
            {!editando && (
              <>
                <div>
                  <Label className="mb-1 block text-sm font-medium text-gray-700">Saldo Inicial (R$)</Label>
                  <Input className={`h-11 ${errors.saldo_inicial ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => set('saldo_inicial', e.target.value)} placeholder="0,00" />
                  {errors.saldo_inicial && <p className="text-xs text-red-500 mt-1">{errors.saldo_inicial}</p>}
                </div>
                <div>
                  <Label className="mb-1 block text-sm font-medium text-gray-700">Data do Saldo Inicial *</Label>
                  <Input className={`h-11 ${errors.data_saldo_inicial ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="date" value={form.data_saldo_inicial} onChange={(e) => set('data_saldo_inicial', e.target.value)} />
                  {errors.data_saldo_inicial && <p className="text-xs text-red-500 mt-1">{errors.data_saldo_inicial}</p>}
                </div>
              </>
            )}
            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input type="checkbox" id="saldo-neg" checked={form.permite_saldo_negativo} onChange={(e) => set('permite_saldo_negativo', e.target.checked)} className="w-4 h-4" />
              <Label htmlFor="saldo-neg" className="mb-0 cursor-pointer">Permitir saldo negativo</Label>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editando ? 'Salvar' : 'Criar Conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}