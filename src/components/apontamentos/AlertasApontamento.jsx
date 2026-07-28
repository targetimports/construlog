import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export default function AlertasApontamento({ obraId }) {
  const queryClient = useQueryClient();

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-apontamento', obraId],
    queryFn: () => base44.entities.AlertaApontamento.filter({ obra_id: obraId }, '-created_date', 20),
    enabled: !!obraId,
    refetchInterval: 60000 // Atualizar a cada minuto
  });

  const marcarLidoMutation = useMutation({
    mutationFn: (alertaId) => base44.entities.AlertaApontamento.update(alertaId, { lido: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas-apontamento']);
    }
  });

  const deletarAlertaMutation = useMutation({
    mutationFn: (alertaId) => base44.entities.AlertaApontamento.delete(alertaId),
    onSuccess: () => {
      queryClient.invalidateQueries(['alertas-apontamento']);
    }
  });

  const alertasNaoLidos = alertas.filter(a => !a.lido);

  if (alertas.length === 0) return null;

  const getIconeAlerta = (tipo) => {
    switch(tipo) {
      case 'prazo_proximo':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'divergencia_detectada':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'apontamento_vencido':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <Bell className="w-4 h-4 text-gray-400" />;
    }
  };

  const getCorAlerta = (tipo) => {
    switch(tipo) {
      case 'prazo_proximo':
        return 'border-l-blue-500 bg-blue-500/5';
      case 'divergencia_detectada':
        return 'border-l-amber-500 bg-amber-500/5';
      case 'apontamento_vencido':
        return 'border-l-red-500 bg-red-500/5';
      default:
        return 'border-l-gray-500 bg-gray-500/5';
    }
  };

  return (
    <div className="space-y-2">
      {alertasNaoLidos.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-blue-400 animate-pulse" />
          <span className="text-sm text-gray-400">
            {alertasNaoLidos.length} alerta{alertasNaoLidos.length > 1 ? 's' : ''} não lido{alertasNaoLidos.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {alertas.slice(0, 5).map(alerta => (
        <Card 
          key={alerta.id} 
          className={`bg-gray-800 border-l-4 ${getCorAlerta(alerta.tipo)} ${alerta.lido ? 'opacity-60' : ''}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {getIconeAlerta(alerta.tipo)}
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{alerta.mensagem}</span>
                  {alerta.lido && (
                    <Badge variant="outline" className="border-gray-700 text-gray-500 text-xs">
                      Lido
                    </Badge>
                  )}
                </div>
                {alerta.proxima_data_apontamento && (
                  <div className="text-xs text-gray-500">
                    Próximo apontamento: {new Date(alerta.proxima_data_apontamento).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

              <div className="flex gap-1">
                {!alerta.lido && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => marcarLidoMutation.mutate(alerta.id)}
                    className="text-green-400 hover:bg-green-400/10 h-8 w-8 p-0"
                    title="Marcar como lido"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deletarAlertaMutation.mutate(alerta.id)}
                  className="text-red-400 hover:bg-red-400/10 h-8 w-8 p-0"
                  title="Descartar"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}