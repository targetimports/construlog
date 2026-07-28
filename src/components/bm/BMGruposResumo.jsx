import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { formatBRL } from '@/components/shared/moneyBR';

function trunc2(n) {
  if (!isFinite(n)) return 0;
  return Math.trunc(n * 100) / 100;
}

export default function BMGruposResumo({ bm_id, contrato_versao_id, selectedGroup, onSelectGroup }) {
  const { data: contratoItems = [], isLoading: ciLoading } = useQuery({
    queryKey: ['contratoItems', contrato_versao_id],
    queryFn: () => base44.entities.ContratoItem.filter({ contrato_versao_id }),
    enabled: !!contrato_versao_id,
  });

  const { data: bmItems = [], isLoading: bmiLoading } = useQuery({
    queryKey: ['bmItensForResumo', bm_id],
    queryFn: () => base44.entities.BMItem.filter({ bm_id }),
    enabled: !!bm_id,
  });

  if (ciLoading || bmiLoading) {
    return (
      <div className="mb-6 p-4 bg-white border border-gray-200 rounded-xl">
        <div className="animate-pulse h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-100 rounded" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!contratoItems.length) {
    return null;
  }

  // Mapear BMItem por contrato_item_id para lookup rápido
  const bmByContratoId = bmItems.reduce((acc, it) => {
    acc[it.contrato_item_id] = it;
    return acc;
  }, {});

  // Agregar por grupo (prefixo antes do primeiro ponto)
  const grupos = {};
  for (const ci of contratoItems) {
    const codigo = ci.item_codigo || '';
    const grupo = codigo.split('.')[0] || codigo;
    if (!grupos[grupo]) {
      grupos[grupo] = {
        grupo,
        total_contrato: 0,
        total_acumulado: 0,
      };
    }
    grupos[grupo].total_contrato += Number(ci.preco_total || 0);

    const bmi = bmByContratoId[ci.id];
    if (bmi) {
      grupos[grupo].total_acumulado += Number(bmi.vl_acumulado || 0);
    }
  }

  const lista = Object.values(grupos)
    .sort((a, b) => Number(a.grupo) - Number(b.grupo))
    .map((g) => ({
      ...g,
      percent: g.total_contrato > 0 ? trunc2((g.total_acumulado / g.total_contrato) * 100) : 0,
    }));

  return (
    <Card className="p-4 mb-4 overflow-x-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Progresso por Grupo (item_codigo)</h3>
        {selectedGroup && (
          <button
            onClick={() => onSelectGroup(null)}
            className="text-xs text-blue-600 hover:underline"
          >
            Limpar filtro
          </button>
        )}
      </div>
      <div className="min-w-[640px] grid gap-3">
        {lista.map((g) => (
          <button
            key={g.grupo}
            onClick={() => onSelectGroup(selectedGroup === g.grupo ? null : g.grupo)}
            className={`text-left group rounded-lg border p-3 transition-colors ${
              selectedGroup === g.grupo
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
            title={`Filtrar itens pelo grupo ${g.grupo}`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                  selectedGroup === g.grupo ? 'bg-blue-600 text-white' : 'bg-gray-800 text-white'
                }`}>
                  {g.grupo}
                </span>
                <span className="text-sm text-gray-700 font-medium">{g.percent}%</span>
              </div>
              <div className="text-xs text-gray-600">
                {formatBRL(g.total_acumulado)} / {formatBRL(g.total_contrato)}
              </div>
            </div>
            <div className="h-2 w-full rounded bg-gray-100 overflow-hidden">
              <div
                className={`h-2 rounded ${selectedGroup === g.grupo ? 'bg-blue-600' : 'bg-green-500'}`}
                style={{ width: `${Math.min(100, Math.max(0, g.percent))}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}