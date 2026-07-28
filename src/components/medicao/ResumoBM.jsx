import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function ResumoBM({ totals, loading }) {
  return (
    <Card>
      <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Total Contrato</p>
          <p className="font-semibold">R$ {Number(totals?.total_contrato || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Anterior</p>
          <p className="font-semibold">R$ {Number(totals?.total_anterior || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Período</p>
          <p className="font-semibold">R$ {Number(totals?.total_periodo || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Acumulado</p>
          <p className="font-semibold">R$ {Number(totals?.total_acumulado || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Saldo</p>
          <p className="font-semibold">R$ {Number(totals?.total_saldo || 0).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-gray-500">Concluído</p>
          <p className="font-semibold">{Number(totals?.percent_concluida || 0).toFixed(2)}%</p>
        </div>
      </CardContent>
    </Card>
  );
}