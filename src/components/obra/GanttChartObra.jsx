import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

export default function GanttChartObra({ obra_id }) {
  const { data: fases } = useQuery({
    queryKey: ['fases', obra_id],
    queryFn: () => base44.entities.Fase.filter({ obra_id })
  });

  const { data: marcos } = useQuery({
    queryKey: ['marcos', obra_id],
    queryFn: () => base44.entities.Marco.filter({ obra_id })
  });

  // Calcular range de datas
  const dateRange = useMemo(() => {
    if (!fases || fases.length === 0) return null;
    const datas = fases.flatMap(f => [new Date(f.data_inicio), new Date(f.data_fim)]);
    const min = new Date(Math.min(...datas));
    const max = new Date(Math.max(...datas));
    return { min, max, dias: Math.ceil((max - min) / (1000 * 60 * 60 * 24)) };
  }, [fases]);

  // Gerar array de datas para header
  const getDateArray = () => {
    if (!dateRange) return [];
    const arr = [];
    for (let i = 0; i <= dateRange.dias; i += 7) {
      const d = new Date(dateRange.min);
      d.setDate(d.getDate() + i);
      arr.push(d);
    }
    return arr;
  };

  // Calcular posição da barra
  const getBarPosition = (dataInicio, dataFim) => {
    const inicio = (new Date(dataInicio) - dateRange.min) / (1000 * 60 * 60 * 24);
    const duracao = (new Date(dataFim) - new Date(dataInicio)) / (1000 * 60 * 60 * 24);
    const percentInicio = (inicio / dateRange.dias) * 100;
    const percentDuracao = (duracao / dateRange.dias) * 100;
    return { left: percentInicio, width: percentDuracao };
  };

  // Status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'concluida':
        return 'bg-green-500';
      case 'em_progresso':
        return 'bg-blue-500';
      case 'atrasada':
        return 'bg-red-500';
      case 'suspensa':
        return 'bg-gray-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'concluida':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'atrasada':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'em_progresso':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (!dateRange) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-600">
          Nenhuma fase cadastrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cronograma da Obra (Gantt)</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-full">
          {/* HEADER COM DATAS */}
          <div className="flex gap-2 mb-4">
            <div className="w-48 flex-shrink-0">
              <p className="text-xs font-bold text-gray-600">Fase</p>
            </div>
            <div className="flex-1 flex gap-1">
              {getDateArray().map((date, i) => (
                <div key={i} className="flex-1 text-center">
                  <p className="text-xs font-bold text-gray-600">
                    {date.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* FASES */}
          <div className="space-y-3">
            {fases?.sort((a, b) => a.ordem - b.ordem).map(fase => {
              const barPosition = getBarPosition(fase.data_inicio, fase.data_fim);
              const marcosFase = marcos?.filter(m => m.fase_id === fase.id) || [];

              return (
                <div key={fase.id}>
                  {/* Barra da fase */}
                  <div className="flex gap-2 items-center">
                    <div className="w-48 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(fase.status)}
                        <div>
                          <p className="text-sm font-medium text-gray-900">{fase.nome}</p>
                          <p className="text-xs text-gray-600">{fase.percentual_concluido}%</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 relative h-8 bg-gray-100 rounded">
                      {/* Barra de progresso */}
                      <div
                        className={`absolute h-full rounded ${getStatusColor(fase.status)} transition-all opacity-80`}
                        style={{
                          left: `${barPosition.left}%`,
                          width: `${barPosition.width}%`,
                          minWidth: '2px'
                        }}
                      />
                      {/* Overlay de percentual concluído */}
                      <div
                        className="absolute h-full bg-green-500 rounded opacity-60"
                        style={{
                          left: `${barPosition.left}%`,
                          width: `${(barPosition.width * fase.percentual_concluido) / 100}%`,
                          minWidth: '1px'
                        }}
                      />
                      {/* Texto de data */}
                      <span className="absolute text-xs text-gray-700 font-semibold mt-1.5 ml-1">
                        {new Date(fase.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Marcos da fase */}
                  {marcosFase.length > 0 && (
                    <div className="ml-48 mt-1 flex gap-2 items-center">
                      <p className="text-xs text-gray-600">Marcos:</p>
                      <div className="flex gap-2">
                        {marcosFase.map(marco => {
                          const diasAtraso = marco.data_realizada
                            ? Math.max(0, (new Date(marco.data_realizada) - new Date(marco.data_prevista)) / (1000 * 60 * 60 * 24))
                            : null;

                          return (
                            <div
                              key={marco.id}
                              className={`px-2 py-1 rounded text-xs font-semibold cursor-help ${
                                marco.status === 'concluido'
                                  ? 'bg-green-100 text-green-800'
                                  : marco.status === 'atrasado'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                              title={`${marco.nome}\n${new Date(marco.data_prevista).toLocaleDateString('pt-BR')}${
                                diasAtraso !== null ? ` (${Math.round(diasAtraso)} dias de atraso)` : ''
                              }`}
                            >
                              ★ {marco.nome}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* LEGENDA */}
          <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-green-500 rounded" />
              <span>Concluída</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-blue-500 rounded" />
              <span>Em Progresso</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-red-500 rounded" />
              <span>Atrasada</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-3 bg-yellow-500 rounded" />
              <span>Não Iniciada</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}