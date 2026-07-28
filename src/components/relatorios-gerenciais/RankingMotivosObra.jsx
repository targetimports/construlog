import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';

export default function RankingMotivosObra({ motivos, obraMap, isLoading }) {
  const ranking = useMemo(() => {
    const mapa = {};

    motivos.forEach((m) => {
      if (!m.motivo_id) return;

      const key = `${m.diario_id}-${m.motivo_id}`;
      if (!mapa[m.diario_id]) {
        mapa[m.diario_id] = {};
      }

      if (!mapa[m.diario_id][m.motivo_id]) {
        mapa[m.diario_id][m.motivo_id] = 0;
      }
      mapa[m.diario_id][m.motivo_id] += 1;
    });

    // Agregar por obra
    const porObra = {};

    Object.entries(mapa).forEach(([diarioId, motivosObra]) => {
      Object.entries(motivosObra).forEach(([motivoId, count]) => {
        const motivo = motivos.find((m) => m.motivo_id === motivoId);
        if (!motivo) return;

        const obraId = motivo.obra_id;
        if (!porObra[obraId]) {
          porObra[obraId] = {};
        }

        const nomeMotivo = motivo.motivo_nome || `Motivo ${motivoId}`;
        if (!porObra[obraId][nomeMotivo]) {
          porObra[obraId][nomeMotivo] = 0;
        }
        porObra[obraId][nomeMotivo] += 1;
      });
    });

    // Formatar para exibição
    const resultado = [];
    Object.entries(porObra).forEach(([obraId, motivosCount]) => {
      const obra = obraMap[obraId];
      const motivosRanked = Object.entries(motivosCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      resultado.push({
        obraId,
        obraNome: obra?.nome || 'Obra Desconhecida',
        motivos: motivosRanked
      });
    });

    return resultado.sort((a, b) => {
      const totalA = a.motivos.reduce((s, m) => s + m[1], 0);
      const totalB = b.motivos.reduce((s, m) => s + m[1], 0);
      return totalB - totalA;
    });
  }, [motivos, obraMap]);

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Motivos Mais Comuns por Obra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-700 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">
          <TrendingUp className="inline w-4 h-4 mr-2" />
          Motivos Mais Comuns por Obra
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Nenhum motivo registrado
          </div>
        ) : (
          <div className="space-y-4">
            {ranking.map((item) => (
              <div key={item.obraId} className="border-l-4 border-blue-500 pl-4 py-2">
                <p className="font-semibold text-white text-sm">{item.obraNome}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.motivos.map(([motivo, count]) => (
                    <Badge
                      key={motivo}
                      className="bg-orange-900/40 text-orange-300 border-orange-700/50"
                    >
                      {motivo}
                      <span className="ml-1.5 font-semibold">({count})</span>
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}