import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function RelatorioValor({ ativos }) {
  const valorTotal = useMemo(() => {
    return ativos.reduce((acc, a) => acc + (a.valor_aquisicao || 0), 0);
  }, [ativos]);

  const valorAtual = useMemo(() => {
    return ativos.reduce((acc, a) => acc + (a.valor_atual || 0), 0);
  }, [ativos]);

  const depreciacao = valorTotal - valorAtual;
  const percentualDepreciacao = valorTotal > 0 ? (depreciacao / valorTotal) * 100 : 0;

  const valorPorStatus = useMemo(() => {
    return [
      {
        name: 'Disponível',
        valor: ativos.filter(a => a.status === 'disponivel').reduce((acc, a) => acc + (a.valor_atual || 0), 0)
      },
      {
        name: 'Em Uso',
        valor: ativos.filter(a => a.status === 'em_uso').reduce((acc, a) => acc + (a.valor_atual || 0), 0)
      },
      {
        name: 'Manutenção',
        valor: ativos.filter(a => a.status === 'manutencao').reduce((acc, a) => acc + (a.valor_atual || 0), 0)
      },
      {
        name: 'Inativo',
        valor: ativos.filter(a => a.status === 'inativo').reduce((acc, a) => acc + (a.valor_atual || 0), 0)
      }
    ].filter(item => item.valor > 0);
  }, [ativos]);

  const valorPorTipo = useMemo(() => {
    const tipos = {};
    ativos.forEach(a => {
      const tipo = a.tipo || 'outros';
      tipos[tipo] = (tipos[tipo] || 0) + (a.valor_atual || 0);
    });

    return Object.entries(tipos)
      .map(([tipo, valor]) => ({
        nome: tipo.charAt(0).toUpperCase() + tipo.slice(1),
        valor: Math.round(valor)
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [ativos]);

  const top10MaisCaro = useMemo(() => {
    return [...ativos]
      .sort((a, b) => (b.valor_atual || 0) - (a.valor_atual || 0))
      .slice(0, 10)
      .map(a => ({
        nome: (a.nome || 'Sem nome').substring(0, 15),
        valor: a.valor_atual || 0
      }));
  }, [ativos]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-emerald-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-gray-500">Valor Total (Aquisição)</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(valorTotal)}>
                  {fmtCompactBRL(valorTotal)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-gray-500">Valor Atual</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(valorAtual)}>
                  {fmtCompactBRL(valorAtual)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-red-500 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-gray-500">Depreciação</div>
                <div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums truncate" title={fmtBRL(depreciacao)}>
                  {fmtCompactBRL(depreciacao)}
                  <span className="text-sm text-red-600 ml-2">({percentualDepreciacao.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Valor por Status */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Valor por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={valorPorStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, valor }) => `${name}: R$ ${(valor/1000).toFixed(0)}k`}
                    outerRadius={80}
                    dataKey="valor"
                  >
                    {valorPorStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Valor por Tipo */}
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Valor por Tipo de Ativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {valorPorTipo.map((tipo, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">{tipo.nome}</span>
                  <Badge className="bg-blue-100 text-blue-700 border-0">
                    {tipo.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 */}
      {top10MaisCaro.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Top 10 Ativos Mais Caros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10MaisCaro} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" stroke="#9CA3AF" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <YAxis dataKey="nome" type="category" stroke="#9CA3AF" fontSize={11} width={100} />
                  <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                  <Bar dataKey="valor" fill="#10B981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}