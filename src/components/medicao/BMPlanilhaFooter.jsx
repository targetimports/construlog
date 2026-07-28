/**
 * BMPlanilhaFooter: Rodapé com totais e % concluída da planilha BM
 */
import React from 'react';
import { formatBRL } from '@/components/shared/moneyBR';

export default function BMPlanilhaFooter({ totals, hasChanges, isPreview }) {
  if (!totals) return null;

  const pct = totals.percent_concluida || 0;
  const saldoNegativo = (totals.total_saldo || 0) < -0.01;

  return (
    <tfoot className="sticky bottom-0">
      <tr className={`font-bold text-sm border-t-2 ${saldoNegativo ? 'bg-red-50 border-red-300' : isPreview ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-100 border-gray-400'}`}>
        <td colSpan={3} className="px-3 py-3">
          {isPreview ? (
            <span className="text-yellow-700 text-sm font-semibold">PREVIEW (rascunho)</span>
          ) : (
            <span className="text-gray-700">TOTAL</span>
          )}
          {hasChanges && (
            <span className="ml-2 text-orange-600 text-xs font-normal">● alterações pendentes</span>
          )}
          <span className="ml-3 text-purple-700 font-semibold tabular-nums">· {pct.toFixed(2)}% concluída</span>
        </td>
        <td className="px-3 py-3 text-right text-gray-500 border-l border-blue-100">—</td>
        <td className="px-3 py-3 text-right text-gray-500">—</td>
        {/* Anterior */}
        <td className="px-3 py-3 text-right text-gray-600 border-l border-gray-100">—</td>
        <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{formatBRL(totals.total_anterior || 0)}</td>
        {/* Período */}
        <td className="px-3 py-3 text-right border-l border-yellow-100">—</td>
        <td className={`px-3 py-3 text-right tabular-nums ${isPreview ? 'text-yellow-700' : 'text-gray-900'}`}>
          {formatBRL(totals.total_periodo || 0)}
        </td>
        {/* Acumulado */}
        <td className="px-3 py-3 text-right border-l border-green-100">—</td>
        <td className={`px-3 py-3 text-right font-bold tabular-nums ${isPreview ? 'text-yellow-800' : 'text-blue-700'}`}>
          {formatBRL(totals.total_acumulado || 0)}
        </td>
        {/* Saldo */}
        <td className="px-3 py-3 text-right border-l border-red-100">—</td>
        <td className={`px-3 py-3 text-right tabular-nums ${saldoNegativo ? 'text-red-700 font-bold' : 'text-red-700'}`}>
          {formatBRL(totals.total_saldo || 0)}
        </td>
      </tr>
    </tfoot>
  );
}