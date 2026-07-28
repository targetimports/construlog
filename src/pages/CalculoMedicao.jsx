import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, RefreshCw, Calculator, AlertCircle } from 'lucide-react';
import BMItemRow from '../components/medicao/BMItemRow';
import ResumoBM from '../components/medicao/ResumoBM';

export default function CalculoMedicao() {
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const initialBmId = urlParams.get('bm_id') || '';

  const [bmId, setBmId] = useState(initialBmId);
  const [localQuantidades, setLocalQuantidades] = useState({}); // { contrato_item_id: qtd }
  const [preview, setPreview] = useState(null);
  const [simulando, setSimulando] = useState(false);

  const { data: bmData, isLoading: loadingBM, error: erroBM } = useQuery({
    queryKey: ['bm', bmId],
    queryFn: async () => {
      if (!bmId) return null;
      const list = await base44.entities.BM.filter({ id: bmId });
      return list?.[0] || null;
    },
    enabled: !!bmId,
  });

  const { data: contratoItems, isLoading: loadingItens, error: erroItens } = useQuery({
    queryKey: ['contrato-items', bmData?.contrato_versao_id],
    queryFn: async () => {
      if (!bmData?.contrato_versao_id) return [];
      return base44.entities.ContratoItem.filter({ contrato_versao_id: bmData.contrato_versao_id });
    },
    enabled: !!bmData?.contrato_versao_id,
    initialData: [],
  });

  const { data: bmItems, isLoading: loadingBmItems } = useQuery({
    queryKey: ['bm-items', bmId],
    queryFn: async () => {
      if (!bmId) return [];
      return base44.entities.BMItem.filter({ bm_id: bmId });
    },
    enabled: !!bmId,
    initialData: [],
  });

  const bmItemByContrato = useMemo(() => Object.fromEntries(bmItems.map(i => [i.contrato_item_id, i])), [bmItems]);

  const simulate = async () => {
    if (!bmId) return;
    setSimulando(true);
    try {
      const items_override = Object.entries(localQuantidades).map(([contrato_item_id, qtd]) => ({ contrato_item_id, qtd_periodo_input: Number(qtd) }));
      const res = await base44.functions.invoke('calcMedicao', { bm_id: bmId, persist: false, items_override });
      setPreview(res.data);
    } finally {
      setSimulando(false);
    }
  };

  useEffect(() => {
    // Simulação automática leve ao carregar BM
    if (bmId) simulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmId]);

  const salvarMutation = useMutation({
    mutationFn: async () => {
      const items = Object.entries(localQuantidades).map(([contrato_item_id, qtd]) => ({ contrato_item_id, qtd_periodo_input: Number(qtd) }));
      const res = await base44.functions.invoke('updateBMPeriodQuantities', { bm_id: bmId, items });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bm', bmId] });
      queryClient.invalidateQueries({ queryKey: ['bm-items', bmId] });
      simulate();
    },
  });

  const handleChangeQty = (contratoItemId, qtd) => {
    setLocalQuantidades(prev => ({ ...prev, [contratoItemId]: qtd }));
  };

  const totals = preview?.totals;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="w-5 h-5" /> Cálculo de Medição (BM) — Nativo
        </h1>
        <p className="text-sm text-gray-600">
          Este é o motor oficial de cálculo. Excel/OrçaFascio não é a fonte de verdade; as quantidades do período são inseridas aqui e o sistema recalcula automaticamente.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm text-gray-600">BM ID</label>
            <Input placeholder="Informe o bm_id" value={bmId} onChange={(e) => setBmId(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={simulate} disabled={!bmId || simulando}>
              {simulando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Simular
            </Button>
            <Button onClick={() => salvarMutation.mutate()} disabled={!bmId || salvarMutation.isPending}>
              {salvarMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Cálculo
            </Button>
          </div>
        </CardContent>
      </Card>

      {(!bmId) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600" /> Informe um bm_id para iniciar o cálculo.
        </div>
      )}

      {(loadingBM || loadingItens || loadingBmItems) && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando dados...
        </div>
      )}

      {erroBM && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">Erro ao carregar BM.</div>
      )}

      {!!bmData && (
        <ResumoBM totals={totals} />
      )}

      {!!bmData && contratoItems.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Unid.</TableHead>
                <TableHead className="text-right">Qtd. Contrato</TableHead>
                <TableHead className="text-right">Qtd. Anterior</TableHead>
                <TableHead>Qtd. Período</TableHead>
                <TableHead className="text-right">PU c/ BDI</TableHead>
                <TableHead className="text-right">Valor Período</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratoItems.map(ci => (
                <BMItemRow
                  key={ci.id}
                  contratoItem={ci}
                  bmItem={bmItemByContrato[ci.id]}
                  previewItem={preview?.items?.find(i => i.contrato_item_id === ci.id)}
                  onChangeQty={handleChangeQty}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!!bmData && contratoItems.length === 0 && (
        <div className="p-3 bg-gray-50 border rounded text-sm">Não há itens de contrato para esta versão.</div>
      )}
    </div>
  );
}