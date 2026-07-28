import React from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const severityConfig = {
  critical: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  warning: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
};

export default function IAAlerts({ alertas, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!alertas || alertas.length === 0) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center text-green-700">
        ✓ Nenhuma anomalia detectada
      </div>
    );
  }

  const critical = alertas.filter(a => a.tipo === 'critical');
  const warnings = alertas.filter(a => a.tipo === 'warning');
  const infos = alertas.filter(a => a.tipo === 'info');

  return (
    <div className="space-y-3">
      {critical.map((alerta, i) => {
        const config = severityConfig.critical;
        const Icon = config.icon;
        return (
          <div key={i} className={`${config.bg} border ${config.border} rounded-lg p-3`}>
            <div className="flex gap-3">
              <Icon className={`${config.color} flex-shrink-0 w-5 h-5 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className={`${config.color} font-semibold text-sm`}>{alerta.titulo}</div>
                <div className="text-gray-700 text-sm mt-1">{alerta.descricao}</div>
                {alerta.valor !== undefined && (
                  <div className="text-xs text-gray-600 mt-1">Valor: {alerta.valor}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {warnings.map((alerta, i) => {
        const config = severityConfig.warning;
        const Icon = config.icon;
        return (
          <div key={i} className={`${config.bg} border ${config.border} rounded-lg p-3`}>
            <div className="flex gap-3">
              <Icon className={`${config.color} flex-shrink-0 w-5 h-5 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className={`${config.color} font-semibold text-sm`}>{alerta.titulo}</div>
                <div className="text-gray-700 text-sm mt-1">{alerta.descricao}</div>
              </div>
            </div>
          </div>
        );
      })}

      {infos.map((alerta, i) => {
        const config = severityConfig.info;
        const Icon = config.icon;
        return (
          <div key={i} className={`${config.bg} border ${config.border} rounded-lg p-3`}>
            <div className="flex gap-3">
              <Icon className={`${config.color} flex-shrink-0 w-5 h-5 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className={`${config.color} font-semibold text-sm`}>{alerta.titulo}</div>
                <div className="text-gray-700 text-sm mt-1">{alerta.descricao}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}