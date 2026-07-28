import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function PCRateioModal({ open, onClose, item, obras, onSave }) {
  const [rateios, setRateios] = useState([]);
  const [errors, setErrors] = useState(null);

  useEffect(() => {
    if (open && item) {
      setRateios(item.rateio_obras || []);
      setErrors(null);
    }
  }, [open, item]);

  const addRateio = () => {
    setRateios(p => [...p, { obra_id: '', obra_nome: '', quantidade: '' }]);
  };

  const removeRateio = (idx) => {
    setRateios(p => p.filter((_, i) => i !== idx));
    setErrors(null);
  };

  const setRateioField = (idx, field, value) => {
    setRateios(p => p.map((r, i) => {
      if (i !== idx) return r;
      if (field === 'obra_id') {
        const obra = obras.find(o => o.id === value);
        return { ...r, obra_id: value, obra_nome: obra?.nome || '' };
      }
      return { ...r, [field]: value };
    }));
    setErrors(null);
  };

  const validate = () => {
    if (rateios.length === 0) {
      setErrors('Adicione pelo menos uma obra para o rateio');
      return false;
    }

    const semObra = rateios.some(r => !r.obra_id);
    if (semObra) {
      setErrors('Todas as linhas de rateio precisam ter uma obra selecionada');
      return false;
    }

    const semQtd = rateios.some(r => !r.quantidade || Number(r.quantidade) <= 0);
    if (semQtd) {
      setErrors('Todas as linhas de rateio precisam ter uma quantidade maior que 0');
      return false;
    }

    const totalRateio = rateios.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
    const qtdPedida = Number(item?.quantidade_pedida) || 0;
    const diff = Math.abs(qtdPedida - totalRateio);

    if (diff > 0.001) {
      setErrors(`Soma do rateio (${totalRateio}) ≠ Quantidade pedida (${qtdPedida})`);
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(rateios);
    onClose();
  };

  const totalRateio = rateios.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
  const qtdPedida = Number(item?.quantidade_pedida) || 0;
  const diff = Math.abs(qtdPedida - totalRateio);
  const isValid = diff < 0.001;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ratear por Obra
            <span className="text-xs font-normal text-gray-500">
              {item?.material_nome}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <span className="text-xs text-gray-600 block">Quantidade Pedida</span>
              <span className="text-lg font-bold text-gray-900">{qtdPedida}</span>
            </div>
            <div>
              <span className="text-xs text-gray-600 block">Soma do Rateio</span>
              <span className="text-lg font-bold text-gray-900">{totalRateio}</span>
            </div>
            <div>
              <span className="text-xs text-gray-600 block">Status</span>
              <div className="flex items-center gap-1 mt-1">
                {isValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-600">OK</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-semibold text-orange-600">Falta</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Errors */}
          {errors && (
            <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {errors}
            </div>
          )}

          {/* Rateios Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Distribuição por Obra</Label>
              <Button variant="outline" size="sm" onClick={addRateio} className="gap-1 h-8 text-xs">
                <Plus className="w-3 h-3" /> Adicionar Obra
              </Button>
            </div>

            {rateios.length === 0 ? (
              <div className="p-4 text-center text-gray-400 border border-dashed rounded-lg">
                <p className="text-sm">Clique em "Adicionar Obra" para distribuir a quantidade</p>
              </div>
            ) : (
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-2 font-semibold text-gray-500">Obra</th>
                      <th className="text-right p-2 font-semibold text-gray-500 w-32">Quantidade</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rateios.map((r, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-2">
                          <Select value={r.obra_id} onValueChange={v => setRateioField(idx, 'obra_id', v)}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Selecionar obra..." />
                            </SelectTrigger>
                            <SelectContent>
                              {obras.map(o => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            className="h-8 text-sm text-right"
                            value={r.quantidade}
                            onChange={e => setRateioField(idx, 'quantidade', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-400"
                            onClick={() => removeRateio(idx)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleSave} disabled={rateios.length === 0}>
              Salvar Rateio
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}