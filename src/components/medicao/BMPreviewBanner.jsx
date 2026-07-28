/**
 * BMPreviewBanner: Banner diferenciando OFICIAL vs PREVIEW
 */
import React from 'react';
import { formatBRL } from '@/components/shared/moneyBR';

export default function BMPreviewBanner({ bm, totals, aprovadoTotals }) {
  if (!bm || !totals) return null;

  const isRascunho = bm.status === 'RASCUNHO';
  const isAprovada = bm.status === 'APROVADA';

  if (isAprovada) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-4 py-2 bg-green-50 border border-green-300 rounded-lg text-sm">
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          <span className="font-semibold text-green-800">OFICIAL — BM Aprovada</span>
        </span>
        <span className="text-green-700 sm:ml-2">
          Período: <strong>{formatBRL(totals.total_periodo)}</strong> · Acumulado: <strong>{formatBRL(totals.total_acumulado)}</strong> · {totals.percent_concluida?.toFixed(2)}% concluída
        </span>
      </div>
    );
  }

  if (isRascunho) {
    const difPct = aprovadoTotals
      ? ((totals.percent_concluida || 0) - (aprovadoTotals.percent_concluida || 0)).toFixed(2)
      : null;

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg text-sm">
        <span className="flex items-center gap-2 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0 animate-pulse" />
          <span className="font-semibold text-yellow-800">PREVIEW — Rascunho (não oficial)</span>
        </span>
        <span className="text-yellow-700 sm:ml-2">
          Período estimado: <strong>{formatBRL(totals.total_periodo)}</strong> · {totals.percent_concluida?.toFixed(2)}% concluída
          {difPct !== null && (
            <span className={`ml-2 font-semibold ${parseFloat(difPct) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              ({parseFloat(difPct) >= 0 ? '+' : ''}{difPct}% vs aprovado)
            </span>
          )}
        </span>
      </div>
    );
  }

  return null;
}
