import React from 'react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';

export default function GarantiaInfo({ data_fim_real, garantia_tipo, garantia_valor, status }) {
  if (status !== 'concluida' || !data_fim_real || garantia_tipo === 'nenhuma') {
    return null;
  }

  const dataFim = new Date(data_fim_real);
  const dataGarantiaFim = new Date(dataFim);

  if (garantia_tipo === 'anos') {
    dataGarantiaFim.setFullYear(dataGarantiaFim.getFullYear() + garantia_valor);
  } else if (garantia_tipo === 'meses') {
    dataGarantiaFim.setMonth(dataGarantiaFim.getMonth() + garantia_valor);
  }

  return (
    <Card className="bg-green-50 border-green-200">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-600 font-medium">Período de Garantia</p>
            <p className="text-xs text-gray-500 mt-1">
              {format(new Date(data_fim_real), 'dd/MM/yyyy')} até {format(dataGarantiaFim, 'dd/MM/yyyy')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-green-700 font-semibold">
              {garantia_valor} {garantia_tipo === 'anos' ? 'ano' : 'mês'}
              {garantia_valor > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}