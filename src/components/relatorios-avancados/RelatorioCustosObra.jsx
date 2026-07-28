import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { exportarCSV } from '@/lib/csvBR';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Building2, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const csvBRL = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

export default function RelatorioCustosObra({ obras }) {
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('todos');

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-estoque'],
    queryFn: () => base44.entities.MovimentacaoEstoque.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: () => base44.entities.RequisicaoCompra.list()
  });

  // Calcular custos por obra
  const custosPorObra = obras.map(obra => {
    // Custos de movimentações
    const movimentacoesObra = movimentacoes.filter(m => m.obra_destino_id === obra.id || m.obra_origem_id === obra.id);
    const custoMovimentacoes = movimentacoesObra.reduce((sum, mov) => sum + (mov.valor_total || 0), 0);

    // Custos de requisições
    const requisicoesObra = requisicoes.filter(r => r.obra_id === obra.id);
    const custoRequisicoes = requisicoesObra.reduce((sum, req) => sum + (req.valor_total_estimado || 0), 0);

    // Total
    const custoTotal = custoMovimentacoes + custoRequisicoes;

    // Campo real do orçamento é total_orcamento (valor_orcado costuma vir 0).
    const orcamento = obra.valor_orcado || obra.total_orcamento || obra.valor_contrato || 0;

    return {
      id: obra.id,
      nome: obra.nome,
      status: obra.status,
      custoMovimentacoes,
      custoRequisicoes,
      custoTotal,
      orcamento,
      percentualGasto: orcamento ? ((custoTotal / orcamento) * 100).toFixed(1) : 0
    };
  });

  // Filtrar obras
  const obrasFiltradas = custosPorObra.filter(obra => {
    const matchBusca = (obra.nome || '').toLowerCase().includes(busca.toLowerCase());
    const matchStatus = statusFiltro === 'todos' || obra.status === statusFiltro;
    return matchBusca && matchStatus;
  });

  // Tabela ordenada e paginada
  const obrasOrdenadas = [...obrasFiltradas].sort((a, b) => b.custoTotal - a.custoTotal);
  const { paginatedItems: obrasPag, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(obrasOrdenadas, 20);

  const exportarCsv = () => {
    if (!obrasOrdenadas.length) { toast.error('Sem dados para exportar'); return; }
    exportarCSV(
      `custos-por-obra-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Obra', 'Status', 'Movimentações (R$)', 'Requisições (R$)', 'Total (R$)', 'Orçamento (R$)', '% Gasto'],
      obrasOrdenadas.map((o) => [
        o.nome || '', o.status || '', csvBRL(o.custoMovimentacoes), csvBRL(o.custoRequisicoes),
        csvBRL(o.custoTotal), csvBRL(o.orcamento), String(o.percentualGasto).replace('.', ','),
      ])
    );
    toast.success('CSV exportado!');
  };

  // Dados para gráficos
  const dadosGraficoBarras = obrasFiltradas
    .sort((a, b) => b.custoTotal - a.custoTotal)
    .slice(0, 10)
    .map(obra => ({
      nome: obra.nome.length > 20 ? obra.nome.substring(0, 20) + '...' : obra.nome,
      custo: obra.custoTotal,
      orcamento: obra.orcamento
    }));

  const dadosGraficoPizza = obrasFiltradas
    .sort((a, b) => b.custoTotal - a.custoTotal)
    .slice(0, 6)
    .map(obra => ({
      name: obra.nome.length > 15 ? obra.nome.substring(0, 15) + '...' : obra.nome,
      value: obra.custoTotal
    }));

  // Estatísticas gerais
  const custoTotalGeral = obrasFiltradas.reduce((sum, obra) => sum + obra.custoTotal, 0);
  const orcamentoTotalGeral = obrasFiltradas.reduce((sum, obra) => sum + obra.orcamento, 0);
  const economiaGeral = orcamentoTotalGeral - custoTotalGeral;
  const percentualEconomia = orcamentoTotalGeral > 0 ? ((economiaGeral / orcamentoTotalGeral) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Filtros + exportação */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <Input
            className="h-11"
            placeholder="Buscar obra..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <ComboboxBusca
            options={[
              { value: 'todos', label: 'Todos os Status' },
              { value: 'em_andamento', label: 'Em Andamento' },
              { value: 'concluida', label: 'Concluída' },
              { value: 'pausada', label: 'Pausada' },
            ]}
            value={statusFiltro}
            onSelect={(v) => setStatusFiltro(v || 'todos')}
            placeholder="Todos os Status"
            searchPlaceholder="Buscar status..."
          />
        </div>
        <Button variant="outline" onClick={exportarCsv} className="w-full sm:w-auto border-gray-300 text-gray-700 gap-2">
          <Download className="w-4 h-4" /> CSV
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Custo Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate" title={fmtBRL(custoTotalGeral)}>
                  {fmtCompactBRL(custoTotalGeral)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Orçamento Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate" title={fmtBRL(orcamentoTotalGeral)}>
                  {fmtCompactBRL(orcamentoTotalGeral)}
                </p>
              </div>
              <Building2 className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">{economiaGeral >= 0 ? 'Economia' : 'Excedente'}</p>
                <p className={`text-lg sm:text-2xl font-bold mt-1 tabular-nums truncate ${economiaGeral >= 0 ? 'text-emerald-600' : 'text-red-600'}`} title={fmtBRL(Math.abs(economiaGeral))}>
                  {fmtCompactBRL(Math.abs(economiaGeral))}
                </p>
                <p className="text-xs mt-1 text-gray-400">{percentualEconomia}% do orçamento</p>
              </div>
              {economiaGeral >= 0 ?
                <TrendingDown className="w-8 h-8 text-gray-300 flex-shrink-0" /> :
                <TrendingUp className="w-8 h-8 text-gray-300 flex-shrink-0" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Top 10 Obras por Custo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosGraficoBarras}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Bar dataKey="custo" fill="#3B82F6" name="Custo Real" />
                <Bar dataKey="orcamento" fill="#10B981" name="Orçamento" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Distribuição de Custos</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosGraficoPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${(entry.value / custoTotalGeral * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosGraficoPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Detalhamento por Obra</h3>

          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2">
            {obrasPag.map(obra => (
              <div key={obra.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 min-w-0 truncate">{obra.nome}</p>
                  <Badge className={`border-0 flex-shrink-0 ${obra.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' : obra.status === 'concluida' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{obra.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">Total: </span><span className="font-semibold text-gray-900">{fmtBRL(obra.custoTotal)}</span></div>
                  <div><span className="text-gray-400">Orçamento: </span>{fmtBRL(obra.orcamento)}</div>
                  <div><span className="text-gray-400">Movim.: </span>{fmtBRL(obra.custoMovimentacoes)}</div>
                  <div><span className="text-gray-400">Requis.: </span>{fmtBRL(obra.custoRequisicoes)}</div>
                  <div><span className="text-gray-400">% Gasto: </span><span className={`font-semibold ${parseFloat(obra.percentualGasto) > 100 ? 'text-red-600' : parseFloat(obra.percentualGasto) > 80 ? 'text-amber-600' : 'text-green-600'}`}>{obra.percentualGasto}%</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Movimentações</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Requisições</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Orçamento</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">% Gasto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {obrasPag.map(obra => (
                  <tr key={obra.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{obra.nome}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className={`border-0 ${
                        obra.status === 'em_andamento' ? 'bg-blue-100 text-blue-700' :
                        obra.status === 'concluida' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {obra.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {obra.custoMovimentacoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {obra.custoRequisicoes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {obra.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {obra.orcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <span className={`font-semibold ${
                        parseFloat(obra.percentualGasto) > 100 ? 'text-red-600' :
                        parseFloat(obra.percentualGasto) > 80 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {obra.percentualGasto}%
                      </span>
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