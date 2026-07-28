import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Users, Clock, TrendingUp } from 'lucide-react';

export default function ResumoRelatorioDiario({
  diarios,
  equipeData,
  motivosData
}) {
  const resumo = useMemo(() => {
    // Total de dias com registro
    const totalDias = diarios.length;

    // Total de faltas
    const totalFaltas = equipeData.reduce((sum, reg) => sum + (reg.falta ? 1 : 0), 0);

    // Total de horas extras
    const totalHE = equipeData.reduce((sum, reg) => sum + (reg.horas_extra || 0), 0);

    // Top 3 motivos mais frequentes
    const contagemMotivos = {};
    motivosData.forEach((m) => {
      contagemMotivos[m.motivo_id] = (contagemMotivos[m.motivo_id] || 0) + 1;
    });

    const topMotivos = Object.entries(contagemMotivos)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    // Dias paralisados
    const diasParalisados = diarios.filter((d) => d.status_dia === 'PARALISADO').length;

    return {
      totalDias,
      totalFaltas,
      totalHE,
      topMotivos,
      diasParalisados
    };
  }, [diarios, equipeData, motivosData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total de dias */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <Calendar className="inline w-4 h-4 mr-2" />
            Dias Registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white">{resumo.totalDias}</div>
          <p className="text-xs text-gray-500 mt-1">diários com entrada</p>
        </CardContent>
      </Card>

      {/* Total de faltas */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <Users className="inline w-4 h-4 mr-2" />
            Total de Faltas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-400">{resumo.totalFaltas}</div>
          <p className="text-xs text-gray-500 mt-1">registros de falta</p>
        </CardContent>
      </Card>

      {/* Total de HE */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <Clock className="inline w-4 h-4 mr-2" />
            Horas Extras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-400">{resumo.totalHE.toFixed(1)}</div>
          <p className="text-xs text-gray-500 mt-1">total acumulado</p>
        </CardContent>
      </Card>

      {/* Dias paralisados */}
      <Card className={`border-gray-700 ${resumo.diasParalisados > 0 ? 'bg-orange-900/20' : 'bg-gray-800'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-gray-300">
            <AlertCircle className="inline w-4 h-4 mr-2" />
            Dias Paralisados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${resumo.diasParalisados > 0 ? 'text-orange-400' : 'text-gray-400'}`}>
            {resumo.diasParalisados}
          </div>
          <p className="text-xs text-gray-500 mt-1">paralisações registradas</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Calendar({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}