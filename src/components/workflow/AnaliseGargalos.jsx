import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Zap, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AnaliseGargalos() {
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisar = async () => {
    setAnalisando(true);
    try {
      const response = await base44.functions.invoke('analisarGargalosWorkflow', {});
      setResultado(response.data);
    } catch (error) {
      console.error('Erro ao analisar:', error);
    } finally {
      setAnalisando(false);
    }
  };

  const severidadeConfig = {
    critica: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: '' },
    alta: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '' },
    media: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: '' },
    baixa: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: '' }
  };

  const dificuldadeConfig = {
    baixa: { color: 'text-emerald-400', label: 'Fácil' },
    media: { color: 'text-amber-400', label: 'Médio' },
    alta: { color: 'text-red-400', label: 'Difícil' }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-purple-500" />
              <CardTitle className="text-white">Análise de Gargalos com IA</CardTitle>
            </div>
            <Button
              onClick={analisar}
              disabled={analisando}
              className="bg-purple-500 hover:bg-purple-600"
            >
              {analisando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Analisar Workflows
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!resultado && !analisando && (
            <div className="text-center py-8">
              <Zap className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">Clique em "Analisar Workflows" para identificar gargalos e receber sugestões de otimização</p>
            </div>
          )}

          {analisando && (
            <div className="text-center py-8">
              <Loader2 className="w-16 h-16 text-purple-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400">A IA está analisando seus workflows...</p>
            </div>
          )}

          {resultado?.analise && (
            <div className="space-y-6">
              {/* Resumo Geral */}
              {resultado.analise.resumo_geral && (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Resumo Geral
                  </h4>
                  <p className="text-gray-300 text-sm">{resultado.analise.resumo_geral}</p>
                </div>
              )}

              {/* Gargalos Identificados */}
              {resultado.analise.gargalos_identificados && resultado.analise.gargalos_identificados.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Gargalos Identificados ({resultado.analise.gargalos_identificados.length})
                  </h4>
                  <div className="space-y-3">
                    {resultado.analise.gargalos_identificados.map((gargalo, idx) => {
                      const config = severidadeConfig[gargalo.severidade] || severidadeConfig.media;
                      return (
                        <div key={idx} className={cn("p-4 rounded-xl border", config.color)}>
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-semibold">{gargalo.workflow_nome}</h5>
                            <Badge className={config.color}>
                              {config.icon} {gargalo.severidade}
                            </Badge>
                          </div>
                          <p className="text-sm mb-2">{gargalo.problema}</p>
                          <p className="text-xs opacity-75">Impacto: {gargalo.impacto}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Otimizações Sugeridas */}
              {resultado.analise.otimizacoes_sugeridas && resultado.analise.otimizacoes_sugeridas.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Otimizações Sugeridas ({resultado.analise.otimizacoes_sugeridas.length})
                  </h4>
                  <div className="space-y-3">
                    {resultado.analise.otimizacoes_sugeridas.map((otimizacao, idx) => {
                      const difConfig = dificuldadeConfig[otimizacao.dificuldade] || dificuldadeConfig.media;
                      return (
                        <div key={idx} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="text-emerald-400 font-semibold">{otimizacao.workflow_nome}</h5>
                            <Badge className="bg-gray-800 text-gray-300">
                              Dificuldade: <span className={difConfig.color}>{difConfig.label}</span>
                            </Badge>
                          </div>
                          <p className="text-gray-300 text-sm mb-2">{otimizacao.sugestao}</p>
                          <p className="text-emerald-400 text-xs">
                            Benefício: {otimizacao.beneficio_esperado}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}