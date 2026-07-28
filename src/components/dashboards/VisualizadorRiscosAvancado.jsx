import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { AlertTriangle, TrendingUp } from 'lucide-react';

export default function VisualizadorRiscosAvancado({ riscos = [] }) {
  const [visualizacao, setVisualizacao] = useState('matriz');
  const [filtroSeveridade, setFiltroSeveridade] = useState('todos');

  // Dados de riscos por categoria
  const riscosPorCategoria = [
    { categoria: 'Fornecedor', risco: 8, ocorrencia: 6, impacto: 9 },
    { categoria: 'Cronograma', risco: 7, ocorrencia: 5, impacto: 8 },
    { categoria: 'Orçamento', risco: 6, ocorrencia: 7, impacto: 7 },
    { categoria: 'Qualidade', risco: 4, ocorrencia: 3, impacto: 6 },
    { categoria: 'RH', risco: 5, ocorrencia: 4, impacto: 5 },
  ];

  // Matriz de Risco
  const matrizRiscos = [
    { nome: 'Atraso Fornecedor A', probabilidade: 8, impacto: 9, severidade: 7.5, tipo: 'Fornecedor' },
    { nome: 'Estouro Orçamento', probabilidade: 6, impacto: 8, severidade: 7, tipo: 'Orçamento' },
    { nome: 'Falta de Mão de Obra', probabilidade: 7, impacto: 7, severidade: 7, tipo: 'RH' },
    { nome: 'Mudança de Especificação', probabilidade: 5, impacto: 6, severidade: 5.5, tipo: 'Cronograma' },
    { nome: 'Não Conformidade', probabilidade: 3, impacto: 5, severidade: 4, tipo: 'Qualidade' },
  ];

  // Distribuição de riscos
  const distribuicao = [
    { nivel: 'Crítico (8-10)', quantidade: 2, cor: '#EF4444' },
    { nivel: 'Alto (5-7)', quantidade: 8, cor: '#F59E0B' },
    { nivel: 'Médio (3-4)', quantidade: 5, cor: '#FBBF24' },
    { nivel: 'Baixo (1-2)', quantidade: 1, cor: '#10B981' },
  ];

  // Radar para análise de risco
  const radarData = [
    { assunto: 'Fornecedor', valor: 8 },
    { assunto: 'Cronograma', valor: 7 },
    { assunto: 'Orçamento', valor: 6 },
    { assunto: 'Qualidade', valor: 4 },
    { assunto: 'Recursos', valor: 5 },
    { assunto: 'Segurança', valor: 6 },
  ];

  const cores = {
    'Fornecedor': '#3B82F6',
    'Cronograma': '#F59E0B',
    'Orçamento': '#EF4444',
    'RH': '#8B5CF6',
    'Qualidade': '#10B981'
  };

  return (
    <div className="space-y-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Riscos Críticos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">2</p>
            <p className="text-xs text-red-600 mt-1">Ação imediata</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Riscos Altos</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">8</p>
            <p className="text-xs text-orange-600 mt-1">Monitorar</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Score Médio de Risco</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">6.1</p>
            <p className="text-xs text-yellow-600 mt-1">De 0-10</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-gray-700">Tendência</p>
            <div className="flex items-center gap-2 mt-2">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              <p className="text-lg font-bold text-orange-600">+15%</p>
            </div>
            <p className="text-xs text-gray-600 mt-1">Aumento em 7 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Visualizações */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Análise de Riscos Detalhada</CardTitle>
            <div className="flex gap-2">
              {[
                { id: 'matriz', label: 'Matriz' },
                { id: 'radar', label: 'Radar' },
                { id: 'categoria', label: 'Categoria' },
                { id: 'distribuicao', label: 'Distribuição' }
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
          {/* Matriz de Risco */}
          {visualizacao === 'matriz' && (
            <div>
              <ResponsiveContainer width="100%" height={350}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="probabilidade" 
                    name="Probabilidade" 
                    type="number"
                    domain={[0, 10]}
                    label={{ value: 'Probabilidade →', position: 'bottom', offset: 10 }}
                    stroke="#6b7280"
                  />
                  <YAxis 
                    dataKey="impacto" 
                    name="Impacto" 
                    type="number"
                    domain={[0, 10]}
                    label={{ value: '← Impacto', angle: -90, position: 'insideLeft' }}
                    stroke="#6b7280"
                  />
                  <Tooltip 
                    cursor={{ strokeDasharray: '3 3' }}
                    contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    formatter={(value, name) => name === 'nome' ? value : `${name}: ${value}`}
                  />
                  <Scatter name="Riscos" data={matrizRiscos} fill="#3B82F6">
                    {matrizRiscos.map((entry, index) => (
                      <circle key={`circle-${index}`} cx={0} cy={0} r={entry.severidade * 1.5} fill={cores[entry.tipo]} fillOpacity={0.6} />
                    ))}
                  </Scatter>

                  {/* Zonas de Risco */}
                  <rect x="0" y="0" width="100%" height="100%" fill="red" opacity={0.05} />
                </ScatterChart>
              </ResponsiveContainer>

              {/* Legenda de Riscos */}
              <div className="mt-6 space-y-2">
                <p className="text-sm font-semibold text-gray-900 mb-3">Riscos Identificados</p>
                {matrizRiscos.map((risco, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: cores[risco.tipo] }}
                      ></div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{risco.nome}</p>
                        <p className="text-xs text-gray-600">{risco.tipo}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${risco.severidade >= 7 ? 'text-red-600' : risco.severidade >= 5 ? 'text-orange-600' : 'text-yellow-600'}`}>
                        {risco.severidade.toFixed(1)}/10
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Radar */}
          {visualizacao === 'radar' && (
            <ResponsiveContainer width="100%" height={400}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="assunto" stroke="#6b7280" />
                <PolarRadiusAxis domain={[0, 10]} stroke="#6b7280" />
                <Radar name="Nível de Risco" dataKey="valor" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {/* Por Categoria */}
          {visualizacao === 'categoria' && (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={riscosPorCategoria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="categoria" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip contentStyle={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="risco" fill="#EF4444" name="Nível de Risco" radius={[8, 8, 0, 0]} />
                <Bar dataKey="ocorrencia" fill="#F59E0B" name="Probabilidade" radius={[8, 8, 0, 0]} />
                <Bar dataKey="impacto" fill="#3B82F6" name="Impacto" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Distribuição */}
          {visualizacao === 'distribuicao' && (
            <div className="space-y-3">
              {distribuicao.map((dist, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-900">{dist.nivel}</p>
                    <p className="text-sm font-bold text-gray-600">{dist.quantidade} riscos</p>
                  </div>
                  <div className="w-full h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${(dist.quantidade / 16) * 100}%`,
                        backgroundColor: dist.cor 
                      }}
                    ></div>
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