import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Loader2, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const CATEGORIAS = [
  { value: 'recebimento_cliente', label: 'Recebimento de Cliente' },
  { value: 'pagamento_fornecedor', label: 'Pagamento a Fornecedor' },
  { value: 'transferencia_interna', label: 'Transferência Interna' },
  { value: 'adiantamento', label: 'Adiantamento' },
  { value: 'reembolso', label: 'Reembolso' },
  { value: 'aporte', label: 'Aporte/Capital' },
  { value: 'resgate', label: 'Resgate' },
  { value: 'taxa_bancaria', label: 'Taxa Bancária' },
  { value: 'imposto', label: 'Imposto' },
  { value: 'outro', label: 'Outro' },
];

const FORMAS = [
  { value: 'pix', label: 'PIX' },
  { value: 'ted', label: 'TED' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
  { value: 'debito_automatico', label: 'Débito Automático' },
  { value: 'outro', label: 'Outro' },
];

const META = {
  entrada: { titulo: 'Nova Entrada', Icon: ArrowDownCircle, cor: 'text-green-600', btn: 'bg-green-600 hover:bg-green-700' },
  saida: { titulo: 'Nova Saída', Icon: ArrowUpCircle, cor: 'text-red-600', btn: 'bg-red-600 hover:bg-red-700' },
  transferencia: { titulo: 'Nova Transferência', Icon: ArrowLeftRight, cor: 'text-blue-600', btn: 'bg-blue-600 hover:bg-blue-700' },
};

export default function FormMovimentacao({ open, onClose, tipo, contas = [], obras = [], onSubmit, saving }) {
  const [form, setForm] = useState({
    conta_id: '', conta_destino_id: '', valor: '', data_movimentacao: new Date().toISOString().split('T')[0],
    categoria: tipo === 'entrada' ? 'recebimento_cliente' : tipo === 'saida' ? 'pagamento_fornecedor' : 'transferencia_interna',
    descricao: '', obra_id: '', forma_pagamento: 'pix', numero_documento: '',
  });

  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!form.conta_id) e.conta_id = isTransf ? 'Selecione a conta de origem' : 'Selecione a conta';
    if (isTransf) {
      if (!form.conta_destino_id) e.conta_destino_id = 'Selecione a conta de destino';
      else if (form.conta_destino_id === form.conta_id) e.conta_destino_id = 'Origem e destino devem ser diferentes';
    }
    if (!(parseFloat(form.valor) > 0)) e.valor = 'Informe um valor maior que zero';
    if (!form.data_movimentacao) e.data_movimentacao = 'Informe a data';
    if (!form.descricao?.trim()) e.descricao = 'Descreva a movimentação';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    onSubmit({ ...form, tipo, valor: parseFloat(form.valor) || 0 });
  };

  const meta = META[tipo] || META.entrada;
  const isTransf = tipo === 'transferencia';
  const contasAtivas = contas.filter(c => !c.status || c.status === 'ativa');
  const optContas = (excluir) => contasAtivas
    .filter(c => c.id !== excluir)
    .map(c => ({ value: c.id, label: `${c.nome} — ${fmt(c.saldo_atual)}` }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <meta.Icon className={`w-5 h-5 ${meta.cor}`} /> {meta.titulo}
          </DialogTitle>
        </DialogHeader>
        {/* noValidate: quem valida é o `validar()`, com mensagem no campo. Sem isto o
            balão nativo do navegador (ex.: min do input) barra o submit antes e o
            usuário vê um aviso fora do padrão do sistema. */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={isTransf ? '' : 'sm:col-span-2'}>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Conta {isTransf ? 'origem' : ''} *</Label>
              <ComboboxBusca
                options={optContas(form.conta_destino_id)}
                value={form.conta_id}
                onSelect={(v) => set('conta_id', v || '')}
                placeholder="Selecione"
                searchPlaceholder="Buscar conta..."
                emptyMessage="Nenhuma conta."
                className={errors.conta_id ? 'border-red-400' : ''}
              />
              {errors.conta_id && <p className="text-xs text-red-500 mt-1">{errors.conta_id}</p>}
            </div>
            {isTransf && (
              <div>
                <Label className="mb-1 block text-sm font-medium text-gray-700">Conta destino *</Label>
                <ComboboxBusca
                  options={optContas(form.conta_id)}
                  value={form.conta_destino_id}
                  onSelect={(v) => set('conta_destino_id', v || '')}
                  placeholder="Selecione"
                  searchPlaceholder="Buscar conta..."
                  emptyMessage="Nenhuma conta."
                  className={errors.conta_destino_id ? 'border-red-400' : ''}
                />
                {errors.conta_destino_id && <p className="text-xs text-red-500 mt-1">{errors.conta_destino_id}</p>}
              </div>
            )}

            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Valor (R$) *</Label>
              <Input className={`h-11 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00" />
              {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Data *</Label>
              <Input className={`h-11 ${errors.data_movimentacao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="date" value={form.data_movimentacao} onChange={(e) => set('data_movimentacao', e.target.value)} />
              {errors.data_movimentacao && <p className="text-xs text-red-500 mt-1">{errors.data_movimentacao}</p>}
            </div>

            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => set('categoria', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Forma de pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => set('forma_pagamento', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Obra (opcional)</Label>
              <ComboboxBusca
                options={[{ value: '__none__', label: 'Nenhuma' }, ...obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))]}
                value={form.obra_id || '__none__'}
                onSelect={(v) => set('obra_id', v === '__none__' ? '' : (v || ''))}
                placeholder="Nenhuma"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>
            <div>
              <Label className="mb-1 block text-sm font-medium text-gray-700">Nº documento</Label>
              <Input className="h-11" value={form.numero_documento} onChange={(e) => set('numero_documento', e.target.value)} placeholder="NF, cheque, etc" />
            </div>

            <div className="sm:col-span-2">
              <Label className="mb-1 block text-sm font-medium text-gray-700">Descrição *</Label>
              <Textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descreva a movimentação" rows={2}
                className={errors.descricao ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
            {/* Sempre habilitado: a validação diz o que falta, em vez de o botão ficar morto. */}
            <Button type="submit" className={`${meta.btn} gap-2 w-full sm:w-auto`} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar {meta.titulo.replace('Nova ', '')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
