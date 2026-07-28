import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function GraficoTempoAprovacao({ requisicoes = [] }) {
  const dados = useMemo(() => {
    if (!requisicoes.length) return [];

    // Calcular tempo de aprovação por status de aprovação
    const statusMap = {
      'pendente': { label: 'Aguardando', tempo: [], requisicoes: 0 },
      'aprovada': { label: 'Aprovada', tempo: [], requisicoes: 0 },
      'rejeitada': { label: 'Rejeitada', tempo: [], requisicoes: 0 }
    };

    requisicoes.forEach(req => {
      const status = req.status_aprovacao || 'pendente';
      if (statusMap[status]) {
        const dataSolicitacao = new Date(req.created_date);
        const dataAprovacao = req.data_aprovacao ? new Date(req.data_aprovacao) : new Date();
        const dias = Math.ceil((dataAprovacao - dataSolicitacao) / (1000 * 60 * 60 * 24));
        
        if (dias >= 0) {
          statusMap[status].tempo.push(dias);
          statusMap[status].requisicoes += 1;
        }
      }
    });

    // Calcular médias
    return Object.entries(statusMap).map(([key, data]) => ({
      status: data.label,
      tempoMedio: data.tempo.length > 0 
        ? (data.tempo.reduce((a, b) => a + b, 0) / data.tempo.length).toFixed(1)
        : 0,
      tempoMaximo: data.tempo.length > 0 ? Math.max(...data.tempo) : 0,
      tempoMinimo: data.tempo.length > 0 ? Math.min(...data.tempo) : 0,
      requisicoes: data.requisicoes
    }));
  }, [requisicoes]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tempo Médio de Aprovação (dias)</CardTitle>
      </CardHeader>
      <CardContent>
        {dados.length === 0 || dados.every(d => d.requisicoes === 0) ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dados} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="status" 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                label={{ value: 'Dias', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value, name) => {
                  if (name === 'tempoMedio') return [value + ' dias', 'Tempo Médio'];
                  if (name === 'tempoMaximo') return [value + ' dias', 'Tempo Máximo'];
                  if (name === 'tempoMinimo') return [value + ' dias', 'Tempo Mínimo'];
                  return [value, name];
                }}
              />
              <Legend />
              <Bar dataKey="tempoMedio" fill="#10b981" name="Tempo Médio" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t">
          {dados.map((item, idx) => (
            <div key={idx} className="text-center">
              <p className="text-xs text-gray-600">{item.status}</p>
              <p className="text-lg font-bold text-gray-900">{item.tempoMedio} dias</p>
              <p className="text-xs text-gray-500">{item.requisicoes} requisição(ões)</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}