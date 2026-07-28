import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Clock, BarChart3 } from 'lucide-react';

export default function ResumoDesempenhoProfissional({ registros, profissional }) {
  const resumo = useMemo(() => {
    const totalDias = registros.length;
    const presentes = registros.filter((r) => r.presente).length;
    const faltas = registros.filter((r) => r.falta).length;
    const totalHE = registros.reduce((sum, r) => sum + (r.horas_extra || 0), 0);

    // Percentual de presença
    const percentualPresenca = totalDias > 0 ? Math.round((presentes / totalDias) * 100) : 0;

    return {
      totalDias,
      presentes,
      faltas,
      totalHE,
      percentualPresenca
    };
  }, [registros]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total de dias */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <BarChart3 className="inline w-4 h-4 mr-2" />
            Dias Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white">{resumo.totalDias}</div>
          <p className="text-xs text-gray-500 mt-1">registros no período</p>
        </CardContent>
      </Card>

      {/* Presenças */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <CheckCircle className="inline w-4 h-4 mr-2" />
            Presenças
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-400">{resumo.presentes}</div>
          <div className="text-xs text-gray-500 mt-1">
            {resumo.percentualPresenca}% de presença
          </div>
        </CardContent>
      </Card>

      {/* Faltas */}
      <Card className={`border-gray-700 ${resumo.faltas > 0 ? 'bg-red-900/20' : 'bg-gray-800'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <XCircle className="inline w-4 h-4 mr-2" />
            Faltas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${resumo.faltas > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {resumo.faltas}
          </div>
          <p className="text-xs text-gray-500 mt-1">ausências</p>
        </CardContent>
      </Card>

      {/* Horas Extras */}
      <Card className={`border-gray-700 ${resumo.totalHE > 0 ? 'bg-purple-900/20' : 'bg-gray-800'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <Clock className="inline w-4 h-4 mr-2" />
            Horas Extras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${resumo.totalHE > 0 ? 'text-purple-400' : 'text-gray-400'}`}>
            {resumo.totalHE.toFixed(1)}
          </div>
          <p className="text-xs text-gray-500 mt-1">total acumulado</p>
        </CardContent>
      </Card>
    </div>
  );
}