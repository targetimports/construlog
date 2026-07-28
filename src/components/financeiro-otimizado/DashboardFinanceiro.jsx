import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const COLORS = ['#10B981', '#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6'];

export default function DashboardFinanceiro({ contas, obras }) {
  // Cálculos de indicadores
  const hoje = new Date();
  
  // Contas a pagar
  const contasPagar = contas.filter(c => c.tipo === 'pagar');
  const pagarPendentes = contasPagar.filter(c => c.status === 'pendente');
  const pagarVencidas = pagarPendentes.filter(c => new Date(c.data_vencimento) < hoje);
  const totalPagar = pagarPendentes.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalPagarVencido = pagarVencidas.reduce((sum, c) => sum + (c.valor || 0), 0);

  // Contas a receber
  const contasReceber = contas.filter(c => c.tipo === 'receber');
  const receberPendentes = contasReceber.filter(c => c.status === 'pendente');
  const receberVencidas = receberPendentes.filter(c => new Date(c.data_vencimento) < hoje);
  const totalReceber = receberPendentes.reduce((sum, c) => sum + (c.valor || 0), 0);
  const totalReceberVencido = receberVencidas.reduce((sum, c) => sum + (c.valor || 0), 0);

  // Fluxo de caixa
  const fluxoCaixa = totalReceber - totalPagar;
  const saude = fluxoCaixa >= 0 ? 'positivo' : 'negativo';

  // Lucratividade por obra
  const lucratividadeObras = obras.map(obra => {
    const contasObra = contas.filter(c => c.obra_id === obra.id);
    const receitas = contasObra.filter(c => c.tipo === 'receber' && c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const despesas = contasObra.filter(c => c.tipo === 'pagar' && c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const lucro = receitas - despesas;
    const margemLucro = receitas > 0 ? ((lucro / receitas) * 100) : 0;

    return {
      id: obra.id,
      nome: obra.nome,
      receitas,
      despesas,
      lucro,
      margemLucro
    };
  }).filter(o => o.receitas > 0 || o.despesas > 0);

  // Fluxo de caixa mensal (últimos 6 meses)
  const fluxoMensal = [];
  for (let i = 5; i >= 0; i--) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesProximo = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1);
    
    const pagasNoMes = contas.filter(c => 
      c.tipo === 'pagar' && 
      c.status === 'pago' && 
      c.data_pagamento &&
      new Date(c.data_pagamento) >= mes && 
      new Date(c.data_pagamento) < mesProximo
    );
    
    const recebidasNoMes = contas.filter(c => 
      c.tipo === 'receber' && 
      c.status === 'pago' && 
      c.data_pagamento &&
      new Date(c.data_pagamento) >= mes && 
      new Date(c.data_pagamento) < mesProximo
    );

    const totalPagas = pagasNoMes.reduce((s, c) => s + (c.valor || 0), 0);
    const totalRecebidas = recebidasNoMes.reduce((s, c) => s + (c.valor || 0), 0);

    fluxoMensal.push({
      mes: mes.toLocaleDateString('pt-BR', { month: 'short' }),
      receitas: totalRecebidas,
      despesas: totalPagas,
      saldo: totalRecebidas - totalPagas
    });
  }

  // Distribuição por categoria
  const categorias = {};
  contasPagar.filter(c => c.status === 'pago').forEach(conta => {
    const cat = conta.categoria || 'outros';
    categorias[cat] = (categorias[cat] || 0) + (conta.valor || 0);
  });

  const dadosPizza = Object.entries(categorias).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`${saude === 'positivo' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${saude === 'positivo' ? 'text-green-600' : 'text-red-600'}`}>
                  Fluxo de Caixa
                </p>
                <p className={`text-2xl font-bold mt-1 ${saude === 'positivo' ? 'text-green-900' : 'text-red-900'}`}>
                  {fluxoCaixa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs mt-1 text-gray-600">Contas pendentes</p>
              </div>
              {saude === 'positivo' ? 
                <TrendingUp className="w-10 h-10 text-green-400" /> : 
                <TrendingDown className="w-10 h-10 text-red-400" />
              }
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">A Pagar</p>
                <p className="text-2xl font-bold text-red-900 mt-1">
                  {totalPagar.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs mt-1 text-red-600">{pagarVencidas.length} vencidas</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">A Receber</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {totalReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs mt-1 text-green-600">{receberVencidas.length} vencidas</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Obras Ativas</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {obras.filter(o => o.status === 'em_andamento').length}
                </p>
                <p className="text-xs mt-1 text-blue-600">com movimentação</p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas de Vencimento */}
      {(pagarVencidas.length > 0 || receberVencidas.length > 0) && (
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <Clock className="w-5 h-5" />
              Alertas de Vencimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pagarVencidas.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-red-100 rounded-lg">
                  <span className="text-red-700 font-medium">
                    {pagarVencidas.length} contas a pagar vencidas
                  </span>
                  <span className="text-red-900 font-bold">
                    {totalPagarVencido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}
              {receberVencidas.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-100 rounded-lg">
                  <span className="text-amber-700 font-medium">
                    {receberVencidas.length} contas a receber vencidas
                  </span>
                  <span className="text-amber-900 font-bold">
                    {totalReceberVencido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fluxo de Caixa (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={fluxoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Line type="monotone" dataKey="receitas" stroke="#10B981" name="Receitas" strokeWidth={2} />
                <Line type="monotone" dataKey="despesas" stroke="#EF4444" name="Despesas" strokeWidth={2} />
                <Line type="monotone" dataKey="saldo" stroke="#3B82F6" name="Saldo" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / categorias.total) * 100 || 0).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lucratividade por Obra</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={lucratividadeObras.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Bar dataKey="receitas" fill="#10B981" name="Receitas" />
                <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />
                <Bar dataKey="lucro" fill="#3B82F6" name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Lucratividade */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada por Obra</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Obra</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Receitas</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Despesas</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Lucro</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Margem (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lucratividadeObras
                  .sort((a, b) => b.lucro - a.lucro)
                  .map(obra => (
                  <tr key={obra.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{obra.nome}</td>
                    <td className="px-4 py-3 text-sm text-right text-green-700 font-semibold">
                      {obra.receitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-red-700 font-semibold">
                      {obra.despesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold">
                      <span className={obra.lucro >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {obra.lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${
                        obra.margemLucro >= 20 ? 'text-green-600' :
                        obra.margemLucro >= 10 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {obra.margemLucro.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}