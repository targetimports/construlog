import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatBRL } from '@/components/shared/moneyBR';

export default function BMCardsResumo({ bm }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Valor Real do Período */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Valor do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{formatBRL(bm.total_periodo)}</div>
          <p className="text-xs text-slate-500 mt-1">Total medido neste BM</p>
        </CardContent>
      </Card>

      {/* Acumulado */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Acumulado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">{formatBRL(bm.total_acumulado)}</div>
          <p className="text-xs text-slate-500 mt-1">Até este BM</p>
        </CardContent>
      </Card>

      {/* Saldo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Saldo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-700">{formatBRL(bm.total_saldo)}</div>
          <p className="text-xs text-slate-500 mt-1">A ser medido</p>
        </CardContent>
      </Card>

      {/* Percentual */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-600">Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-slate-700">{(bm.percent_concluida || 0).toFixed(2)}%</div>
          <Progress value={bm.percent_concluida || 0} className="mt-2 h-2" />
        </CardContent>
      </Card>
    </div>
  );
}