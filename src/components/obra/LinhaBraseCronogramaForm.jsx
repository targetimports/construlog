import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function LinhaBraseCronogramaForm({ open, item, obraId, empresa_id, onClose, onSave, isLoading }) {
  const [form, setForm] = useState({
    item_numero: 1,
    descricao: '',
    data_inicio: '',
    data_fim: '',
    responsavel: '',
    observacao: ''
  });

  useEffect(() => {
    if (item) {
      setForm({
        item_numero: item.item_numero || 1,
        descricao: item.descricao || '',
        data_inicio: item.data_inicio || '',
        data_fim: item.data_fim || '',
        responsavel: item.responsavel || '',
        observacao: item.observacao || ''
      });
    } else {
      setForm({
        item_numero: 1,
        descricao: '',
        data_inicio: '',
        data_fim: '',
        responsavel: '',
        observacao: ''
      });
    }
  }, [item, open]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Calcular duração em dias
  const calcularDuracao = () => {
    if (form.data_inicio && form.data_fim) {
      const inicio = new Date(form.data_inicio);
      const fim = new Date(form.data_fim);
      const diffMs = fim - inicio;
      const dias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return dias >= 0 ? dias : 0;
    }
    return 0;
  };

  const duracao_dias = calcularDuracao();

  const handleSave = () => {
    if (!form.descricao.trim()) {
      alert('Descrição é obrigatória');
      return;
    }
    if (!form.data_inicio) {
      alert('Data de início é obrigatória');
      return;
    }
    if (!form.data_fim) {
      alert('Data de fim é obrigatória');
      return;
    }

    const data = {
      ...form,
      obra_id: obraId,
      empresa_id: empresa_id,
      duracao_dias: duracao_dias,
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
          <DialogTitle>{item ? 'Editar Atividade' : 'Nova Atividade no Cronograma'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Número e Descrição */}
          <div>
            <Label>Número da Atividade *</Label>
            <Input
              type="number"
              min="1"
              value={form.item_numero}
              onChange={(e) => handleChange('item_numero', e.target.value)}
            />
          </div>

          <div>
            <Label>Descrição da Atividade *</Label>
            <Textarea
              placeholder="Descreva a atividade (ex: Escavação de fundação)"
              value={form.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              rows={2}
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Início *</Label>
              <Input
                type="date"
                value={form.data_inicio}
                onChange={(e) => handleChange('data_inicio', e.target.value)}
              />
            </div>
            <div>
              <Label>Data de Fim *</Label>
              <Input
                type="date"
                value={form.data_fim}
                onChange={(e) => handleChange('data_fim', e.target.value)}
              />
            </div>
          </div>

          {/* Duração */}
          {form.data_inicio && form.data_fim && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600">
                <strong>Duração:</strong> {duracao_dias} dias
              </div>
            </div>
          )}

          {/* Responsável */}
          <div>
            <Label>Responsável</Label>
            <Input
              placeholder="Nome ou email do responsável"
              value={form.responsavel}
              onChange={(e) => handleChange('responsavel', e.target.value)}
            />
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