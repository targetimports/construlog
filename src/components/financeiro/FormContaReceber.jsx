import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { toast } from 'sonner';

const CATEGORIAS = [
  { value: 'medicao', label: 'Medição' },
  { value: 'servico', label: 'Serviço' },
  { value: 'material', label: 'Material' },
  { value: 'outros', label: 'Outros' },
];

const STATUS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'pago', label: 'Pago' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function FormContaReceber({ open, onClose, conta, onSave, obras, clientes }) {
  const [formData, setFormData] = useState(conta || {
    tipo: 'receber',
    descricao: '',
    valor: '',
    data_vencimento: '',
    obra_id: '',
    cliente_id: '',
    referencia_tipo: '',
    referencia_id: '',
    categoria: 'medicao',
    status: 'pendente',
    observacao: ''
  });

  const [errors, setErrors] = useState({});
  const isEdicao = !!conta?.id;

  const set = (k, v) => {
    setFormData(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const validar = () => {
    const e = {};
    if (!formData.obra_id) e.obra_id = 'Obra é obrigatória';
    if (!formData.descricao?.trim()) e.descricao = 'Descrição é obrigatória';
    if (!(parseFloat(formData.valor) > 0)) e.valor = 'Informe um valor maior que zero';
    if (!formData.data_vencimento) e.data_vencimento = 'Informe a data de vencimento';
    // Referência só faz sentido em par: sem o tipo, o ID não liga em nada.
    if (formData.referencia_id?.trim() && !formData.referencia_tipo?.trim()) {
      e.referencia_tipo = 'Informe o tipo da referência';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    onSave({
      ...formData,
      cliente_id: formData.cliente_id || null,
      valor: parseFloat(formData.valor),
      ...(isEdicao ? {} : { valor_recebido: 0 })
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdicao ? 'Editar' : 'Novo'} Título a Receber</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Obra + Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Obra <span className="text-red-500">*</span></Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={(obras || []).map((o) => ({ value: o.id, label: o.nome }))}
                  value={formData.obra_id}
                  onSelect={(v) => set('obra_id', v)}
                  placeholder="Selecionar obra..."
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada"
                  disabled={isEdicao}
                  className={errors.obra_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.obra_id && <p className="text-xs text-red-500 mt-1">{errors.obra_id}</p>}
            </div>
            <div>
              <Label>Cliente</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={[{ value: '', label: 'Nenhum' }, ...(clientes || []).map((c) => ({ value: c.id, label: c.nome || c.razao_social }))]}
                  value={formData.cliente_id || ''}
                  onSelect={(v) => setFormData({ ...formData, cliente_id: v || null })}
                  placeholder="Selecionar cliente (opcional)..."
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente encontrado"
                  disabled={isEdicao}
                />
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição <span className="text-red-500">*</span></Label>
            <Input
              value={formData.descricao}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Ex: Medição 01 - Janeiro/2026"
              disabled={isEdicao}
              className={`mt-1 ${errors.descricao ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            />
            {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Total <span className="text-red-500">*</span></Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-sm text-gray-500">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.valor}
                  onChange={(e) => set('valor', e.target.value)}
                  placeholder="0,00"
                  className={`pl-9 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                />
              </div>
              {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
            </div>
            <div>
              <Label>Data de Vencimento <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={formData.data_vencimento}
                onChange={(e) => set('data_vencimento', e.target.value)}
                className={`mt-1 ${errors.data_vencimento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errors.data_vencimento && <p className="text-xs text-red-500 mt-1">{errors.data_vencimento}</p>}
            </div>
          </div>

          {/* Categoria + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Categoria</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={CATEGORIAS}
                  value={formData.categoria}
                  onSelect={(v) => setFormData({ ...formData, categoria: v })}
                  placeholder="Selecionar categoria..."
                  searchPlaceholder="Buscar categoria..."
                  disabled={isEdicao}
                />
              </div>
            </div>
            {isEdicao && (
              <div>
                <Label>Status</Label>
                <div className="mt-1">
                  <ComboboxBusca
                    options={STATUS}
                    value={formData.status}
                    onSelect={(v) => setFormData({ ...formData, status: v })}
                    placeholder="Selecionar status..."
                    searchPlaceholder="Buscar status..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Referência */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo Referência</Label>
              <Input
                value={formData.referencia_tipo}
                onChange={(e) => set('referencia_tipo', e.target.value)}
                placeholder="Ex: MEDICAO, CONTRATO"
                disabled={isEdicao}
                className={`mt-1 ${errors.referencia_tipo ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
              />
              {errors.referencia_tipo && <p className="text-xs text-red-500 mt-1">{errors.referencia_tipo}</p>}
            </div>
            <div>
              <Label>ID Referência</Label>
              <Input
                value={formData.referencia_id}
                onChange={(e) => { set('referencia_id', e.target.value); setErrors(p => (p.referencia_tipo ? { ...p, referencia_tipo: null } : p)); }}
                placeholder="ID da medição/contrato"
                disabled={isEdicao}
                className="mt-1"
              />
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label>Observações</Label>
            <Textarea
              value={formData.observacao}
              onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
              placeholder="Observações adicionais..."
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {isEdicao ? 'Atualizar' : 'Criar'} Título
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
