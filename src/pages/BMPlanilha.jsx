import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import BMHeaderResumo from "../components/bmSheet/BMHeaderResumo";
import BMTable from "../components/bmSheet/BMTable";
import BMGroups from "../components/bmSheet/BMGroups";
import { PageSkeleton } from "@/components/shared/Skeletons";

export default function BMPlanilha() {
  const queryClient = useQueryClient();
  const url = new URLSearchParams(window.location.search);
  const bmId = url.get('id') || url.get('bm_id');

  const [overrides, setOverrides] = useState({}); // { [contrato_item_id]: { qtd_periodo_input, override_manual: true } }
  const [calcPreview, setCalcPreview] = useState(null);

  const { data: bm, isLoading: bmLoading, error: bmError } = useQuery({
    queryKey: ['bm', bmId],
    queryFn: async () => {
      if (!bmId) return null;
      const list = await base44.entities.BM.filter({ id: bmId });
      return list?.[0] || null;
    },
    enabled: Boolean(bmId),
  });

  const { data: contratoItems, isLoading: ciLoading } = useQuery({
    queryKey: ['contratoItemsForBM', bm?.contrato_versao_id],
    queryFn: async () => {
      if (!bm?.contrato_versao_id) return [];
      return base44.entities.ContratoItem.filter({ contrato_versao_id: bm.contrato_versao_id });
    },
    enabled: Boolean(bm?.contrato_versao_id),
    initialData: [],
  });

  const contratoItemsMap = useMemo(() => {
    const map = {};
    (contratoItems || []).forEach(ci => { map[ci.id] = ci; });
    return map;
  }, [contratoItems]);

  // Prévia inicial
  const previewQuery = useQuery({
    queryKey: ['calcBM', bmId],
    queryFn: async () => {
      if (!bmId) return null;
      const { data } = await base44.functions.invoke('calcBM', { bm_id: bmId });
      setCalcPreview(data);
      return data;
    },
    enabled: Boolean(bmId),
    staleTime: 0,
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const items_override = Object.entries(overrides).map(([contrato_item_id, o]) => ({ contrato_item_id, ...o }));
      const { data } = await base44.functions.invoke('calcBM', { bm_id: bmId, items_override });
      setCalcPreview(data);
      return data;
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const items_override = Object.entries(overrides).map(([contrato_item_id, o]) => ({ contrato_item_id, ...o }));
      const { data } = await base44.functions.invoke('calcBM', { bm_id: bmId, items_override, persist: true });
      // Atualiza queries relacionadas
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['bm', bmId] }),
        queryClient.invalidateQueries({ queryKey: ['calcBM', bmId] }),
      ]);
      setOverrides({});
      setCalcPreview(data);
      return data;
    }
  });

  const handleQtyChange = (contrato_item_id, value) => {
    if (bm?.status === 'APROVADA') return; // bloqueio no front (além do backend)
    const v = value === '' ? '' : Number(value);
    setOverrides((prev) => ({
      ...prev,
      [contrato_item_id]: { qtd_periodo_input: v === '' ? 0 : v, override_manual: true },
    }));
  };

  const handleQtyBlur = () => {
    recalcMutation.mutate();
  };

  const totals = calcPreview?.totals || {
    total_periodo: 0,
    total_acumulado: 0,
    total_saldo: 0,
    percent_concluida: 0,
  };

  if (!bmId) {
    return <div className="p-6">Passe bm_id na URL para carregar o BM.</div>;
  }
  if (bmLoading) return <div className="p-6"><PageSkeleton kpis={4} rows={8} cols={6} /></div>;
  if (bmError) return <div className="p-6 text-red-600">Erro ao carregar BM.</div>;
  if (!bm) return <div className="p-6">BM não encontrado.</div>;

  const itemsCalc = calcPreview?.items || [];
  const locked = bm?.status === 'APROVADA';

  return (
    <div className="p-6 space-y-4">
      <BMHeaderResumo
        totals={totals}
        onRecalc={() => recalcMutation.mutate()}
        onSave={() => saveMutation.mutate()}
        loadingRecalc={recalcMutation.isPending}
        loadingSave={saveMutation.isPending}
        locked={locked}
      />

      <BMTable
        itemsCalc={itemsCalc}
        contratoItemsMap={contratoItemsMap}
        onQtyChange={handleQtyChange}
        onQtyBlur={handleQtyBlur}
        locked={locked}
      />

      <BMGroups groups={calcPreview?.groups || []} />
    </div>
  );
}