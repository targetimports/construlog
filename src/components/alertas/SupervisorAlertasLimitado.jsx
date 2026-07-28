import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

/**
 * Supervisor de alertas com limite de 3 alertas + "Ver todos"
 * Dedup automática: máximo 1 alerta por problema/obra por dia
 */
export default function SupervisorAlertasLimitado() {
  const { data: alertasData, isLoading, refetch } = useQuery({
    queryKey: ['alertas-unicos-topo'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarAlertasUnicos', {
        limite: 50,
        apenas_ultimas_24h: true
      });
      return res.data;
    },
    refetchInterval: 60000, // a cada 1 min
    staleTime: 30000
  });

  const { alertas = [], total = 0, nao_lidos = 0 } = alertasData || {};

  // Marcar tudo como lido quando der dismiss
  const handleMarcarTodosLidos = async () => {
    await base44.functions.invoke('marcarAlertasComoLidos', {
      marcar_todos_nao_resolvidos: true
    });
    refetch();
  };

  // Pegar apenas os 3 primeiros (já ordenados por severidade e data)
  const alertasTop3 = useMemo(() => {
    return alertas.slice(0, 3);
  }, [alertas]);

  const temMaisAlertas = total > 3;
  const qtdMais = total - 3;

  const getSeveridadeConfig = (severidade) => {
    const config = {
      'CRITICO': { bg: 'bg-red-50', border: 'border-red-200', icon: AlertTriangle, textColor: 'text-red-700' },
      'ATENCAO': { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: AlertCircle, textColor: 'text-yellow-700' },
      'INFO': { bg: 'bg-blue-50', border: 'border-blue-200', icon: Info, textColor: 'text-blue-700' }
    };
    return config[severidade] || config['INFO'];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alertas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm">Nenhum alerta ativo nas últimas 24h.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Alertas ({total})
          {nao_lidos > 0 && (
            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-red-500 text-white text-xs font-bold">
              {nao_lidos}
            </span>
          )}
        </CardTitle>
        {nao_lidos > 0 && (
          <Button variant="ghost" size="sm" onClick={handleMarcarTodosLidos} className="text-xs">
            Marcar tudo lido
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Top 3 Alertas */}
        {alertasTop3.map((alerta) => {
          const config = getSeveridadeConfig(alerta.severidade);
          const Icon = config.icon;

          return (
            <div
              key={alerta.id}
              className={`flex gap-3 p-3 rounded-lg border ${config.bg} ${config.border}`}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.textColor}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${config.textColor}`}>
                  {alerta.tipo}
                </p>
                <p className="text-sm text-gray-700 truncate">{alerta.mensagem}</p>
                {alerta.obra_id && (
                  <p className="text-xs text-gray-600 mt-1">Obra: {alerta.obra_id}</p>
                )}
              </div>
            </div>
          );
        })}

        {/* Se tem mais alertas, mostra badge + link */}
        {temMaisAlertas && (
          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">
              +{qtdMais} mais alerta{qtdMais === 1 ? '' : 's'}
            </p>
            <Link to={createPageUrl('AlertasCompletos')}>
              <Button variant="ghost" size="sm" className="gap-1">
                Ver todos
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}