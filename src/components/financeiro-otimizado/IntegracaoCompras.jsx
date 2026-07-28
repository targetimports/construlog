import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ShoppingCart, TrendingUp, AlertCircle, DollarSign, Package } from 'lucide-react';

export default function IntegracaoCompras({ contas, obras, requisicoes, ordens }) {
  const [obraFiltro, setObraFiltro] = useState('todos');

  // Integração: Requisições vs Custos Reais
  const obrasSelecionadas = obraFiltro === 'todos' ? obras : obras.filter(o => o.id === obraFiltro);

  const dadosIntegracao = obrasSelecionadas.map(obra => {
    // Requisições da obra
    const reqObra = requisicoes.filter(r => r.obra_id === obra.id);
    const valorEstimadoReq = reqObra.reduce((s, r) => s + (r.valor_total_estimado || 0), 0);

    // Ordens de compra da obra
    const ordObra = ordens.filter(o => o.obra_id === obra.id);
    const valorRealOrdens = ordObra.reduce((s, o) => s + (o.valor_total || 0), 0);

    // Contas financeiras da obra (despesas)
    const contasObra = contas.filter(c => c.obra_id === obra.id && c.tipo === 'pagar');
    const valorPagoContas = contasObra.filter(c => c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const valorPendenteContas = contasObra.filter(c => c.status === 'pendente').reduce((s, c) => s + (c.valor || 0), 0);

    // Desvio
    const desvio = valorPagoContas - valorEstimadoReq;
    const percentualDesvio = valorEstimadoReq > 0 ? ((desvio / valorEstimadoReq) * 100) : 0;

    return {
      id: obra.id,
      nome: obra.nome,
      orcamento: obra.valor_orcado || 0,
      valorEstimado: valorEstimadoReq,
      valorOrdens: valorRealOrdens,
      valorPago: valorPagoContas,
      valorPendente: valorPendenteContas,
      totalGasto: valorPagoContas + valorPendenteContas,
      desvio,
      percentualDesvio,
      requisicoes: reqObra.length,
      ordens: ordObra.length
    };
  });

  // Dados para gráfico de linha - evolução do orçamento
  const dadosEvolucao = dadosIntegracao.map(obra => ({
    nome: obra.nome.length > 15 ? obra.nome.substring(0, 15) + '...' : obra.nome,
    orcamento: obra.orcamento,
    estimado: obra.valorEstimado,
    gasto: obra.totalGasto
  }));

  // Totais gerais
  const totalOrcamento = dadosIntegracao.reduce((s, o) => s + o.orcamento, 0);
  const totalEstimado = dadosIntegracao.reduce((s, o) => s + o.valorEstimado, 0);
  const totalGasto = dadosIntegracao.reduce((s, o) => s + o.totalGasto, 0);
  const totalDesvio = totalGasto - totalEstimado;
  const percentualDesvioGeral = totalEstimado > 0 ? ((totalDesvio / totalEstimado) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Cards de Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Orçamento Total</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {totalOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium">Valor Estimado (Req.)</p>
                <p className="text-2xl font-bold text-purple-900 mt-1">
                  {totalEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <ShoppingCart className="w-10 h-10 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-medium">Total Gasto</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <Package className="w-10 h-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={totalDesvio >= 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${totalDesvio >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalDesvio >= 0 ? 'Desvio (Excesso)' : 'Economia'}
                </p>
                <p className={`text-2xl font-bold mt-1 ${totalDesvio >= 0 ? 'text-red-900' : 'text-green-900'}`}>
                  {Math.abs(totalDesvio).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-sm mt-1 text-gray-600">{percentualDesvioGeral.toFixed(1)}%</p>
              </div>
              {totalDesvio >= 0 ? 
                <AlertCircle className="w-10 h-10 text-red-400" /> :
                <TrendingUp className="w-10 h-10 text-green-400" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <Card>
        <CardContent className="p-5">
          <Select value={obraFiltro} onValueChange={setObraFiltro}>
            <SelectTrigger className="max-w-xs">
              <SelectValue placeholder="Filtrar por obra..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Obras</SelectItem>
              {obras.map(obra => (
                <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Comparativo: Orçamento vs Estimado vs Gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Bar dataKey="orcamento" fill="#3B82F6" name="Orçamento" />
                <Bar dataKey="estimado" fill="#8B5CF6" name="Estimado (Req)" />
                <Bar dataKey="gasto" fill="#F59E0B" name="Gasto Real" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dadosEvolucao}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Line type="monotone" dataKey="orcamento" stroke="#3B82F6" strokeWidth={2} name="Orçamento" />
                <Line type="monotone" dataKey="estimado" stroke="#8B5CF6" strokeWidth={2} name="Estimado" />
                <Line type="monotone" dataKey="gasto" stroke="#F59E0B" strokeWidth={2} name="Gasto" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada de Integração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Obra</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Orçamento</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Estimado (Req)</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor Ordens</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Pago</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Pendente</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total Gasto</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Desvio</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dadosIntegracao.map(obra => (
                  <tr key={obra.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{obra.nome}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {obra.orcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-purple-700 font-medium">
                      {obra.valorEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-blue-700 font-medium">
                      {obra.valorOrdens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-green-700 font-medium">
                      {obra.valorPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-amber-700 font-medium">
                      {obra.valorPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900">
                      {obra.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${obra.desvio >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {obra.desvio >= 0 ? '+' : ''}{obra.desvio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={
                        Math.abs(obra.percentualDesvio) <= 5 ? 'default' :
                        Math.abs(obra.percentualDesvio) <= 15 ? 'secondary' :
                        'destructive'
                      }>
                        {obra.percentualDesvio.toFixed(1)}%
                      </Badge>
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