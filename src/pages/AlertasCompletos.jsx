import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, AlertCircle, Info, Trash2, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AlertasCompletos() {
  const [filtroSeveridade, setFiltroSeveridade] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');

  const { data: alertasData, isLoading, refetch } = useQuery({
    queryKey: ['alertas-completos'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarAlertasUnicos', {
        limite: 200,
        apenas_ultimas_24h: false
      });
      return res.data;
    },
    refetchInterval: 60000,
    staleTime: 30000
  });

  const { alertas = [], total = 0 } = alertasData || {};

  // Filtrar
  const alertasFiltrados = alertas.filter(alerta => {
    const passaSeveridade = filtroSeveridade === 'todos' || alerta.severidade === filtroSeveridade;
    const passaTipo = filtroTipo === 'todos' || alerta.tipo === filtroTipo;
    return passaSeveridade && passaTipo;
  });

  // Extrair tipos únicos
  const tiposUnicos = [...new Set(alertas.map(a => a.tipo))];

  const getSeveridadeConfig = (severidade) => {
    const config = {
      'CRITICO': { bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800', icon: AlertTriangle },
      'ATENCAO': { bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
      'INFO': { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800', icon: Info }
    };
    return config[severidade] || config['INFO'];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Alertas Completos</h1>
        <p className="page-subtitle">
          {total} alerta{total !== 1 ? 's' : ''} nos últimos 30 dias (dedup 24h ativo)
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Severidade</label>
            <Select value={filtroSeveridade} onValueChange={setFiltroSeveridade}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="CRITICO">Crítico</SelectItem>
                <SelectItem value="ATENCAO">Atenção</SelectItem>
                <SelectItem value="INFO">Informação</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo de Alerta</label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {tiposUnicos.map(tipo => (
                  <SelectItem key={tipo} value={tipo}>
                    {tipo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Alertas */}
      <Card>
        <CardHeader>
          <CardTitle>Listagem ({alertasFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : alertasFiltrados.length === 0 ? (
            <p className="text-gray-600 text-center py-8">Nenhum alerta encontrado com estes filtros.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {alertasFiltrados.map((alerta) => {
                const config = getSeveridadeConfig(alerta.severidade);
                const Icon = config.icon;

                return (
                  <div
                    key={alerta.id}
                    className={`flex gap-4 p-4 rounded-lg border ${config.bg} ${config.border}`}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0 mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-2 items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{alerta.tipo}</p>
                          <p className="text-sm text-gray-700 mt-1">{alerta.mensagem}</p>
                          <div className="flex gap-2 items-center mt-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded ${config.badge}`}>
                              {alerta.severidade}
                            </span>
                            {alerta.obra_id && (
                              <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                                Obra: {alerta.obra_id}
                              </span>
                            )}
                            <span className="text-xs text-gray-600">
                              Criado: {format(new Date(alerta.created_at), 'dd MMM HH:mm', { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Archive className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Dedup */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900">
            <strong>ℹDeduplicação ativa:</strong> O mesmo problema/obra é mostrado apenas 1 vez a cada 24h para evitar spam.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}