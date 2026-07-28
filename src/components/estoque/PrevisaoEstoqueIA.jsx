import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar,
  ShoppingCart,
  Lightbulb,
  RefreshCw,
  Package,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const urgenciaConfig = {
  baixa: { 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle2,
    label: 'Baixa'
  },
  media: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: AlertCircle,
    label: 'Média'
  },
  alta: { 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertTriangle,
    label: 'Alta'
  },
  critica: { 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertTriangle,
    label: 'Crítica'
  }
};

const tipoAlertaConfig = {
  ruptura_iminente: {
    color: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    iconColor: 'text-red-600'
  },
  estoque_excessivo: {
    color: 'bg-blue-50 border-blue-200',
    icon: Package,
    iconColor: 'text-blue-600'
  },
  oportunidade_compra: {
    color: 'bg-green-50 border-green-200',
    icon: ShoppingCart,
    iconColor: 'text-green-600'
  }
};

export default function PrevisaoEstoqueIA() {
  const [expandedMaterial, setExpandedMaterial] = useState(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['previsao-estoque-ia'],
    queryFn: async () => {
      const response = await base44.functions.invoke('preverNecessidadeEstoqueIA', {});
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analisando padrões de consumo...</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.sucesso) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar previsão</h3>
          <Button onClick={() => refetch()} className="mt-4">
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const previsoesCriticas = data.previsoes?.filter(p => p.urgencia === 'critica' || p.urgencia === 'alta') || [];
  const previsoesModeradas = data.previsoes?.filter(p => p.urgencia === 'media') || [];
  const previsoesOk = data.previsoes?.filter(p => p.urgencia === 'baixa') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Previsão Inteligente de Estoque</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Análise de {data.materiais_analisados} materiais • Última atualização: {new Date(data.data_analise).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Alertas Gerais */}
      {data.alertas_gerais?.length > 0 && (
        <div className="grid gap-4">
          {data.alertas_gerais.map((alerta, index) => {
            const config = tipoAlertaConfig[alerta.tipo] || tipoAlertaConfig.ruptura_iminente;
            const Icon = config.icon;
            
            return (
              <Card key={index} className={cn("border-l-4", config.color)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("w-5 h-5 mt-0.5", config.iconColor)} />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alerta.mensagem}</p>
                      {alerta.materiais_afetados?.length > 0 && (
                        <p className="text-sm text-gray-600 mt-1">
                          Materiais: {alerta.materiais_afetados.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Previsões Críticas/Altas */}
      {previsoesCriticas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Atenção Urgente ({previsoesCriticas.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {previsoesCriticas.map((prev) => {
              const UrgenciaIcon = urgenciaConfig[prev.urgencia]?.icon || AlertTriangle;
              const isExpanded = expandedMaterial === prev.material_id;
              
              return (
                <div
                  key={prev.material_id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{prev.material_nome}</h4>
                        <Badge className={urgenciaConfig[prev.urgencia]?.color}>
                          <UrgenciaIcon className="w-3 h-3 mr-1" />
                          {urgenciaConfig[prev.urgencia]?.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{prev.justificativa}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Consumo/dia</p>
                      <p className="font-semibold text-gray-900">{prev.consumo_medio_diario?.toFixed(1) || '0'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Dias restantes
                      </p>
                      <p className="font-semibold text-gray-900">{prev.dias_ate_ruptura || 'N/A'}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 mb-1">Ponto reposição</p>
                      <p className="font-semibold text-blue-900">{prev.ponto_reposicao_sugerido || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 mb-1 flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" />
                        Qtd. pedido
                      </p>
                      <p className="font-semibold text-green-900">{prev.quantidade_pedido_sugerida || 0}</p>
                    </div>
                  </div>

                  {prev.acoes_recomendadas?.length > 0 && (
                    <div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpandedMaterial(isExpanded ? null : prev.material_id)}
                        className="text-blue-600 hover:text-blue-700 p-0 h-auto mb-2"
                      >
                        {isExpanded ? '− Ocultar' : '+ Ver'} ações recomendadas
                      </Button>
                      {isExpanded && (
                        <div className="bg-blue-50 rounded-lg p-3 space-y-1">
                          {prev.acoes_recomendadas.map((acao, i) => (
                            <p key={i} className="text-sm text-blue-800 flex items-start gap-2">
                              <span className="text-blue-600">•</span>
                              {acao}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Previsões Moderadas */}
      {previsoesModeradas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <TrendingUp className="w-5 h-5" />
              Atenção Moderada ({previsoesModeradas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {previsoesModeradas.map((prev) => (
                <div key={prev.material_id} className="border rounded-lg p-3 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{prev.material_nome}</h4>
                    <Badge className="bg-yellow-100 text-yellow-800">
                      {prev.dias_ate_ruptura} dias restantes
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{prev.justificativa}</p>
                  <div className="flex gap-4 text-sm">
                    <span className="text-gray-600">Pedir: <strong>{prev.quantidade_pedido_sugerida}</strong></span>
                    <span className="text-gray-600">Ponto: <strong>{prev.ponto_reposicao_sugerido}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {data.insights?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              Insights e Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <Lightbulb className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status OK */}
      {previsoesOk.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              Estoque Adequado ({previsoesOk.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {previsoesOk.map((prev) => (
                <div key={prev.material_id} className="text-sm p-2 bg-green-50 rounded border border-green-200">
                  <p className="font-medium text-green-900">{prev.material_nome}</p>
                  <p className="text-xs text-green-700">{prev.dias_ate_ruptura} dias de estoque</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}