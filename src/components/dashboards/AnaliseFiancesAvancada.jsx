import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export default function AnaliseFiancesAvancada({ receitas = [], despesas = [] }) {
  const [periodo, setPeriodo] = useState('mes');
  const [visualizacao, setVisualizacao] = useState('comparativo');

  // Dados simulados
  const dadosComparativo = [
    { mes: 'Janeiro', receitas: 45000, despesas: 32000, resultado: 13000 },
    { mes: 'Fevereiro', receitas: 52000, despesas: 38000, resultado: 14000 },
    { mes: 'Março', receitas: 48000, despesas: 36000, resultado: 12000 },
    { mes: 'Abril', receitas: 61000, despesas: 42000, resultado: 19000 },
  ];

  const dadosCategorias = [
    { name: 'Materiais', value: 35000, fill: '#3B82F6' },
    { name: 'Mão de Obra', value: 28000, fill: '#10B981' },
    { name: 'Equipamentos', value: 18000, fill: '#F59E0B' },
    { name: 'Serviços', value: 12000, fill: '#EF4444' },
    { name: 'Outros', value: 7000, fill: '#8B5CF6' }
  ];

  const totalReceitas = dadosComparativo.reduce((sum, d) => sum + d.receitas, 0);
  const totalDespesas = dadosComparativo.reduce((sum, d) => sum + d.despesas, 0);
  const resultado = totalReceitas - totalDespesas;
  const margemBruta = ((resultado / totalReceitas) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Receitas Totais</p>
                <p className="text-2xl font-bold text-green-600 mt-1">
                  {(totalReceitas / 1000).toFixed(0)}k
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Despesas Totais</p>
                <p className="text-2xl font-bold text-red-600 mt-1">
                  {(totalDespesas / 1000).toFixed(0)}k
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Resultado</p>
                <p className={`text-2xl font-bold mt-1 ${resultado >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {(resultado / 1000).toFixed(0)}k
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-600 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Margem Bruta</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">
                  {margemBruta}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visualizações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Análise Financeira Detalhada</CardTitle>
            <div className="flex gap-2">
              {[
                { id: 'comparativo', label: 'Comparativo' },
                { id: 'categorias', label: 'Por Categoria' },
                { id: 'evolucao', label: 'Evolução' }
              ].map(viz => (
                <Button
                  key={viz.id}
                  variant={visualizacao === viz.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setVisualizacao(viz.id)}
                >
                  {viz.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Gráfico Comparativo */}
          {visualizacao === 'comparativo' && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosComparativo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Legend />
                <Bar dataKey="receitas" fill="#10B981" name="Receitas" radius={[8, 8, 0, 0]} />
                <Bar dataKey="despesas" fill="#EF4444" name="Despesas" radius={[8, 8, 0, 0]} />
                <Bar dataKey="resultado" fill="#3B82F6" name="Resultado" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Gráfico de Categorias */}
          {visualizacao === 'categorias' && (
            <div className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosCategorias}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: R$ ${(value / 1000).toFixed(0)}k`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosCategorias.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Gráfico de Evolução */}
          {visualizacao === 'evolucao' && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosComparativo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Legend />
                <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 5 }} name="Receitas" />
                <Line type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} dot={{ fill: '#EF4444', r: 5 }} name="Despesas" />
                <Line type="monotone" dataKey="resultado" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 5 }} name="Resultado" />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Tabela de Categorias */}
          {visualizacao === 'categorias' && (
            <div className="mt-6 space-y-2">
              {dadosCategorias.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.fill }}></div>
                    <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">R$ {(cat.value / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-gray-600">{((cat.value / totalDespesas) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}