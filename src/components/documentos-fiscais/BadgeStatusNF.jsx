import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, FileText } from 'lucide-react';

/**
 * Badge reutilizável para mostrar status de NF
 * Usado em qualquer registro que tenha NF anexada
 */
export default function BadgeStatusNF({ status, valor_final_ajustado, showValor = true }) {
  const configs = {
    ENVIADO: {
      icon: Clock,
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'NF Enviada',
    },
    ANALISADO_IA: {
      icon: AlertCircle,
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Analisada (IA)',
    },
    CONFIRMADO: {
      icon: CheckCircle2,
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'NF Confirmada',
    },
    CANCELADO: {
      icon: AlertCircle,
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'NF Cancelada',
    },
  };

  const config = configs[status] || configs.ENVIADO;
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Badge className={`${config.bg} ${config.text} gap-1.5`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
      
      {showValor && valor_final_ajustado && (
        <span className="text-sm font-semibold text-gray-900">
          R$ {valor_final_ajustado.toFixed(2)}
        </span>
      )}
    </div>
  );
}