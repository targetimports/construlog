import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Image, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const StatusDiaConfig = {
  NORMAL: { bg: 'bg-green-900/30', text: 'text-green-400', label: '✓ Normal' },
  MEIO_PERIODO: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', label: 'Meio período' },
  PARALISADO: { bg: 'bg-red-900/30', text: 'text-red-400', label: 'Paralisado' },
  CHUVA: { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'Chuva' },
  OUTRO: { bg: 'bg-gray-900/30', text: 'text-gray-400', label: 'Outro' }
};

export default function TabelaDiarioDias({
  diarios,
  equipeData,
  motivosData,
  isLoading,
  onVisualizarDiario
}) {
  const [expandidos, setExpandidos] = useState(new Set());

  const toggleExpandir = (diarioId) => {
    const novo = new Set(expandidos);
    if (novo.has(diarioId)) {
      novo.delete(diarioId);
    } else {
      novo.add(diarioId);
    }
    setExpandidos(novo);
  };

  const getDadosDia = (diarioId) => {
    const faltas = equipeData.filter((e) => e.diario_id === diarioId && e.falta).length;
    const horasExtra = equipeData
      .filter((e) => e.diario_id === diarioId)
      .reduce((sum, e) => sum + (e.horas_extra || 0), 0);
    const motivos = motivosData.filter((m) => m.diario_id === diarioId);
    const totalMidias = (diarios.find((d) => d.id === diarioId)?.fotos || []).length;

    return { faltas, horasExtra, motivos, totalMidias };
  };

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Resumo Diário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-700 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">
          Resumo Diário ({diarios.length} dias)
        </CardTitle>
      </CardHeader>

      <CardContent>
        {diarios.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            Nenhum diário encontrado no período
          </div>
        ) : (
          <div className="space-y-3">
            {diarios.map((diario) => {
              const isExpandido = expandidos.has(diario.id);
              const dados = getDadosDia(diario.id);
              const config = StatusDiaConfig[diario.status_dia || 'NORMAL'];

              return (
                <div key={diario.id} className="border border-gray-700 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div
                    className={`${config.bg} p-4 cursor-pointer hover:opacity-80 transition-opacity`}
                    onClick={() => toggleExpandir(diario.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-semibold text-white">
                            {format(parseISO(diario.data), 'EEEE, dd MMM yyyy', {
                              locale: ptBR
                            })}
                          </span>
                          <Badge className={`${config.bg} ${config.text} border-0`}>
                            {config.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300">
                          {diario.atividades_realizadas || 'Sem atividades descritas'}
                        </p>
                      </div>

                      {/* KPIs rápidos */}
                      <div className="flex gap-4 text-right">
                        {dados.faltas > 0 && (
                          <div className="text-xs">
                            <div className="text-red-400 font-semibold">{dados.faltas}</div>
                            <div className="text-gray-500">faltas</div>
                          </div>
                        )}
                        {dados.horasExtra > 0 && (
                          <div className="text-xs">
                            <div className="text-green-400 font-semibold">{dados.horasExtra.toFixed(1)}</div>
                            <div className="text-gray-500">HE</div>
                          </div>
                        )}
                        {dados.totalMidias > 0 && (
                          <div className="text-xs">
                            <div className="text-blue-400 font-semibold">{dados.totalMidias}</div>
                            <div className="text-gray-500">mídias</div>
                          </div>
                        )}
                      </div>

                      {/* Toggle */}
                      <button className="text-gray-400 hover:text-white transition-colors">
                        {isExpandido ? '−' : '+'}
                      </button>
                    </div>
                  </div>

                  {/* Expandido */}
                  {isExpandido && (
                    <div className="bg-gray-900/50 p-4 border-t border-gray-700 space-y-4">
                      {/* Informações gerais */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                          <p className="text-xs text-gray-500">Responsável</p>
                          <p className="text-sm font-medium text-white">{diario.responsavel || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Funcionários</p>
                          <p className="text-sm font-medium text-white">{diario.qtd_funcionarios || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Clima</p>
                          <p className="text-sm font-medium text-white">{diario.clima || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Temperatura</p>
                          <p className="text-sm font-medium text-white">{diario.temperatura || '—'}</p>
                        </div>
                      </div>

                      {/* Observações */}
                      {diario.observacoes && (
                        <div className="bg-gray-800 p-3 rounded border border-gray-700">
                          <p className="text-xs font-semibold text-gray-400 mb-1">Observações</p>
                          <p className="text-sm text-gray-300">{diario.observacoes}</p>
                        </div>
                      )}

                      {/* Motivos de baixa produção */}
                      {dados.motivos.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">
                            Motivos de Baixa Produção
                          </p>
                          <div className="space-y-1">
                            {dados.motivos.map((m) => (
                              <div key={m.id} className="text-xs text-gray-300">
                                • {m.motivo_id} {m.observacao && `— ${m.observacao}`}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Botão de ação */}
                      <Button
                        onClick={() => onVisualizarDiario?.(diario.id)}
                        variant="outline"
                        size="sm"
                        className="w-full border-gray-600 text-gray-300 gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Visualizar Diário Completo
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}