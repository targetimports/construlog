import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, ListChecks, AlertCircle } from 'lucide-react';

export default function EstatisticasCronograma({ atividades }) {
  if (!atividades || atividades.length === 0) return null;

  // Calcular estatísticas
  const dataInicio = atividades.reduce((min, a) => 
    new Date(a.dataInicioPlanejada) < new Date(min) ? a.dataInicioPlanejada : min
  , atividades[0].dataInicioPlanejada);

  const dataFim = atividades.reduce((max, a) => 
    new Date(a.dataFimPlanejada) > new Date(max) ? a.dataFimPlanejada : max
  , atividades[0].dataFimPlanejada);

  const diasTotais = Math.ceil(
    (new Date(dataFim) - new Date(dataInicio)) / (1000 * 60 * 60 * 24)
  ) + 1;

  const quantidadeTotalPlanejada = atividades.reduce((sum, a) => 
    sum + (a.quantidadePlanejada || 0), 0
  );

  const unidadesMais = atividades.reduce((acc, a) => {
    acc[a.und] = (acc[a.und] || 0) + 1;
    return acc;
  }, {});

  const unidadeMaisFrequente = Object.entries(unidadesMais).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card className="bg-gradient-to-br from-green-50 to-white border border-green-200 mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          Estatísticas do Cronograma
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total de Atividades */}
          <div className="bg-white border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <ListChecks className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-gray-600">Atividades</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{atividades.length}</p>
          </div>

          {/* Data de Início */}
          <div className="bg-white border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-gray-600">Início</span>
            </div>
            <p className="text-sm font-bold text-blue-700">
              {new Date(dataInicio).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Data de Fim */}
          <div className="bg-white border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-red-600" />
              <span className="text-xs font-medium text-gray-600">Fim</span>
            </div>
            <p className="text-sm font-bold text-red-700">
              {new Date(dataFim).toLocaleDateString('pt-BR')}
            </p>
          </div>

          {/* Duração Total */}
          <div className="bg-white border border-green-100 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-600">Duração</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{diasTotais}d</p>
          </div>
        </div>

        {/* Detalhes Adicionais */}
        <div className="mt-4 pt-4 border-t border-green-100 space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Quantidade Total Planejada:</span>
            <span className="font-semibold text-gray-900">{quantidadeTotalPlanejada.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Unidade Mais Frequente:</span>
            <span className="font-semibold text-gray-900">
              {unidadeMaisFrequente[0]} ({unidadeMaisFrequente[1]} atividades)
            </span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Média de Duração por Atividade:</span>
            <span className="font-semibold text-gray-900">
              {(diasTotais / atividades.length).toFixed(1)} dias
            </span>
          </div>
        </div>

        {/* Aviso se houver cronograma muito curto */}
        {diasTotais < 7 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Cronograma com duração muito curta. Verifique os dados importados.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}