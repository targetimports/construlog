import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DollarSign } from 'lucide-react';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const FORMAS_PAGAMENTO = [
  { value: 'pix', label: 'PIX' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao', label: 'Cartão' },
];

export default function DialogBaixaRecebimento({ open, onClose, conta, onConfirm }) {
  const valorTotal = conta?.valor || 0;
  const valorJaRecebido = conta?.valor_recebido || 0;
  const valorRestante = valorTotal - valorJaRecebido;

  const [formData, setFormData] = useState({
    data_pagamento: new Date().toISOString().split('T')[0],
    valor_recebido: valorRestante,
    forma_pagamento: 'pix',
    observacao: ''
  });

  const [errors, setErrors] = useState({});

  // Sem isso o formulário guarda o valor da conta anterior: o estado inicial só é
  // calculado na montagem e o modal fica montado entre uma baixa e outra.
  useEffect(() => {
    if (!open) return;
    setFormData({
      data_pagamento: new Date().toISOString().split('T')[0],
      valor_recebido: valorRestante,
      forma_pagamento: 'pix',
      observacao: '',
    });
    setErrors({});
  }, [open, conta?.id, valorRestante]);

  const set = (k, v) => {
    setFormData(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const validar = () => {
    const e = {};
    const hoje = new Date().toISOString().split('T')[0];
    const valor = parseFloat(formData.valor_recebido);

    if (!formData.data_pagamento) e.data_pagamento = 'Informe a data do recebimento';
    else if (formData.data_pagamento > hoje) e.data_pagamento = 'A data não pode ser futura';

    if (!(valor > 0)) e.valor_recebido = 'Informe um valor maior que zero';
    // Tolerância de 1 centavo para não travar por arredondamento.
    else if (valor > valorRestante + 0.005) e.valor_recebido = `Máximo ${fmtBRL(valorRestante)}`;

    if (!formData.forma_pagamento) e.forma_pagamento = 'Selecione a forma de recebimento';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    onConfirm({
      ...formData,
      valor_recebido: parseFloat(formData.valor_recebido)
    });
  };

  const novoTotalRecebido = valorJaRecebido + (parseFloat(formData.valor_recebido) || 0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-600" /> Dar Baixa em Recebimento
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Resumo da Conta */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Valor Total:</span>
              <span className="font-bold tabular-nums">{fmtBRL(valorTotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Já Recebido:</span>
              <span className="font-bold text-green-600 tabular-nums">{fmtBRL(valorJaRecebido)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-blue-300 pt-2">
              <span className="text-gray-600 font-medium">Valor Restante:</span>
              <span className="font-bold text-blue-600 tabular-nums">{fmtBRL(valorRestante)}</span>
            </div>
          </div>

          {/* Data + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data do Recebimento <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formData.data_pagamento}
                onChange={(e) => set('data_pagamento', e.target.value)}
                className={`mt-1 ${errors.data_pagamento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errors.data_pagamento && <p className="text-xs text-red-500 mt-1">{errors.data_pagamento}</p>}
            </div>
            <div>
              <Label>Valor Recebido <span className="text-red-500">*</span></Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm text-gray-500">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor_recebido}
                  onChange={(e) => set('valor_recebido', e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className={`pl-9 ${errors.valor_recebido ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
              </div>
              {errors.valor_recebido
                ? <p className="text-xs text-red-500 mt-1">{errors.valor_recebido}</p>
                : <p className="text-xs text-gray-500 mt-1">Máximo: {fmtBRL(valorRestante)}</p>}
            </div>
          </div>

          {/* Forma Pagamento */}
          <div>
            <Label>Forma de Recebimento <span className="text-red-500">*</span></Label>
            <div className="mt-1">
              <ComboboxBusca
                options={FORMAS_PAGAMENTO}
                value={formData.forma_pagamento}
                onSelect={(v) => set('forma_pagamento', v)}
                placeholder="Selecionar forma..."
                searchPlaceholder="Buscar forma..."
                className={errors.forma_pagamento ? 'border-red-400' : ''}
              />
            </div>
            {errors.forma_pagamento && <p className="text-xs text-red-500 mt-1">{errors.forma_pagamento}</p>}
          </div>

          {/* Observação */}
          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacao}
              onChange={(e) => set('observacao', e.target.value)}
              placeholder="Observações sobre este recebimento..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Preview do resultado */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
            <p className="text-gray-600">Após esta baixa:</p>
            <div className="flex justify-between">
              <span className="text-gray-700">Novo total recebido:</span>
              <span className="font-bold tabular-nums">{fmtBRL(novoTotalRecebido)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Novo status:</span>
              <span className="font-bold">
                {novoTotalRecebido >= valorTotal ?
                  <span className="text-green-600">RECEBIDO</span> :
                  <span className="text-yellow-600">PARCIAL</span>
                }
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-green-600 hover:bg-green-700">
              Confirmar Recebimento
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
