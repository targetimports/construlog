/**
 * BMResumoTopo: Resumo superior da BM
 * Mostra totais, % concluída e barra de progresso
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatBRL } from '@/components/shared/moneyBR';

export default function BMResumoTopo({ bm, totals, loading = false }) {
  const percentConcluida = totals?.percent_concluida || 0;
  
  return (
    <Card className="mb-6">
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Contrato</p>
            <p className="text-base sm:text-lg font-bold text-blue-700 break-words">
              {loading ? '...' : formatBRL(totals?.total_contrato || 0)}
            </p>
          </div>
          
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Acumulado</p>
            <p className="text-base sm:text-lg font-bold text-green-700 break-words">
              {loading ? '...' : formatBRL(totals?.total_acumulado || 0)}
            </p>
          </div>
          
          <div className="bg-yellow-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Período</p>
            <p className="text-base sm:text-lg font-bold text-yellow-700 break-words">
              {loading ? '...' : formatBRL(totals?.total_periodo || 0)}
            </p>
          </div>
          
          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Saldo</p>
            <p className="text-base sm:text-lg font-bold text-red-700 break-words">
              {loading ? '...' : formatBRL(totals?.total_saldo || 0)}
            </p>
          </div>
          
          <div className="bg-purple-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">% Concluída</p>
            <p className="text-base sm:text-lg font-bold text-purple-700 break-words">
              {loading ? '...' : `${percentConcluida.toFixed(2)}%`}
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span>Progresso</span>
            <span className="font-semibold">{percentConcluida.toFixed(1)}%</span>
          </div>
          <Progress value={Math.min(percentConcluida, 100)} className="h-3" />
        </div>
        
        {bm?.status && (
          <div className="flex items-center gap-2 pt-2">
            <span className="text-xs text-gray-600">Status:</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              bm.status === 'RASCUNHO' ? 'bg-gray-200 text-gray-800' :
              bm.status === 'APROVADA' ? 'bg-green-200 text-green-800' :
              'bg-blue-200 text-blue-800'
            }`}>
              {bm.status}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}