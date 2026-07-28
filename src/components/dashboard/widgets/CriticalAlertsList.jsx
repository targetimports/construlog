import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertCircle } from 'lucide-react';

export default function CriticalAlertsList({ config }) {
  const { data: alertas } = useQuery({
    queryKey: ['alertas-criticos-dashboard'],
    queryFn: () => base44.entities.NotificationLog.filter({ 
      severidade: 'CRITICO'
    }, '-created_date', 5),
  });

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-red-600" /> Alertas Críticos
      </h3>
      <div className="space-y-2">
        {(alertas || []).slice(0, 3).map(alerta => (
          <div key={alerta.id} className="text-xs p-2 bg-red-50 rounded border-l-2 border-red-500">
            <p className="font-semibold text-red-900">{alerta.tipo_alerta}</p>
            <p className="text-red-700 text-xs mt-1">{alerta.mensagem_base}</p>
          </div>
        ))}
      </div>
    </div>
  );
}