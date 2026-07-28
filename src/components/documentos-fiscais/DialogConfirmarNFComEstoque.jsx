import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Building2, Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ITEM_VAZIO = { material_id: '', material_nome: '', material_unidade: '', qtd: '', custo_unit: '' };

/**
 * Dialog para confirmar NF escolhendo destino de estoque.
 * Props:
 * - nf: objeto NotaFiscal
 * - open: boolean
 * - onClose: fn
 * - onSuccess: fn(resultado)
 */
export default function DialogConfirmarNFComEstoque({ nf, open, onClose, onSuccess }) {
  const [modo, setModo] = useState('sem_estoque'); // sem_estoque | central | obra
  const [almoxSelecionado, setAlmoxSelecionado] = useState('');
  const [obraId, setObraId] = useState(nf?.obra_id || '');
  const [itens, setItens] = useState([{ ...ITEM_VAZIO }]);
  const [saving, setSaving] = useState(false);

  const { data: locais = [] } = useQuery({
    queryKey: ['local-estoque-ativos'],
    queryFn: () => base44.entities.LocalEstoque.filter({ ativo: true }, 'nome', 200),
    enabled: open
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais-lista'],
    queryFn: () => base44.entities.Material.list('-updated_date', 2000),
    enabled: open
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' }, 'nome', 200),
    enabled: open && modo === 'obra'
  });

  const locaisCentral = useMemo(() => locais.filter(l => l.tipo === 'CENTRAL'), [locais]);
  const locaisObra = useMemo(() => locais.filter(l => l.tipo === 'OBRA'), [locais]);

  const addItem = () => setItens(prev => [...prev, { ...ITEM_VAZIO }]);
  const removeItem = (i) => setItens(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    setItens(prev => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: value };
      if (field === 'material_id') {
        const mat = materiais.find(m => m.id === value);
        if (mat) {
          next[i].material_nome = mat.nome;
          next[i].material_unidade = mat.unidade || '';
        }
      }
      return next;
    });
  };

  const handleConfirmar = async () => {
    const gerarEstoque = modo !== 'sem_estoque';
    const almoxDestino = gerarEstoque ? almoxSelecionado : null;

    if (gerarEstoque && !almoxDestino) {
      return toast.error('Selecione o almoxarifado de destino');
    }

    let itensPayload = [];
    if (gerarEstoque) {
      itensPayload = itens.filter(it => it.material_id && parseFloat(it.qtd) > 0);
      if (itensPayload.length === 0) {
        return toast.error('Adicione pelo menos um item com quantidade > 0');
      }
    }

    setSaving(true);
    try {
      const response = await base44.functions.invoke('notaFiscalConfirmar', {
        documento_fiscal_id: nf.id,
        almox_destino_id: almoxDestino || null,
        obra_id: obraId || null,
        itens_estoque: itensPayload.map(it => ({
          material_id: it.material_id,
          material_nome: it.material_nome,
          material_unidade: it.material_unidade,
          qtd: parseFloat(it.qtd),
          custo_unit: parseFloat(it.custo_unit || 0)
        }))
      });

      if (response.data?.nf) {
        const msg = response.data.estoque_atualizado
          ? `NF confirmada! Entrada gerada no estoque (${itensPayload.length} item(s))`
          : 'NF confirmada sem entrada no estoque';
        toast.success(msg);
        onSuccess?.(response.data);
        onClose();
      } else {
        toast.error(response.data?.error || 'Erro ao confirmar NF');
      }
    } catch (err) {
      toast.error(err.message || 'Erro ao confirmar');
    } finally {
      setSaving(false);
    }
  };

  const locaisDisponiveis = modo === 'obra' ? locaisObra : locaisCentral;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar NF {nf?.numero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* Info resumida da NF */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="font-medium text-gray-900">{nf?.emissor_nome}</p>
            <p className="text-gray-500">
              NF {nf?.numero} • R$ {nf?.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Destino da entrada */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-2 block">
              Destino dos materiais desta NF
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'sem_estoque', label: 'Sem entrada no estoque', icon: AlertCircle, desc: 'Confirmar NF apenas financeiro' },
                { key: 'central', label: 'Almoxarifado Central', icon: Warehouse, desc: 'Entregue no estoque central' },
                { key: 'obra', label: 'Almoxarifado da Obra', icon: Building2, desc: 'Entregue direto na obra' }
              ].map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => { setModo(opt.key); setAlmoxSelecionado(''); }}
                    className={`border rounded-lg p-3 text-center transition-all ${
                      modo === opt.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mx-auto mb-1 ${modo === opt.key ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div className={`text-xs font-semibold ${modo === opt.key ? 'text-blue-700' : 'text-gray-600'}`}>
                      {opt.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seleção do almoxarifado específico */}
          {modo !== 'sem_estoque' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  {modo === 'central' ? 'Almoxarifado Central *' : 'Almoxarifado da Obra *'}
                </label>
                <Select value={almoxSelecionado} onValueChange={setAlmoxSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locaisDisponiveis.map(l => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                        {l.obra_nome ? ` — ${l.obra_nome}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Obra (custo/relatório)
                </label>
                <Select value={obraId} onValueChange={setObraId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Opcional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Nenhuma</SelectItem>
                    {obras.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">O custo só é efetivado ao consumir (SAÍDA)</p>
              </div>
            </div>
          )}

          {/* Itens de estoque */}
          {modo !== 'sem_estoque' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">
                  Itens para entrada no estoque *
                </label>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Material</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-24">Qtd</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-28">Custo Unit.</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itens.map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <Select value={item.material_id} onValueChange={v => updateItem(i, 'material_id', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {materiais.filter(m => m.ativo !== false).map(m => (
                                <SelectItem key={m.id} value={m.id}>{m.nome} ({m.unidade})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.001"
                            value={item.qtd}
                            onChange={e => updateItem(i, 'qtd', e.target.value)}
                            className="h-8 text-xs text-right" placeholder="0"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number" min="0" step="0.01"
                            value={item.custo_unit}
                            onChange={e => updateItem(i, 'custo_unit', e.target.value)}
                            className="h-8 text-xs text-right" placeholder="0,00"
                          />
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
                </table>
              </div>
            </div>
          )}

          {/* Nota informativa para sem_estoque */}
          {modo === 'sem_estoque' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800">
                A NF será confirmada apenas para fins financeiros. Nenhum movimento de estoque será gerado.
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmar}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" />Confirmando...</>
              ) : (
                modo === 'sem_estoque' ? 'Confirmar NF' : 'Confirmar e Gerar Entrada'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}