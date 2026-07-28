import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { Save, Loader2, SlidersHorizontal } from 'lucide-react';

// Edita as políticas de reposição (mínimo, ponto de reposição, máximo, lote)
// diretamente nos registros de SaldoEstoque — que é a mesma fonte lida pelos
// Alertas e pela Sugestão de Compra Automática.
export default function PoliticasEstoquePage() {
  const qc = useQueryClient();
  const [localId, setLocalId] = useState('');
  const [edits, setEdits] = useState({}); // id -> { campo: valor }

  const { data: locais = [] } = useQuery({
    queryKey: ['local-estoque-politicas'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
  });
  const locaisAtivos = useMemo(
    () => [...locais.filter(l => l.ativo !== false)].sort((a, b) => (b.tipo === 'CENTRAL' ? 1 : 0) - (a.tipo === 'CENTRAL' ? 1 : 0)),
    [locais]
  );

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ['saldos-politicas', localId],
    queryFn: () => localId
      ? base44.entities.SaldoEstoque.filter({ local_estoque_id: localId }, '-material_nome', 2000)
      : Promise.resolve([]),
    enabled: !!localId,
  });

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(saldos, 20);
  useEffect(() => { setEdits({}); goToPage(1); }, [localId]);

  const getVal = (s, field, fallback = 0) => {
    const e = edits[s.id];
    if (e && e[field] !== undefined) return e[field];
    return s[field] ?? fallback;
  };
  const setVal = (id, field, value) => setEdits(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));

  const CAMPOS = ['quantidade_minima', 'ponto_reposicao', 'quantidade_maxima', 'lote_compra'];

  const salvarMutation = useMutation({
    mutationFn: async () => {
      for (const id of Object.keys(edits)) {
        const e = edits[id];
        const patch = {};
        for (const k of CAMPOS) if (e[k] !== undefined) patch[k] = Number(e[k]) || 0;
        if (Object.keys(patch).length) await base44.entities.SaldoEstoque.update(id, patch);
      }
    },
    onSuccess: () => {
      toast.success('Políticas salvas com sucesso.');
      setEdits({});
      qc.invalidateQueries({ queryKey: ['saldos-politicas'] });
      qc.invalidateQueries({ queryKey: ['saldos-estoque-dash'] });
    },
    onError: (e) => toast.error('Erro ao salvar: ' + (e?.message || '')),
  });

  const numEdits = Object.keys(edits).length;

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Políticas de Estoque</h1>
        <p className="text-sm text-gray-500 mt-1">
          Defina mínimo, ponto de reposição, máximo e lote de compra por material. Esses parâmetros alimentam os alertas e as sugestões de compra.
        </p>
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Almoxarifado</label>
          <div className="max-w-sm">
            <ComboboxBusca
              options={locaisAtivos.map(l => ({ value: l.id, label: `${l.nome}${l.tipo === 'CENTRAL' ? ' (Central)' : ' (Obra)'}` }))}
              value={localId}
              onSelect={setLocalId}
              placeholder="Selecione um almoxarifado..."
              searchPlaceholder="Buscar almoxarifado..."
              emptyMessage="Nenhum almoxarifado ativo."
            />
          </div>
        </CardContent>
      </Card>

      {localId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                Materiais ({saldos.length})
              </CardTitle>
              <Button onClick={() => salvarMutation.mutate()} disabled={numEdits === 0 || salvarMutation.isPending} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
                {salvarMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar{numEdits > 0 ? ` (${numEdits})` : ''}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <TableSkeleton bare rows={6} cols={6} />
            ) : saldos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum material neste almoxarifado.</p>
            ) : (
              <>
                {/* Desktop: tabela */}
                <div className="hidden md:block border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold text-gray-500">Material</th>
                        <th className="p-3 text-right text-xs font-semibold text-gray-500">Saldo Atual</th>
                        <th className="p-3 text-center text-xs font-semibold text-gray-500">Mínimo</th>
                        <th className="p-3 text-center text-xs font-semibold text-gray-500">Ponto Reposição</th>
                        <th className="p-3 text-center text-xs font-semibold text-gray-500">Máximo</th>
                        <th className="p-3 text-center text-xs font-semibold text-gray-500">Lote Compra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedItems.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">
                            {s.material_nome || '—'} <span className="text-xs text-gray-400">{s.material_unidade || ''}</span>
                          </td>
                          <td className="p-3 text-right text-gray-600">{(s.saldo_atual || 0).toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-center">
                            <Input type="number" min="0" value={getVal(s, 'quantidade_minima')} onChange={e => setVal(s.id, 'quantidade_minima', e.target.value)} className="w-24 h-9 text-center mx-auto" />
                          </td>
                          <td className="p-3 text-center">
                            <Input type="number" min="0" value={getVal(s, 'ponto_reposicao')} onChange={e => setVal(s.id, 'ponto_reposicao', e.target.value)} className="w-24 h-9 text-center mx-auto" />
                          </td>
                          <td className="p-3 text-center">
                            <Input type="number" min="0" value={getVal(s, 'quantidade_maxima')} onChange={e => setVal(s.id, 'quantidade_maxima', e.target.value)} className="w-24 h-9 text-center mx-auto" />
                          </td>
                          <td className="p-3 text-center">
                            <Input type="number" min="1" value={getVal(s, 'lote_compra', 1)} onChange={e => setVal(s.id, 'lote_compra', e.target.value)} className="w-24 h-9 text-center mx-auto" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile: cards */}
                <div className="md:hidden flex flex-col gap-y-2">
                  {paginatedItems.map(s => (
                    <div key={s.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 break-words">{s.material_nome || '—'} <span className="text-xs text-gray-400">{s.material_unidade || ''}</span></p>
                        <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">Saldo: <span className="font-semibold text-gray-700">{(s.saldo_atual || 0).toLocaleString('pt-BR')}</span></span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Mínimo</label>
                          <Input type="number" min="0" value={getVal(s, 'quantidade_minima')} onChange={e => setVal(s.id, 'quantidade_minima', e.target.value)} className="h-10 text-sm text-right" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Ponto Reposição</label>
                          <Input type="number" min="0" value={getVal(s, 'ponto_reposicao')} onChange={e => setVal(s.id, 'ponto_reposicao', e.target.value)} className="h-10 text-sm text-right" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Máximo</label>
                          <Input type="number" min="0" value={getVal(s, 'quantidade_maxima')} onChange={e => setVal(s.id, 'quantidade_maxima', e.target.value)} className="h-10 text-sm text-right" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-0.5 block">Lote Compra</label>
                          <Input type="number" min="1" value={getVal(s, 'lote_compra', 1)} onChange={e => setVal(s.id, 'lote_compra', e.target.value)} className="h-10 text-sm text-right" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
