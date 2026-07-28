import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';

/**
 * Exibe o status resumido de materiais da obra com regra de prioridade:
 * 1. Pendente de mapeamento (NAO_MAPEADO > 0)
 * 2. Em falta (EM_FALTA + PARCIAL > 0)
 * 3. OK (todos SUFICIENTE)
 * 4. Sem materiais
 */
export default function StatusMateriaisObra({ obra_id, className = '' }) {
  const { data: resumo, isLoading } = useQuery({
    queryKey: ['status_materiais', obra_id],
    queryFn: () => base44.functions.invoke('calcularResumoMateriaisObra', { obra_id }),
    select: (res) => res.data,
    staleTime: 120000,
  });

  if (isLoading || !resumo) {
    return null;
  }

  const getIcon = () => {
    switch (resumo.status_geral) {
      case 'OK':
        return <CheckCircle className="w-4 h-4" />;
      case 'EM_FALTA':
        return <AlertCircle className="w-4 h-4" />;
      case 'PENDENTE_MAPEAMENTO':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getVariant = () => {
    switch (resumo.status_geral) {
      case 'OK':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'EM_FALTA':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'PENDENTE_MAPEAMENTO':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (resumo.total_planejados === 0) {
    return null;
  }

  return (
    <Badge className={`flex items-center gap-2 ${getVariant()} border ${className}`}>
      {getIcon()}
      <span className="text-xs">{resumo.badge}</span>
    </Badge>
  );
}