import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GraficoGastosComTempo({ requisicoes = [], periodo = 'mes' }) {
  const dados = useMemo(() => {
    if (!requisicoes.length) return [];

    const agora = new Date();
    let dataInicio = new Date();
    let intervalo = 1; // dias

    switch (periodo) {
      case 'mes':
        dataInicio = startOfMonth(agora);
        intervalo = 1;
        break;
      case 'trimestre':
        dataInicio = startOfQuarter(agora);
        intervalo = 7;
        break;
      case 'ano':
        dataInicio = startOfYear(agora);
        intervalo = 30;
        break;
      default:
        dataInicio = startOfMonth(agora);
    }

    // Agrupar dados por período
    const mapa = new Map();
    
    requisicoes.forEach(req => {
      const dataReq = new Date(req.created_date);
      if (dataReq >= dataInicio && dataReq <= agora) {
        let chave;
        if (periodo === 'mes') {
          chave = format(dataReq, 'dd/MM', { locale: ptBR });
        } else if (periodo === 'trimestre') {
          chave = format(dataReq, 'dd MMM', { locale: ptBR });
        } else {
          chave = format(dataReq, 'MMM', { locale: ptBR });
        }

        if (!mapa.has(chave)) {
          mapa.set(chave, { periodo: chave, valor: 0, quantidade: 0 });
        }
        const item = mapa.get(chave);
        item.valor += req.valor_total_estimado || 0;
        item.quantidade += 1;
      }
    });

    return Array.from(mapa.values());
  }, [requisicoes, periodo]);

  const maiorValor = dados.length > 0 ? Math.max(...dados.map(d => d.valor)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Tendência de Gastos</span>
          <span className="text-sm font-normal text-gray-600">
            {periodo === 'mes' ? 'Por dia' : periodo === 'trimestre' ? 'Por semana' : 'Por mês'}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Nenhum dado disponível para este período
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="periodo" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value) => [
                  `R$ ${(value / 1000).toFixed(1)}K`,
                  'Valor'
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="valor"
                stroke="#3b82f6"
                dot={{ fill: '#3b82f6', r: 4 }}
                activeDot={{ r: 6 }}
                strokeWidth={2}
                name="Valor Total"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}