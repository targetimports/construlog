import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const fmtFull = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export default function ResumoApontamentoHoras({ filtros }) {
  const { data: apontamentos } = useQuery({
    queryKey: ['apontamentos-resumo', filtros],
    queryFn: () => base44.functions.invoke('listarApontamentosHora', { ...filtros, pagina: 1 }),
    select: (res) => res.data?.apontamentos || []
  });

  const totalHoras = apontamentos?.reduce((sum, ap) => sum + (ap.horas_normais || 0) + (ap.horas_extras || 0), 0) || 0;
  const totalCusto = apontamentos?.reduce((sum, ap) => sum + (ap.custo_total || 0), 0) || 0;
  const aprovados = apontamentos?.filter(ap => ap.status === 'aprovado').length || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="bg-white border-gray-200">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Total de Horas</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{totalHoras}</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Custo Total</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums mt-1 truncate" title={fmtFull(totalCusto)}>{fmtCompactBRL(totalCusto)}</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-gray-500">Aprovados</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums mt-1">{aprovados}</p>
        </CardContent>
      </Card>
    </div>
  );
}
