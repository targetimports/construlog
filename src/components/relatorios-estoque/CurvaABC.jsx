import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function CurvaABC({ dados }) {
  if (!dados || dados.length === 0) {
    return <div className="text-gray-500">Sem dados para curva ABC</div>;
  }

  const porClasse = { A: [], B: [], C: [] };
  dados.forEach(m => {
    porClasse[m.classe].push(m);
  });

  const resumo = [
    { classe: 'A', quantidade: porClasse.A.length, percentual: ((porClasse.A.length / dados.length) * 100).toFixed(1), desc: '80% do valor' },
    { classe: 'B', quantidade: porClasse.B.length, percentual: ((porClasse.B.length / dados.length) * 100).toFixed(1), desc: '15% do valor' },
    { classe: 'C', quantidade: porClasse.C.length, percentual: ((porClasse.C.length / dados.length) * 100).toFixed(1), desc: '5% do valor' }
  ];

  const cores = { A: '#EF4444', B: '#F59E0B', C: '#10B981' };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Resumo Curva ABC</CardTitle>
          <p className="text-sm text-gray-600">Distribuição de materiais por classe de importância</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {resumo.map(r => (
              <div key={r.classe} className="p-4 border rounded-lg">
                <Badge className={`${cores[r.classe]} text-white mb-2`}>{r.classe}</Badge>
                <p className="text-2xl font-bold">{r.quantidade}</p>
                <p className="text-sm text-gray-600">{r.percentual}% dos materiais</p>
                <p className="text-xs text-gray-500 mt-2">{r.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Distribuição por Classe</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dados.slice(0, 20)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nome" angle={-45} height={80} interval={0} tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="valor" stroke="#3B82F6" name="Valor (R$)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top 10 Materiais por Valor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dados.slice(0, 10).map((m, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{m.nome}</p>
                  <p className="text-sm text-gray-600">{m.quantidade} unidades</p>
                </div>
                <div className="text-right">
                  <Badge className={`${cores[m.classe]}`}>{m.classe}</Badge>
                  <p className="text-sm font-semibold mt-1">R$ {m.valor.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}