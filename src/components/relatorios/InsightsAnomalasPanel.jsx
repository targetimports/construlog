import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, Lightbulb, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function InsightsAnomalasPanel({ dados, tipo, obraNome, periodo }) {
  const [analise, setAnalise] = useState(null);
  const [expandido, setExpandido] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('analisarAnomalasRelatorioIA', {
        dados,
        contexto: { tipo, obraNome, periodo }
      });
      return response.data;
    },
    onSuccess: (data) => {
      setAnalise(data);
      setExpandido(true);
      toast.success('Análise concluída!');
    },
    onError: (error) => {
      toast.error('Erro ao analisar dados: ' + error.message);
    }
  });

  useEffect(() => {
    if (dados && Object.keys(dados).length > 0) {
      mutation.mutate();
    }
  }, [dados, tipo]);

  if (!analise) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
        <p className="text-sm text-gray-600 mt-2">Analisando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Anomalias */}
      {analise.anomalias?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-3 cursor-pointer hover:bg-red-100/50 p-2 rounded -m-2"
          >
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900">
                {analise.anomalias.length} Anomalia(s) Detectada(s)
              </h4>
              <p className="text-sm text-red-700">{analise.anomalias[0]}</p>
            </div>
          </div>
          {expandido && (
            <div className="mt-3 space-y-2">
              {analise.anomalias.map((anomalia, idx) => (
                <div key={idx} className="text-sm text-red-800 bg-white/50 rounded p-2">
                  • {anomalia}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Insights */}
      {analise.insights?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-3 cursor-pointer hover:bg-blue-100/50 p-2 rounded -m-2"
          >
            <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900">
                {analise.insights.length} Insight(s) Interessante(s)
              </h4>
              <p className="text-sm text-blue-700">{analise.insights[0]}</p>
            </div>
          </div>
          {expandido && (
            <div className="mt-3 space-y-2">
              {analise.insights.map((insight, idx) => (
                <div key={idx} className="text-sm text-blue-800 bg-white/50 rounded p-2">
                  • {insight}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recomendações */}
      {analise.recomendacoes?.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div
            onClick={() => setExpandido(!expandido)}
            className="flex items-center gap-3 cursor-pointer hover:bg-green-100/50 p-2 rounded -m-2"
          >
            <TrendingUp className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900">
                {analise.recomendacoes.length} Recomendação(ões)
              </h4>
              <p className="text-sm text-green-700">{analise.recomendacoes[0]}</p>
            </div>
          </div>
          {expandido && (
            <div className="mt-3 space-y-2">
              {analise.recomendacoes.map((rec, idx) => (
                <div key={idx} className="text-sm text-green-800 bg-white/50 rounded p-2">
                  • {rec}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Análise Completa */}
      {expandido && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Análise Completa</h4>
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {analise.analiseCompleta}
          </div>
        </div>
      )}

      {!expandido && (
        <Button
          onClick={() => setExpandido(true)}
          variant="outline"
          className="w-full"
        >
          Ver Análise Completa
        </Button>
      )}
    </div>
  );
}