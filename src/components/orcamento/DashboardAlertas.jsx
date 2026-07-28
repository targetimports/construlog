import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function DashboardAlertas({ orcamentoId }) {
  const [filtroSeveridade, setFiltroSeveridade] = useState('todos');
  const queryClient = useQueryClient();

  const { data: alertas = [], isLoading } = useQuery({
    queryKey: ['alertas', orcamentoId],
    queryFn: () => base44.entities.AlertaDesvio.filter({ 
      orcamento_id: orcamentoId,
      status: 'ativo'
    }),
    enabled: !!orcamentoId
  });

  const resolverMutation = useMutation({
    mutationFn: (alertaId) => base44.entities.AlertaDesvio.update(alertaId, { 
      status: 'resolvido',
      data_resolucao: new Date().toISOString()
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      toast.success('Alerta resolvido');
    }
  });

  const ignorarMutation = useMutation({
    mutationFn: (alertaId) => base44.entities.AlertaDesvio.update(alertaId, { 
      status: 'ignorado'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertas'] });
      toast.success('Alerta ignorado');
    }
  });

  const getIconAlerta = (tipo) => {
    if (tipo === 'sobre_orcado' || tipo === 'margem_baixa') return <AlertTriangle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
  };

  const getSeveridadeColor = (severidade) => {
    switch (severidade) {
      case 'critica':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'alta':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'media':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const filtrados = alertas.filter(a => 
    filtroSeveridade === 'todos' || a.severidade === filtroSeveridade
  );

  const contagemPorSeveridade = {
    critica: alertas.filter(a => a.severidade === 'critica').length,
    alta: alertas.filter(a => a.severidade === 'alta').length,
    media: alertas.filter(a => a.severidade === 'media').length,
    baixa: alertas.filter(a => a.severidade === 'baixa').length
  };

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-red-600">{contagemPorSeveridade.critica}</p>
              <p className="text-xs text-gray-600 mt-1">Críticos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-orange-600">{contagemPorSeveridade.alta}</p>
              <p className="text-xs text-gray-600 mt-1">Altos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-600">{contagemPorSeveridade.media}</p>
              <p className="text-xs text-gray-600 mt-1">Médios</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{alertas.length}</p>
              <p className="text-xs text-gray-600 mt-1">Total</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {['todos', 'critica', 'alta', 'media', 'baixa'].map(sev => (
          <Button
            key={sev}
            size="sm"
            variant={filtroSeveridade === sev ? 'default' : 'outline'}
            onClick={() => setFiltroSeveridade(sev)}
            className="capitalize"
          >
            {sev === 'todos' ? 'Todos' : sev}
          </Button>
        ))}
      </div>

      {/* Lista de Alertas */}
      <div className="space-y-3">
        {filtrados.length === 0 ? (
          <Card className="bg-green-50">
            <CardContent className="py-8 text-center">
              <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-700 font-medium">Nenhum alerta nesta categoria</p>
            </CardContent>
          </Card>
        ) : (
          filtrados.map(alerta => (
            <Card 
              key={alerta.id}
              className={cn(
                'border-l-4 transition-all',
                alerta.severidade === 'critica' ? 'border-l-red-500 bg-red-50' :
                alerta.severidade === 'alta' ? 'border-l-orange-500 bg-orange-50' :
                alerta.severidade === 'media' ? 'border-l-yellow-500 bg-yellow-50' :
                'border-l-blue-500 bg-blue-50'
              )}
            >
              <CardContent className="pt-6">
                <div className="flex gap-4 items-start">
                  <div className={cn(
                    'p-2 rounded-lg',
                    alerta.severidade === 'critica' ? 'bg-red-200' :
                    alerta.severidade === 'alta' ? 'bg-orange-200' :
                    alerta.severidade === 'media' ? 'bg-yellow-200' :
                    'bg-blue-200'
                  )}>
                    {getIconAlerta(alerta.tipo_alerta)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900">
                          {alerta.tipo_alerta === 'sobre_orcado' ? 'Sobre Orçado' :
                           alerta.tipo_alerta === 'margem_baixa' ? 'Margem Baixa' :
                           alerta.tipo_alerta === 'desvio_custo' ? 'Desvio de Custo' :
                           alerta.tipo_alerta === 'desvio_cronograma' ? 'Desvio de Cronograma' :
                           'Item Crítico'}
                        </h4>
                        <p className="text-sm text-gray-600 mt-1">{alerta.descricao}</p>
                      </div>
                      <Badge className={getSeveridadeColor(alerta.severidade)}>
                        {alerta.percentual_desvio.toFixed(1)}%
                      </Badge>
                    </div>

                    {alerta.valor_orcado && (
                      <div className="text-xs text-gray-600 mb-3 bg-white/50 rounded p-2">
                        Orçado: R$ {alerta.valor_orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                        Realizado: R$ {alerta.valor_realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700 gap-1"
                        onClick={() => resolverMutation.mutate(alerta.id)}
                      >
                        <Check className="w-4 h-4" />
                        Resolvido
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-700 gap-1"
                        onClick={() => ignorarMutation.mutate(alerta.id)}
                      >
                        <X className="w-4 h-4" />
                        Ignorar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}