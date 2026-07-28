import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar } from 'lucide-react';

export default function GraficosKPIsAvancado({ metricas = [], titulo = 'KPIs' }) {
  const [periodo, setPeriodo] = useState('mes');
  const [tipoGrafico, setTipoGrafico] = useState('linha');

  // Dados simulados por período
  const dadosPorPeriodo = {
    semana: [
      { data: 'Seg', valor: 45, meta: 50 },
      { data: 'Ter', valor: 52, meta: 50 },
      { data: 'Qua', valor: 48, meta: 50 },
      { data: 'Qui', valor: 61, meta: 50 },
      { data: 'Sex', valor: 55, meta: 50 },
      { data: 'Sab', valor: 67, meta: 50 },
      { data: 'Dom', valor: 70, meta: 50 }
    ],
    mes: [
      { data: 'Sem 1', valor: 50, meta: 55 },
      { data: 'Sem 2', valor: 58, meta: 55 },
      { data: 'Sem 3', valor: 62, meta: 55 },
      { data: 'Sem 4', valor: 65, meta: 55 }
    ],
    trimestre: [
      { data: 'Jan', valor: 48, meta: 55 },
      { data: 'Fev', valor: 60, meta: 55 },
      { data: 'Mar', valor: 65, meta: 55 }
    ],
    ano: [
      { data: 'Q1', valor: 58, meta: 60 },
      { data: 'Q2', valor: 64, meta: 60 },
      { data: 'Q3', valor: 72, meta: 60 },
      { data: 'Q4', valor: 70, meta: 60 }
    ]
  };

  const dados = dadosPorPeriodo[periodo];
  const cores = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const renderGrafico = () => {
    switch (tipoGrafico) {
      case 'linha':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="data" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Line type="monotone" dataKey="valor" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 5 }} activeDot={{ r: 7 }} name="Realizado" />
              <Line type="monotone" dataKey="meta" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#10B981', r: 5 }} name="Meta" />
            </LineChart>
          </ResponsiveContainer>
        );
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={dados}>
              <defs>
                <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="data" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Area type="monotone" dataKey="valor" stroke="#3B82F6" fillOpacity={1} fill="url(#colorValor)" name="Realizado" />
              <Line type="monotone" dataKey="meta" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" name="Meta" />
            </AreaChart>
          </ResponsiveContainer>
        );
      case 'barras':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={dados}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="data" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Legend />
              <Bar dataKey="valor" fill="#3B82F6" name="Realizado" radius={[8, 8, 0, 0]} />
              <Bar dataKey="meta" fill="#10B981" opacity={0.6} name="Meta" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  // Cálculo de estatísticas
  const totalRealizado = dados.reduce((sum, d) => sum + d.valor, 0);
  const media = (totalRealizado / dados.length).toFixed(1);
  const maxValor = Math.max(...dados.map(d => d.valor));
  const minValor = Math.min(...dados.map(d => d.valor));
  const variacao = ((maxValor - minValor) / minValor * 100).toFixed(1);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{titulo}</CardTitle>
            <div className="flex gap-2">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="semana">Última Semana</option>
                <option value="mes">Último Mês</option>
                <option value="trimestre">Trimestre</option>
                <option value="ano">Ano</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Tipos de Gráfico */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'linha', label: 'Linha' },
              { id: 'area', label: 'Área' },
              { id: 'barras', label: 'Barras' }
            ].map(tipo => (
              <Button
                key={tipo.id}
                variant={tipoGrafico === tipo.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTipoGrafico(tipo.id)}
              >
                {tipo.label}
              </Button>
            ))}
          </div>

          {/* Gráfico */}
          {renderGrafico()}

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs font-semibold text-gray-700">Média</p>
              <p className="text-lg font-bold text-blue-600">{media}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-semibold text-gray-700">Máximo</p>
              <p className="text-lg font-bold text-green-600">{maxValor}</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
              <p className="text-xs font-semibold text-gray-700">Mínimo</p>
              <p className="text-lg font-bold text-orange-600">{minValor}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-xs font-semibold text-gray-700">Variação</p>
              <p className="text-lg font-bold text-purple-600">{variacao}%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}