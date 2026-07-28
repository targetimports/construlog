import React, { useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const COLORS_NC = {
  crítica: '#dc2626',
  maior: '#f97316',
  menor: '#eab308'
};

export default function DashboardQualidade({ checklists = [], naoConformidades = [], loading = false }) {
  const dados = useMemo(() => {
    if (loading) return null;

    // Dados por severidade de NC
    const ncsrv = Object.entries(
      naoConformidades.reduce((acc, nc) => {
        acc[nc.severidade || 'menor'] = (acc[nc.severidade || 'menor'] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

    // Dados por status de NC
    const ncStatus = Object.entries(
      naoConformidades.reduce((acc, nc) => {
        acc[nc.status || 'aberto'] = (acc[nc.status || 'aberto'] || 0) + 1;
        return acc;
      }, {})
    ).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: name === 'aberto' ? '#ef4444' : name === 'em_andamento' ? '#f59e0b' : '#10b981'
    }));

    // Tendência temporal (últimos 7 dias)
    const hoje = new Date();
    const tendencia = [];
    for (let i = 6; i >= 0; i--) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      const dia = data.toLocaleDateString('pt-BR', { weekday: 'short' });

      const ncsNoDia = naoConformidades.filter(nc => {
        const ncData = new Date(nc.created_date);
        return ncData.toDateString() === data.toDateString();
      }).length;

      tendencia.push({ dia, nc: ncsNoDia });
    }

    return { ncsrv, ncStatus, tendencia };
  }, [naoConformidades, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!dados) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Não-conformidades por Severidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Não-Conformidades por Severidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dados.ncsrv}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dados.ncsrv.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={Object.values(COLORS_NC)[index % 3]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Não-conformidades por Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Não-Conformidades por Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados.ncStatus}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                  {dados.ncStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tendência - Últimos 7 dias */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-sm">Tendência - Últimos 7 Dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados.tendencia}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="nc" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}