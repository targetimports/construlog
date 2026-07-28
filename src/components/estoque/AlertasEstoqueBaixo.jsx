import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, AlertCircle, TrendingDown } from 'lucide-react';

export default function AlertasEstoqueBaixo({ almoxariadoId, obraId }) {
  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['alertas-estoque', almoxariadoId],
    queryFn: async () => {
      if (!almoxariadoId) return [];
      const lista = await base44.entities.AlertaDesvio?.filter({
        tipo: 'estoque_baixo',
        almoxarifado_id: almoxariadoId,
        ativa: true
      });
      return lista || [];
    },
    staleTime: 60 * 1000
  });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Carregando alertas...</div>;
  }

  if (alertas.length === 0) {
    return null;
  }

  const criticos = alertas.filter(a => a.severidade === 'alta');
  const normais = alertas.filter(a => a.severidade === 'media');

  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-900">
          <AlertTriangle className="w-5 h-5" />
          Alertas de Estoque
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {criticos.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-red-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> CRÍTICO ({criticos.length})
            </h4>
            {criticos.map(alerta => (
              <div key={alerta.id} className="p-2 bg-red-100 border-l-4 border-red-500 rounded">
                <p className="text-sm font-semibold text-red-900">{alerta.titulo}</p>
                <p className="text-xs text-red-800">{alerta.descricao}</p>
              </div>
            ))}
          </div>
        )}

        {normais.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-yellow-900 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> BAIXO ({normais.length})
            </h4>
            {normais.map(alerta => (
              <div key={alerta.id} className="p-2 bg-yellow-100 border-l-4 border-yellow-500 rounded">
                <p className="text-sm font-semibold text-yellow-900">{alerta.titulo}</p>
                <p className="text-xs text-yellow-800">{alerta.descricao}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}