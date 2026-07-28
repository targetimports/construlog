import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { exportarCSV } from '@/lib/csvBR';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Clock, TrendingDown, CheckCircle, AlertTriangle, Download } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const csvBRL = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

export default function DashboardCompras({ requisicoes, ordens, obras }) {
  // Análise de tempo de entrega
  const ordensComPrazo = ordens.filter(o => o.data_emissao && o.data_prevista_entrega);
  const tempoMedioEntrega = ordensComPrazo.length > 0 
    ? ordensComPrazo.reduce((sum, ordem) => {
        const inicio = new Date(ordem.data_emissao);
        const fim = new Date(ordem.data_prevista_entrega);
        const dias = Math.floor((fim - inicio) / (1000 * 60 * 60 * 24));
        return sum + dias;
      }, 0) / ordensComPrazo.length
    : 0;

  // Análise de economia
  const requisicoesComValor = requisicoes.filter(r => r.valor_total_estimado > 0);
  const valorEstimadoTotal = requisicoesComValor.reduce((sum, r) => sum + r.valor_total_estimado, 0);
  const valorRealTotal = ordens.reduce((sum, o) => sum + (o.valor_total || 0), 0);
  const economiaTotal = valorEstimadoTotal - valorRealTotal;
  const percentualEconomia = valorEstimadoTotal > 0 ? ((economiaTotal / valorEstimadoTotal) * 100).toFixed(1) : 0;

  // Status das requisições
  const statusRequisicoes = {
    aguardando: requisicoes.filter(r => r.status === 'aguardando').length,
    em_cotacao: requisicoes.filter(r => r.status === 'em_cotacao').length,
    aprovada: requisicoes.filter(r => r.status === 'aprovada').length,
    em_compra: requisicoes.filter(r => r.status === 'em_compra').length,
    recebida: requisicoes.filter(r => r.status === 'recebida').length,
    recusada: requisicoes.filter(r => r.status === 'recusada').length
  };

  const dadosPizza = [
    { name: 'Aguardando', value: statusRequisicoes.aguardando },
    { name: 'Em Cotação', value: statusRequisicoes.em_cotacao },
    { name: 'Aprovada', value: statusRequisicoes.aprovada },
    { name: 'Em Compra', value: statusRequisicoes.em_compra },
    { name: 'Recebida', value: statusRequisicoes.recebida }
  ].filter(item => item.value > 0);

  // Compras por obra (lista completa, ordenada)
  const comprasPorObra = obras.map(obra => {
    const requisicoesObra = requisicoes.filter(r => r.obra_id === obra.id);
    const ordensObra = ordens.filter(o => o.obra_id === obra.id);
    return {
      nome: obra.nome.length > 15 ? obra.nome.substring(0, 15) + '...' : obra.nome,
      requisicoes: requisicoesObra.length,
      ordens: ordensObra.length,
      valor: ordensObra.reduce((sum, o) => sum + (o.valor_total || 0), 0)
    };
  }).sort((a, b) => b.valor - a.valor);

  // Top 10 para o gráfico; tabela usa a lista completa paginada.
  const comprasTop10 = comprasPorObra.slice(0, 10);
  const { paginatedItems: comprasPag, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(comprasPorObra, 20);

  const exportarCsv = () => {
    if (!comprasPorObra.length) { toast.error('Sem dados para exportar'); return; }
    exportarCSV(
      `desempenho-compras-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Obra', 'Requisições', 'Ordens', 'Valor Total (R$)', 'Ticket Médio (R$)'],
      comprasPorObra.map((o) => [
        o.nome || '', String(o.requisicoes), String(o.ordens),
        csvBRL(o.valor), csvBRL(o.ordens > 0 ? o.valor / o.ordens : 0),
      ])
    );
    toast.success('CSV exportado!');
  };

  // Evolução mensal de compras (últimos 6 meses)
  const hoje = new Date();
  const evolucaoMensal = [];
  for (let i = 5; i >= 0; i--) {
    const mes = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const mesProximo = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 1);
    
    const requisicoesDoMes = requisicoes.filter(r => {
      const data = new Date(r.data_solicitacao);
      return data >= mes && data < mesProximo;
    });
    
    const ordensDoMes = ordens.filter(o => {
      const data = new Date(o.data_emissao);
      return data >= mes && data < mesProximo;
    });

    evolucaoMensal.push({
      mes: mes.toLocaleDateString('pt-BR', { month: 'short' }),
      requisicoes: requisicoesDoMes.length,
      ordens: ordensDoMes.length,
      valor: ordensDoMes.reduce((sum, o) => sum + (o.valor_total || 0), 0)
    });
  }

  // Taxa de aprovação
  const totalProcessadas = statusRequisicoes.aprovada + statusRequisicoes.recusada;
  const taxaAprovacao = totalProcessadas > 0 ? ((statusRequisicoes.aprovada / totalProcessadas) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Cards de KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Tempo Médio Entrega</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{tempoMedioEntrega.toFixed(0)} dias</p>
              </div>
              <Clock className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{economiaTotal >= 0 ? 'Economia Total' : 'Custo Adicional'}</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 tabular-nums truncate ${economiaTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`} title={fmtBRL(Math.abs(economiaTotal))}>
                  {fmtCompactBRL(Math.abs(economiaTotal))}
                </p>
                <p className="text-xs mt-1 text-gray-400">{percentualEconomia}%</p>
              </div>
              <TrendingDown className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Taxa de Aprovação</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{taxaAprovacao}%</p>
                <p className="text-xs mt-1 text-gray-400">{statusRequisicoes.aprovada} de {totalProcessadas}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Pendentes</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums">{statusRequisicoes.aguardando}</p>
                <p className="text-xs mt-1 text-gray-400">requisições</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Status das Requisições</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Evolução Mensal</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="requisicoes" stroke="#3B82F6" name="Requisições" />
                <Line yAxisId="left" type="monotone" dataKey="ordens" stroke="#10B981" name="Ordens" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Top 10 Obras por Volume de Compras</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comprasTop10}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'valor') return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    return value;
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="requisicoes" fill="#3B82F6" name="Requisições" />
                <Bar yAxisId="left" dataKey="ordens" fill="#10B981" name="Ordens" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Performance */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold">Performance por Obra</h3>
            <Button variant="outline" onClick={exportarCsv} className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2">
              <Download className="w-4 h-4" /> CSV
            </Button>
          </div>

          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2">
            {comprasPag.map((obra, idx) => (
              <div key={idx} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 min-w-0 truncate">{obra.nome}</p>
                  <span className="font-semibold text-gray-900 flex-shrink-0">{fmtBRL(obra.valor)}</span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                  <span><span className="text-gray-400">Requis.: </span>{obra.requisicoes}</span>
                  <span><span className="text-gray-400">Ordens: </span>{obra.ordens}</span>
                  <span><span className="text-gray-400">Ticket méd.: </span>{obra.ordens > 0 ? fmtBRL(obra.valor / obra.ordens) : '-'}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500">Requisições</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500">Ordens</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor Total</th>
                  <th className="text-right p-3 text-xs font-semibold text-gray-500">Ticket Médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comprasPag.map((obra, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{obra.nome}</td>
                    <td className="p-3 text-right text-gray-700">{obra.requisicoes}</td>
                    <td className="p-3 text-right text-gray-700">{obra.ordens}</td>
                    <td className="p-3 text-right font-semibold text-gray-900">
                      {obra.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="p-3 text-right text-gray-700">
                      {obra.ordens > 0
                        ? (obra.valor / obra.ordens).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
        </CardContent>
      </Card>
    </div>
  );
}