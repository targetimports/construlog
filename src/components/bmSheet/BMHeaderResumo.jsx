import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BMHeaderResumo({ totals, onRecalc, onSave, loadingRecalc, loadingSave, locked = false }) {
  const totalPeriodo = totals?.total_periodo || 0;
  const totalAcumulado = totals?.total_acumulado || 0;
  const totalSaldo = totals?.total_saldo || 0;
  const pct = totals?.percent_concluida || 0;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <CardTitle className="text-xl">Boletim de Medição</CardTitle>
        <div className="flex gap-2">
          <button
            onClick={onRecalc}
            disabled={loadingRecalc}
            className="inline-flex items-center rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 disabled:opacity-50"
          >{loadingRecalc ? 'Recalculando...' : 'Recalcular (Prévia)'}</button>
          <button
            onClick={onSave}
            disabled={loadingSave || locked}
            className="inline-flex items-center rounded-md bg-blue-500 px-3 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
            title={locked ? 'BM aprovada: edição bloqueada' : undefined}
          >{loadingSave ? 'Salvando...' : 'Salvar BM'}</button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-gray-500">Valor da BM (Período)</div>
            <div className="text-lg font-semibold">{currency.format(totalPeriodo)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Acumulado</div>
            <div className="text-lg font-semibold">{currency.format(totalAcumulado)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Saldo</div>
            <div className="text-lg font-semibold">{currency.format(totalSaldo)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">% Concluída</div>
            <div className="text-lg font-semibold">{pct.toFixed(2)}%</div>
          </div>
        </div>
        <div className="mt-2">
          <Progress value={pct} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}