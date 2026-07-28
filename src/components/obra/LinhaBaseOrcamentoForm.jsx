import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const UNIDADES = ['UN', 'KG', 'M', 'M2', 'M3', 'L', 'SC', 'CX', 'T', 'PC', 'GL', 'ROL', 'OUTRO'];

export default function LinhaBaseOrcamentoForm({ open, item, obraId, empresa_id, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    item_numero: 1,
    etapa: '',
    descricao: '',
    unidade: 'UN',
    quantidade_prevista: 0,
    valor_unitario_previsto: 0,
    percentual_bdi: 0,
    data_inicio_prevista: '',
    data_fim_prevista: '',
    observacao: ''
  });

  useEffect(() => {
    if (item) {
      setForm({
        item_numero: item.item_numero || 1,
        etapa: item.etapa || '',
        descricao: item.descricao || '',
        unidade: item.unidade || 'UN',
        quantidade_prevista: item.quantidade_prevista || 0,
        valor_unitario_previsto: item.valor_unitario_previsto || 0,
        percentual_bdi: item.percentual_bdi || 0,
        data_inicio_prevista: item.data_inicio_prevista || '',
        data_fim_prevista: item.data_fim_prevista || '',
        observacao: item.observacao || ''
      });
    } else {
      setForm({
        item_numero: 1,
        etapa: '',
        descricao: '',
        unidade: 'UN',
        quantidade_prevista: 0,
        valor_unitario_previsto: 0,
        percentual_bdi: 0,
        data_inicio_prevista: '',
        data_fim_prevista: '',
        observacao: ''
      });
    }
  }, [item, open]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const valor_total_previsto = (form.quantidade_prevista || 0) * (form.valor_unitario_previsto || 0);

  const handleSave = () => {
    if (!form.descricao.trim()) {
      alert('Descrição é obrigatória');
      return;
    }

    const data = {
      ...form,
      obra_id: obraId,
      empresa_id: empresa_id,
      valor_total_previsto: valor_total_previsto,
      quantidade_prevista: parseFloat(form.quantidade_prevista) || 0,
      valor_unitario_previsto: parseFloat(form.valor_unitario_previsto) || 0,
      percentual_bdi: parseFloat(form.percentual_bdi) || 0,
      item_numero: parseInt(form.item_numero) || 1
    };

    if (item?.id) {
      data.id = item.id;
    }

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Novo Item de Orçamento'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item número e Etapa */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Número do Item *</Label>
              <Input
                type="number"
                min="1"
                value={form.item_numero}
                onChange={(e) => handleChange('item_numero', e.target.value)}
              />
            </div>
            <div>
              <Label>Etapa/Fase</Label>
              <Input
                placeholder="Ex: Fundação, Estrutura..."
                value={form.etapa}
                onChange={(e) => handleChange('etapa', e.target.value)}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <Label>Descrição *</Label>
            <Textarea
              placeholder="Descreva o item do orçamento"
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              rows={2}
            />
          </div>

          {/* Quantidade e Unidade */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Quantidade Prevista *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.quantidade_prevista}
                onChange={(e) => handleChange('quantidade_prevista', e.target.value)}
              />
            </div>
            <div>
              <Label>Unidade *</Label>
              <Select value={form.unidade} onValueChange={(value) => handleChange('unidade', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map(un => (
                    <SelectItem key={un} value={un}>{un}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Valores */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valor Unitário (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_unitario_previsto}
                onChange={(e) => handleChange('valor_unitario_previsto', e.target.value)}
              />
            </div>
            <div>
              <Label>% BDI</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.percentual_bdi}
                onChange={(e) => handleChange('percentual_bdi', e.target.value)}
              />
            </div>
          </div>

          {/* Total */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-600">
              <strong>Valor Total Previsto:</strong> {' '}
              {valor_total_previsto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início Prevista</Label>
              <Input
                type="date"
                value={form.data_inicio_prevista}
                onChange={(e) => handleChange('data_inicio_prevista', e.target.value)}
              />
            </div>
            <div>
              <Label>Data Fim Prevista</Label>
              <Input
                type="date"
                value={form.data_fim_prevista}
                onChange={(e) => handleChange('data_fim_prevista', e.target.value)}
              />
            </div>
          </div>

          {/* Observação */}
          <div>
            <Label>Observação</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={form.observacao}
              onChange={(e) => handleChange('observacao', e.target.value)}
              rows={2}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}