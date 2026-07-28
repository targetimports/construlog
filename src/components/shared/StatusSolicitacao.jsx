import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

/**
 * Badge de status para solicitações
 */
export default function StatusSolicitacao({ status }) {
  const statusConfig = {
    pendente_aprovacao: {
      label: 'Pendente Aprovação',
      color: 'bg-yellow-100 text-yellow-800',
      icon: Clock
    },
    em_analise: {
      label: 'Em Análise',
      color: 'bg-blue-100 text-blue-800',
      icon: AlertCircle
    },
    aprovado: {
      label: 'Aprovado',
      color: 'bg-green-100 text-green-800',
      icon: CheckCircle
    },
    rejeitado: {
      label: 'Rejeitado',
      color: 'bg-red-100 text-red-800',
      icon: XCircle
    },
    concluido: {
      label: 'Concluído',
      color: 'bg-gray-100 text-gray-800',
      icon: CheckCircle
    }
  };

  const config = statusConfig[status] || statusConfig.pendente_aprovacao;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} flex items-center gap-1`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}