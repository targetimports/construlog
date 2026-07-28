import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const severityConfig = {
  CRITICO: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  AVISO: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  INFO: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' }
};

export default function DesviosMedicaoAlerts({ obra_id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [obra_id]);

  const loadData = async () => {
    try {
      setLoading(false);
      const result = await base44.functions.invoke('getDesviosMedicao', {
        obra_id,
        threshold_atraso: 10,
        threshold_desvio: 5
      });
      setData(result.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-24 bg-gray-100 rounded animate-pulse" />;

  if (!data?.alertas?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Desvios & Anomalias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 items-center text-green-700 text-sm">
            <CheckCircle2 className="w-5 h-5" />
            Nenhum desvio detectado
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          Desvios & Anomalias ({data.total_alertas})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.alertas.map((alerta, idx) => {
          const config = severityConfig[alerta.severidade];
          const Icon = config.icon;
          return (
            <div 
              key={idx}
              className={`flex gap-3 p-3 rounded border ${config.bg} ${config.border}`}
            >
              <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 text-sm">
                <p className={`font-semibold ${config.color}`}>
                  {alerta.tipo}
                </p>
                <p className="text-gray-700 text-xs mt-0.5">{alerta.mensagem}</p>
                <p className="text-gray-600 text-xs mt-1 font-mono">
                  Valor: {alerta.valor}
                </p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}