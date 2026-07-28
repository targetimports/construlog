import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Plus, Trash2, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const fmtQtd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const ALERTA_CFG = {
  previsto_nao_comprado: { label: 'Não comprado', cls: 'bg-amber-100 text-amber-700' },
  consumo_acima_previsto: { label: 'Consumo > previsto', cls: 'bg-red-100 text-red-700' },
  compra_acima_previsto: { label: 'Compra > previsto', cls: 'bg-orange-100 text-orange-700' },
};

export default function InsumosPlanejadosTab({ obraId }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ material_id: '', descricao: '', unidade: '', quantidade_prevista: '', valor_total_previsto: '' });

  const { data: comparativo, isLoading } = useQuery({
    queryKey: ['insumos-planejados', obraId],
    queryFn: async () => {
      const { data } = await base44.functions.invoke('compararInsumosPlanejados', { obra_id: obraId });
      return data;
    },
    enabled: !!obraId,
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais-catalogo-plan'],
    queryFn: () => base44.entities.Material.list('-updated_date', 2000),
    enabled: addOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['insumos-planejados', obraId] });
    qc.invalidateQueries({ queryKey: ['viabilidade-obra', obraId] });
  };

  const addMutation = useMutation({
    mutationFn: () => {
      const mat = materiais.find((m) => m.id === form.material_id);
      return base44.entities.NecessidadeMaterialObra.create({
        obra_id: obraId,
        material_id: form.material_id || null,
        descricao: form.descricao || mat?.nome || '',
        unidade: form.unidade || mat?.unidade || '',
        quantidade_prevista: Number(form.quantidade_prevista) || 0,
        valor_total_previsto: Number(form.valor_total_previsto) || 0,
        status: 'planejado',
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success('Material previsto adicionado!');
      setAddOpen(false);
      setForm({ material_id: '', descricao: '', unidade: '', quantidade_prevista: '', valor_total_previsto: '' });
    },
    onError: (e) => toast.error('Erro: ' + (e?.response?.data?.error || e.message)),
  });

  const delMutation = useMutation({
    mutationFn: async (ids) => { for (const id of ids) await base44.entities.NecessidadeMaterialObra.delete(id).catch(() => {}); },
    onSuccess: () => { invalidate(); toast.success('Removido!'); },
  });

  const itens = comparativo?.itens || [];
  const semPlano = comparativo?.sem_planejamento || [];
  const resumo = comparativo?.resumo || {};

  const handleSubmitAdd = () => {
    if (!form.material_id && !form.descricao.trim()) return toast.error('Selecione um material ou informe a descrição');
    if (!form.quantidade_prevista || isNaN(Number(form.quantidade_prevista))) return toast.error('Quantidade prevista inválida');
    addMutation.mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p className="text-sm text-gray-600">Previsto × Comprado × Transferido × Consumido</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Material Previsto
        </Button>
      </div>

      {/* Resumo de alertas */}
      {itens.length > 0 && (resumo.nao_comprados > 0 || resumo.consumo_acima > 0 || resumo.compra_acima > 0) && (
        <div className="flex flex-wrap gap-2">
          {resumo.nao_comprados > 0 && <Badge className="bg-amber-100 text-amber-700 gap-1"><AlertTriangle className="w-3 h-3" /> {resumo.nao_comprados} não comprado(s)</Badge>}
          {resumo.consumo_acima > 0 && <Badge className="bg-red-100 text-red-700 gap-1"><AlertTriangle className="w-3 h-3" /> {resumo.consumo_acima} consumo acima do previsto</Badge>}
          {resumo.compra_acima > 0 && <Badge className="bg-orange-100 text-orange-700 gap-1"><AlertTriangle className="w-3 h-3" /> {resumo.compra_acima} compra acima do previsto</Badge>}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Carregando…</div>
      ) : itens.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-700 font-medium">Nenhum material previsto cadastrado.</p>
            <p className="text-xs text-gray-500 mt-2">Use "Material Previsto" para planejar os insumos e acompanhar previsto × comprado × consumido.</p>
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {itens.map((it) => (
            <div key={it.key} className="border border-gray-200 rounded-lg p-3 bg-white">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 break-words">{it.descricao || `Material ${String(it.material_id || '').slice(0, 8)}`}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{it.unidade || '—'}</p>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-red-600 hover:text-red-700" onClick={() => delMutation.mutate(it.ids || [])} disabled={delMutation.isPending}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1.5">
                <div><p className="text-[10px] font-semibold text-gray-500 uppercase">Previsto</p><p className="text-sm tabular-nums font-medium text-gray-900 whitespace-nowrap">{fmtQtd(it.previsto)}</p></div>
                <div><p className="text-[10px] font-semibold text-gray-500 uppercase">Comprado</p><p className="text-sm tabular-nums text-blue-600 whitespace-nowrap">{fmtQtd(it.comprado)}</p></div>
                <div><p className="text-[10px] font-semibold text-gray-500 uppercase">Transferido</p><p className="text-sm tabular-nums text-purple-600 whitespace-nowrap">{fmtQtd(it.transferido)}</p></div>
                <div><p className="text-[10px] font-semibold text-gray-500 uppercase">Consumido</p><p className="text-sm tabular-nums text-emerald-600 whitespace-nowrap">{fmtQtd(it.consumido)}</p></div>
                <div><p className="text-[10px] font-semibold text-gray-500 uppercase">Saldo</p><p className={`text-sm tabular-nums font-medium whitespace-nowrap ${it.saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtQtd(it.saldo)}</p></div>
              </div>
              {(it.alertas || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(it.alertas || []).map((a) => {
                    const cfg = ALERTA_CFG[a];
                    return cfg ? <Badge key={a} className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge> : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block border border-gray-200 rounded-xl overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase">Material</th>
                <th className="text-center px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Unid.</th>
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Previsto</th>
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Comprado</th>
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Transferido</th>
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Consumido</th>
                <th className="text-right px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Saldo</th>
                <th className="text-left px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase">Alertas</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {itens.map((it) => (
                <tr key={it.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-800">{it.descricao || `Material ${String(it.material_id || '').slice(0, 8)}`}</td>
                  <td className="px-3 py-3 text-center text-gray-500">{it.unidade || '—'}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-900 font-medium">{fmtQtd(it.previsto)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-600">{fmtQtd(it.comprado)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-purple-600">{fmtQtd(it.transferido)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-600">{fmtQtd(it.consumido)}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-medium ${it.saldo < 0 ? 'text-red-600' : 'text-gray-700'}`}>{fmtQtd(it.saldo)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(it.alertas || []).map((a) => {
                        const cfg = ALERTA_CFG[a];
                        return cfg ? <Badge key={a} className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge> : null;
                      })}
                      {(!it.alertas || it.alertas.length === 0) && <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => delMutation.mutate(it.ids || [])} disabled={delMutation.isPending}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Consumido/comprado sem planejamento */}
      {semPlano.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4">
            <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Movimentado sem planejamento ({semPlano.length})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200 text-left text-[11px] text-gray-500 uppercase">
                  <th className="px-3 py-2">Material</th><th className="px-3 py-2 text-right">Comprado</th><th className="px-3 py-2 text-right">Transferido</th><th className="px-3 py-2 text-right">Consumido</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {semPlano.map((s) => (
                    <tr key={s.material_id}>
                      <td className="px-3 py-2 text-gray-800">{s.descricao}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmtQtd(s.comprado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-purple-600">{fmtQtd(s.transferido)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtQtd(s.consumido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal adicionar */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader><DialogTitle className="text-gray-900">Adicionar Material Previsto</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 text-xs font-semibold mb-1.5 block">Material *</Label>
              <ComboboxBusca
                options={materiais.map((m) => ({ value: m.id, label: m.unidade ? `${m.nome} (${m.unidade})` : m.nome }))}
                value={form.material_id}
                onSelect={(v) => {
                  const m = materiais.find((x) => x.id === v);
                  setForm((f) => ({ ...f, material_id: v, descricao: m?.nome || f.descricao, unidade: m?.unidade || f.unidade }));
                }}
                placeholder="Selecione o material"
                searchPlaceholder="Buscar material..."
                emptyMessage="Nenhum material no catálogo."
              />
              <p className="text-xs text-gray-400 mt-1">Selecione do catálogo para o comparativo casar com as movimentações.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-700 text-xs font-semibold">Qtd Prevista *</Label>
                <Input type="number" step="0.01" value={form.quantidade_prevista} onChange={(e) => setForm((f) => ({ ...f, quantidade_prevista: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" />
              </div>
              <div>
                <Label className="text-gray-700 text-xs font-semibold">Valor Est. (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_total_previsto} onChange={(e) => setForm((f) => ({ ...f, valor_total_previsto: e.target.value }))} className="bg-white border-gray-300 text-gray-900 mt-1" placeholder="0,00" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleSubmitAdd} disabled={addMutation.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2">
              {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
