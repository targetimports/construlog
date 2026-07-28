import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowDown, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const ITEM_VAZIO = { material_id: '', material_nome: '', material_unidade: '', qtd: '', custo_unit: '' };

// Entrada manual de material no almoxarifado da obra (gera saldo de estoque).
export default function DialogEntradaEstoqueObra({ obraId, localId, open, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [saving, setSaving] = useState(false);
  const [erroItens, setErroItens] = useState('');

  const { data: insumos = [] } = useQuery({
    queryKey: ['insumos-entrada'],
    queryFn: () => base44.entities.Insumo.list('descricao', 5000),
    enabled: open,
  });

  const insumoMap = useMemo(() => Object.fromEntries(insumos.map(i => [i.id, i])), [insumos]);

  const addItem = () => setItens(prev => [...prev, { ...ITEM_VAZIO }]);
  const removeItem = (i) => setItens(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    if (erroItens) setErroItens('');
    setItens(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'material_id') {
        const insumo = insumoMap[value];
        if (insumo) {
          next[i].insumo_id = insumo.id;
          next[i].material_nome = insumo.descricao;
          next[i].material_unidade = insumo.unidade || '';
        }
        if (insumo?.preco_unitario && !next[i].custo_unit) next[i].custo_unit = insumo.preco_unitario;
      }
      return next;
    });
  };

  const totalCusto = itens.reduce((s, it) => s + (parseFloat(it.qtd || 0) * parseFloat(it.custo_unit || 0)), 0);

  const handleClose = () => { setMotivo(''); setItens([{ ...ITEM_VAZIO }]); setErroItens(''); onClose(); };

  const handleSave = async () => {
    if (!localId) return toast.error('Almoxarifado da obra não definido');
    const itensValidos = itens.filter(it => it.material_id && parseFloat(it.qtd) > 0);
    if (itensValidos.length === 0) {
      setErroItens('Adicione ao menos um item com material e quantidade maior que zero.');
      toast.error('Verifique os campos destacados.');
      return;
    }
    setErroItens('');

    setSaving(true);
    try {
      const resp = await base44.functions.invoke('processarMovimentacaoEstoque', {
        tipo: 'ENTRADA',
        almox_destino_id: localId,
        almox_origem_id: null,
        obra_id: obraId,
        documento_ref: motivo ? `ENTRADA: ${motivo}` : 'ENTRADA MANUAL',
        observacao: motivo || null,
        itens: itensValidos.map(it => ({
          material_id: it.material_id,
          insumo_id: it.insumo_id || it.material_id,
          material_nome: it.material_nome,
          material_unidade: it.material_unidade,
          qtd: parseFloat(it.qtd),
          custo_unit: parseFloat(it.custo_unit || 0),
        })),
      });
      if (!resp.data?.success) throw new Error(resp.data?.error || 'Erro ao registrar entrada');
      toast.success('Entrada de material registrada!');
      onSuccess?.();
      handleClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-gray-900">
            <ArrowDown className="w-5 h-5 text-emerald-600" />
            Entrada de Material no Estoque da Obra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          <div>
            <Label className="text-gray-700 font-medium">Origem / Observação</Label>
            <Input
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: NF 123, compra avulsa, transferência..."
              className="mt-1 h-10"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-700 font-medium">Materiais Recebidos *</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 h-8">
                <Plus className="w-3 h-3" /> Adicionar Item
              </Button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Qtd</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Custo Unit.</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">Total</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itens.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 min-w-[220px]">
                        <ComboboxBusca
                          options={insumos.filter(i => i.ativo !== false).map(i => ({ value: i.id, label: `${i.descricao || '-'} (${i.unidade || '-'})` }))}
                          value={item.material_id}
                          onSelect={v => updateItem(i, 'material_id', v)}
                          placeholder="Selecionar material..."
                          searchPlaceholder="Buscar material..."
                          emptyMessage="Nenhum material encontrado."
                          className={erroItens && !item.material_id ? 'border-red-400' : ''}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.001" value={item.qtd}
                          onChange={e => updateItem(i, 'qtd', e.target.value)} className="h-8 text-xs text-right" placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min="0" step="0.01" value={item.custo_unit}
                          onChange={e => updateItem(i, 'custo_unit', e.target.value)} className="h-8 text-xs text-right" placeholder="0,00" />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700">
                        {fmtBRL(parseFloat(item.qtd || 0) * parseFloat(item.custo_unit || 0))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {itens.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-7 w-7">
                            <Trash2 className="w-3 h-3 text-red-500" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-sm font-bold text-emerald-600">{fmtBRL(totalCusto)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            {erroItens && <p className="text-xs text-red-600 mt-2">{erroItens}</p>}
          </div>

          <div className="flex gap-3 pt-1">
            <Button variant="outline" onClick={handleClose} className="flex-1">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
              <ArrowDown className="w-4 h-4" />
              {saving ? 'Registrando...' : 'Registrar Entrada'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
