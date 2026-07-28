import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

export default function RankingObrasProblematicas({ diarios, obraMap, isLoading }) {
  const ranking = useMemo(() => {
    const porObra = {};

    diarios.forEach((d) => {
      if (!d.obra_id) return;

      if (!porObra[d.obra_id]) {
        porObra[d.obra_id] = {
          total: 0,
          problematicos: 0
        };
      }

      porObra[d.obra_id].total += 1;

      // Considerar "problemático" se status_dia != NORMAL
      if (d.status_dia && d.status_dia !== 'NORMAL') {
        porObra[d.obra_id].problematicos += 1;
      }
    });

    // Calcular percentual e formatar
    const resultado = Object.entries(porObra)
      .map(([obraId, dados]) => ({
        obraId,
        obraNome: obraMap[obraId]?.nome || 'Obra Desconhecida',
        totalDias: dados.total,
        diasProblematicos: dados.problematicos,
        percentual: Math.round((dados.problematicos / dados.total) * 100)
      }))
      .sort((a, b) => b.percentual - a.percentual);

    return resultado;
  }, [diarios, obraMap]);

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Obras com Maior % de Dias Problemáticos</CardTitle>
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
          <AlertTriangle className="inline w-4 h-4 mr-2 text-red-500" />
          Obras com Maior % de Dias Problemáticos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Nenhum dado disponível
          </div>
        ) : (
          <div className="space-y-3">
            {ranking.map((item, idx) => {
              const cor =
                item.percentual >= 50 ? 'bg-red-900/20 border-red-700/30' :
                item.percentual >= 25 ? 'bg-yellow-900/20 border-yellow-700/30' :
                'bg-green-900/20 border-green-700/30';

              const textoCor =
                item.percentual >= 50 ? 'text-red-300' :
                item.percentual >= 25 ? 'text-yellow-300' :
                'text-green-300';

              return (
                <div
                  key={item.obraId}
                  className={`border-l-4 p-3 rounded ${cor}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white text-sm">
                        #{idx + 1} {item.obraNome}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {item.diasProblematicos} de {item.totalDias} dias registrados
                      </p>
                    </div>
                    <Badge className={`${textoCor} bg-transparent border-0 text-lg font-bold`}>
                      {item.percentual}%
                    </Badge>
                  </div>

                  {/* Barra de progresso */}
                  <div className="mt-2 h-2 bg-gray-700 rounded overflow-hidden">
                    <div
                      className={`h-full ${
                        item.percentual >= 50
                          ? 'bg-red-500'
                          : item.percentual >= 25
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{ width: `${item.percentual}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}