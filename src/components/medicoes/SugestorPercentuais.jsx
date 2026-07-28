import React, { useMemo } from 'react';
import { Lightbulb, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function SugestorPercentuais({ orcamento, medicoes, onAplicarSugestoes }) {
  const sugestoes = useMemo(() => {
    if (!orcamento || !orcamento.itens || orcamento.itens.length === 0) return [];

    const hoje = new Date();
    const dataInicio = new Date(orcamento.data_inicio || '2026-01-01');
    const dataFim = new Date(orcamento.data_fim_prevista || '2026-12-31');
    const diasTotais = (dataFim - dataInicio) / (1000 * 60 * 60 * 24);
    const diasDecorridos = (hoje - dataInicio) / (1000 * 60 * 60 * 24);
    const progressoTempo = Math.min(100, (diasDecorridos / diasTotais) * 100);

    return orcamento.itens.map((item, idx) => {
      const medido = medicoes?.filter(m => m.item_orcamento_id === item.id)
        .reduce((acc, m) => acc + (m.percentual_fisico_acumulado || 0), 0) || 0;

      // Sugestão: progressoTempo ou mais agressivo se está adiantado
      const sugesao = Math.max(medido, Math.min(100, progressoTempo * 1.1));

      return {
        index: idx,
        descricao: item.descricao,
        sugestao: Math.round(sugesao * 10) / 10,
        medido,
        confianca: progressoTempo > 50 ? 'alta' : 'media'
      };
    });
  }, [orcamento, medicoes]);

  if (sugestoes.length === 0) {
    return null;
  }

  const handleAplicar = () => {
    onAplicarSugestoes(sugestoes);
  };

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Lightbulb className="w-5 h-5" /> Sugestões Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-800">
          Baseado no cronograma, sugerimos os seguintes percentuais:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto">
          {sugestoes.slice(0, 6).map((sug) => (
            <div key={sug.index} className="p-3 bg-white rounded-lg border border-amber-100">
              <p className="text-sm font-medium text-gray-900 truncate">{sug.descricao}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="text-xs text-gray-600">
                  Medido: <span className="font-semibold text-blue-600">{sug.medido.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  <span className="font-semibold text-green-600">{sug.sugestao.toFixed(1)}%</span>
                </div>
              </div>
              <Badge variant="outline" className="mt-2 text-xs">
                Confiança {sug.confianca}
              </Badge>
            </div>
          ))}
        </div>

        {sugestoes.length > 6 && (
          <p className="text-xs text-amber-700">... e mais {sugestoes.length - 6} itens</p>
        )}

        <Button
          onClick={handleAplicar}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
        >
          Aplicar Sugestões
        </Button>
      </CardContent>
    </Card>
  );
}