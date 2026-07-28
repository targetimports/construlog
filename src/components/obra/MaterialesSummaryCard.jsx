import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

export default function MaterialesSummaryCard({ obra_id }) {
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['resumo_materiais', obra_id],
    queryFn: () => base44.functions.invoke('calcularResumoMateriaisObra', { obra_id }),
    select: (res) => res.data,
    staleTime: 120000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return <div className="text-xs text-gray-500">Carregando materiais...</div>;
  }

  if (!resumo) {
    return null;
  }

  const getIcon = () => {
    switch (resumo.status_geral) {
      case 'OK': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'EM_FALTA': return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'PENDENTE_MAPEAMENTO': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <Package className="w-4 h-4 text-gray-400" />;
    }
  };

  const getBadgeColor = () => {
    switch (resumo.status_geral) {
      case 'OK': return 'bg-green-100 text-green-800';
      case 'EM_FALTA': return 'bg-red-100 text-red-800';
      case 'PENDENTE_MAPEAMENTO': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-l-4" style={{
      borderLeftColor: resumo.status_geral === 'OK' ? '#10B981' : resumo.status_geral === 'EM_FALTA' ? '#EF4444' : '#F59E0B'
    }}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {getIcon()}
              <Badge className={getBadgeColor()}>
                {resumo.badge}
              </Badge>
            </div>
            
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { label: 'Total', value: resumo.total_planejados, color: 'text-gray-700' },
                { label: 'OK', value: resumo.materiais_ok, color: 'text-green-600' },
                { label: 'Falta', value: resumo.materiais_em_falta, color: 'text-red-600' },
                { label: 'Não Mape.', value: resumo.materiais_nao_mapeados, color: 'text-yellow-600' },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-gray-500">{label}</p>
                  <p className={`font-semibold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}