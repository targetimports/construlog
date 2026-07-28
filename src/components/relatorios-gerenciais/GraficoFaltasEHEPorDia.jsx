import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parseISO, getDay } from 'date-fns';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export default function GraficoFaltasEHEPorDia({ registros, isLoading }) {
  const dadosGrafico = useMemo(() => {
    const acumulado = {
      0: { dia: 'Dom', faltas: 0, he: 0 },
      1: { dia: 'Seg', faltas: 0, he: 0 },
      2: { dia: 'Ter', faltas: 0, he: 0 },
      3: { dia: 'Qua', faltas: 0, he: 0 },
      4: { dia: 'Qui', faltas: 0, he: 0 },
      5: { dia: 'Sex', faltas: 0, he: 0 },
      6: { dia: 'Sab', faltas: 0, he: 0 }
    };

    registros.forEach((r) => {
      const dia = getDay(parseISO(r.data));
      if (r.falta) acumulado[dia].faltas += 1;
      if (r.horas_extra) acumulado[dia].he += r.horas_extra;
    });

    return Object.values(acumulado);
  }, [registros]);

  if (isLoading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Faltas e HE por Dia da Semana</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <div className="h-64 w-full bg-gray-700 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Faltas e HE por Dia da Semana</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={dadosGrafico}
            margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="dia" stroke="#999" />
            <YAxis stroke="#999" />
            <Tooltip
              contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #444' }}
              labelStyle={{ color: '#fff' }}
              formatter={(value) => {
                if (typeof value === 'number') return value.toFixed(1);
                return value;
              }}
            />
            <Legend />
            <Bar dataKey="faltas" fill="#ef4444" name="Faltas" />
            <Bar dataKey="he" fill="#8b5cf6" name="Horas Extras" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}