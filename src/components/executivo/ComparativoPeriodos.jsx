import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function ComparativoPeriodos({ obras, contas, periodo }) {
  const dias = parseInt(periodo);
  const hoje = new Date();
  const inicioAtual = new Date(hoje.getTime() - dias * 24 * 60 * 60 * 1000);
  const inicioAnterior = new Date(inicioAtual.getTime() - dias * 24 * 60 * 60 * 1000);

  // Período Atual
  const contasAtual = contas.filter(c => {
    const data = new Date(c.created_date);
    return data >= inicioAtual && data <= hoje;
  });

  const receitasAtual = contasAtual
    .filter(c => c.tipo === 'receber' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const despesasAtual = contasAtual
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  // Período Anterior
  const contasAnterior = contas.filter(c => {
    const data = new Date(c.created_date);
    return data >= inicioAnterior && data < inicioAtual;
  });

  const receitasAnterior = contasAnterior
    .filter(c => c.tipo === 'receber' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  const despesasAnterior = contasAnterior
    .filter(c => c.tipo === 'pagar' && c.status === 'pago')
    .reduce((acc, c) => acc + (c.valor || 0), 0);

  // Variações
  const variacaoReceitas = receitasAnterior > 0 
    ? ((receitasAtual - receitasAnterior) / receitasAnterior) * 100 
    : 0;

  const variacaoDespesas = despesasAnterior > 0 
    ? ((despesasAtual - despesasAnterior) / despesasAnterior) * 100 
    : 0;

  const lucroAtual = receitasAtual - despesasAtual;
  const lucroAnterior = receitasAnterior - despesasAnterior;
  const variacaoLucro = lucroAnterior !== 0 
    ? ((lucroAtual - lucroAnterior) / Math.abs(lucroAnterior)) * 100 
    : 0;

  const dadosComparativo = [
    {
      periodo: 'Anterior',
      receitas: receitasAnterior,
      despesas: despesasAnterior,
      lucro: lucroAnterior
    },
    {
      periodo: 'Atual',
      receitas: receitasAtual,
      despesas: despesasAtual,
      lucro: lucroAtual
    }
  ];

  return (
    <div className="space-y-6">
      {/* Cards Comparativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Receitas</p>
              {variacaoReceitas >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {receitasAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">vs período anterior</span>
              <span className={variacaoReceitas >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {variacaoReceitas > 0 ? '+' : ''}{variacaoReceitas.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Despesas</p>
              {variacaoDespesas <= 0 ? (
                <TrendingDown className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingUp className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {despesasAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">vs período anterior</span>
              <span className={variacaoDespesas <= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {variacaoDespesas > 0 ? '+' : ''}{variacaoDespesas.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">Lucro</p>
              {variacaoLucro >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className="text-2xl font-bold text-white mb-1">
              {lucroAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">vs período anterior</span>
              <span className={variacaoLucro >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {variacaoLucro > 0 ? '+' : ''}{variacaoLucro.toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Comparativo */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Comparativo de Períodos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosComparativo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="periodo" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <Bar dataKey="receitas" fill="#10B981" radius={[8, 8, 0, 0]} name="Receitas" />
                <Bar dataKey="despesas" fill="#EF4444" radius={[8, 8, 0, 0]} name="Despesas" />
                <Bar dataKey="lucro" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}