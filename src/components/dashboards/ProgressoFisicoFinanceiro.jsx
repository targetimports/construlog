import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ProgressoFisicoFinanceiro({ obraId }) {
  const [visualizacao, setVisualizacao] = useState('sincronizado');
  const [filtroMes, setFiltroMes] = useState('todos');

  // Dados de progresso
  const dadosProgresso = [
    { mes: 'Jan', fisico_realizado: 5, fisico_planejado: 5, financeiro_realizado: 8, financeiro_planejado: 10, desvio: -2 },
    { mes: 'Fev', fisico_realizado: 12, fisico_planejado: 15, financeiro_realizado: 18, financeiro_planejado: 22, desvio: -4 },
    { mes: 'Mar', fisico_realizado: 22, fisico_planejado: 30, financeiro_realizado: 35, financeiro_planejado: 45, desvio: -10 },
    { mes: 'Abr', fisico_realizado: 32, fisico_planejado: 45, financeiro_realizado: 52, financeiro_planejado: 68, desvio: -16 },
    { mes: 'Mai', fisico_realizado: 45, fisico_planejado: 60, financeiro_realizado: 70, financeiro_planejado: 90, desvio: -20 },
  ];

  const ultimoMes = dadosProgresso[dadosProgresso.length - 1];
  const desvioFisico = ((ultimoMes.fisico_realizado - ultimoMes.fisico_planejado) / ultimoMes.fisico_planejado * 100).toFixed(1);
  const desvioFinanceiro = ((ultimoMes.financeiro_realizado - ultimoMes.financeiro_planejado) / ultimoMes.financeiro_planejado * 100).toFixed(1);

  return (
    <div className="space-y-4">
      {/* Cards de Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card className={`border-l-4 ${desvioFisico < 0 ? 'border-l-orange-500 bg-orange-50' : 'border-l-green-500 bg-green-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Progresso Físico</p>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-gray-900">{ultimoMes.fisico_realizado}%</p>
                  <p className="text-xs text-gray-600 mt-1">Planejado: {ultimoMes.fisico_planejado}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${desvioFisico < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {desvioFisico > 0 ? '+' : ''}{desvioFisico}%
                </p>
                {desvioFisico < 0 ? (
                  <AlertCircle className="w-8 h-8 text-orange-500 mt-2" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-500 mt-2" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${desvioFinanceiro < 0 ? 'border-l-orange-500 bg-orange-50' : 'border-l-green-500 bg-green-50'}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-700">Progresso Financeiro</p>
                <div className="mt-2">
                  <p className="text-2xl font-bold text-gray-900">{ultimoMes.financeiro_realizado}%</p>
                  <p className="text-xs text-gray-600 mt-1">Planejado: {ultimoMes.financeiro_planejado}%</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${desvioFinanceiro < 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {desvioFinanceiro > 0 ? '+' : ''}{desvioFinanceiro}%
                </p>
                {desvioFinanceiro < 0 ? (
                  <AlertCircle className="w-8 h-8 text-orange-500 mt-2" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-green-500 mt-2" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Análise de Progresso</CardTitle>
            <div className="flex gap-2">
              {[
                { id: 'sincronizado', label: 'Sincronizado' },
                { id: 'comparativo', label: 'Comparativo' },
                { id: 'desvios', label: 'Desvios' }
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
          {/* Progresso Sincronizado */}
          {visualizacao === 'sincronizado' && (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={dadosProgresso}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" label={{ value: 'Progresso (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend />
                <Bar yAxisId="left" dataKey="fisico_planejado" fill="#E0E7FF" name="Físico Planejado" radius={[8, 8, 0, 0]} />
                <Bar yAxisId="left" dataKey="fisico_realizado" fill="#6366F1" name="Físico Realizado" radius={[8, 8, 0, 0]} />
                <Line yAxisId="left" type="monotone" dataKey="financeiro_planejado" stroke="#FEF08A" strokeWidth={2} strokeDasharray="5 5" name="Financeiro Planejado" />
                <Line yAxisId="left" type="monotone" dataKey="financeiro_realizado" stroke="#FBBF24" strokeWidth={2} name="Financeiro Realizado" />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Comparativo */}
          {visualizacao === 'comparativo' && (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={dadosProgresso}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="fisico_realizado" fill="#6366F1" name="Físico Realizado" radius={[8, 8, 0, 0]} />
                <Bar dataKey="financeiro_realizado" fill="#FBBF24" name="Financeiro Realizado" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Desvios */}
          {visualizacao === 'desvios' && (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={dadosProgresso}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" stroke="#6b7280" />
                <YAxis stroke="#6b7280" label={{ value: 'Desvio (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="desvio" 
                  stroke="#EF4444" 
                  strokeWidth={3}
                  dot={{ fill: '#EF4444', r: 6 }}
                  activeDot={{ r: 8 }}
                  name="Desvio Financeiro"
                />
              </LineChart>
            </ResponsiveContainer>
          )}

          {/* Tabela Resumida */}
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-gray-900 mb-3">Resumo por Período</p>
            {dadosProgresso.slice(-3).map((dado, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-gray-900">{dado.mes}</p>
                  <div className="flex gap-3 text-xs">
                    <span className="bg-indigo-100 text-indigo-900 px-2 py-1 rounded">F: {dado.fisico_realizado}%</span>
                    <span className="bg-amber-100 text-amber-900 px-2 py-1 rounded">D: {dado.financeiro_realizado}%</span>
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-gray-600">
                  <span>Físico: {dado.fisico_realizado} de {dado.fisico_planejado}% ({((dado.fisico_realizado - dado.fisico_planejado) / dado.fisico_planejado * 100).toFixed(0)}%)</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}