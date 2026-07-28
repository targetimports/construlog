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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Package, TrendingUp, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const csvBRL = (v) => (Number(v) || 0).toFixed(2).replace('.', ',');

export default function RelatorioCustosMaterial({ materiais }) {
  const [busca, setBusca] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');

  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['movimentacoes-estoque'],
    queryFn: () => base44.entities.MovimentacaoEstoque.list()
  });

  // Calcular custos por material
  const custosPorMaterial = materiais.map(material => {
    const movimentacoesMaterial = movimentacoes.filter(m => m.material_id === material.id);
    
    const quantidadeTotal = movimentacoesMaterial.reduce((sum, mov) => {
      if (mov.tipo === 'entrada') return sum + (mov.quantidade || 0);
      if (mov.tipo === 'saida') return sum - (mov.quantidade || 0);
      return sum;
    }, 0);

    const custoTotal = movimentacoesMaterial.reduce((sum, mov) => sum + (mov.valor_total || 0), 0);
    const precoMedio = quantidadeTotal > 0 ? custoTotal / quantidadeTotal : material.preco_medio || 0;

    return {
      id: material.id,
      nome: material.nome,
      codigo: material.codigo,
      categoria: material.categoria,
      unidade: material.unidade,
      quantidadeTotal,
      custoTotal,
      precoMedio,
      estoqueAtual: material.estoque_atual || 0,
      precoAtual: material.preco_medio || 0,
      movimentacoes: movimentacoesMaterial.length
    };
  });

  // Filtrar materiais
  const materiaisFiltrados = custosPorMaterial.filter(material => {
    const matchBusca = material.nome.toLowerCase().includes(busca.toLowerCase()) ||
                       material.codigo?.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = categoriaFiltro === 'todos' || material.categoria === categoriaFiltro;
    return matchBusca && matchCategoria;
  });

  // Categorias únicas
  const categorias = [...new Set(materiais.map(m => m.categoria).filter(Boolean))];

  // Tabela ordenada e paginada
  const materiaisOrdenados = [...materiaisFiltrados].sort((a, b) => b.custoTotal - a.custoTotal);
  const { paginatedItems: materiaisPag, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(materiaisOrdenados, 20);

  const exportarCsv = () => {
    if (!materiaisOrdenados.length) { toast.error('Sem dados para exportar'); return; }
    exportarCSV(
      `custos-por-material-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Código', 'Material', 'Categoria', 'Unidade', 'Quantidade', 'Preço Médio (R$)', 'Custo Total (R$)', 'Movimentações'],
      materiaisOrdenados.map((m) => [
        m.codigo || '', m.nome || '', m.categoria || '', m.unidade || '',
        String(Math.abs(m.quantidadeTotal)).replace('.', ','), csvBRL(m.precoMedio), csvBRL(m.custoTotal), String(m.movimentacoes),
      ])
    );
    toast.success('CSV exportado!');
  };

  // Dados para gráficos
  const dadosGraficoBarras = materiaisFiltrados
    .sort((a, b) => b.custoTotal - a.custoTotal)
    .slice(0, 10)
    .map(material => ({
      nome: material.nome.length > 20 ? material.nome.substring(0, 20) + '...' : material.nome,
      custo: material.custoTotal,
      quantidade: material.quantidadeTotal
    }));

  // Custos por categoria
  const custosPorCategoria = categorias.map(cat => {
    const materiaisCategoria = materiaisFiltrados.filter(m => m.categoria === cat);
    const custoCategoria = materiaisCategoria.reduce((sum, m) => sum + m.custoTotal, 0);
    return {
      categoria: cat,
      custo: custoCategoria
    };
  }).sort((a, b) => b.custo - a.custo);

  // Estatísticas gerais
  const custoTotalGeral = materiaisFiltrados.reduce((sum, m) => sum + m.custoTotal, 0);
  const quantidadeTotalGeral = materiaisFiltrados.reduce((sum, m) => sum + Math.abs(m.quantidadeTotal), 0);
  const precoMedioGeral = quantidadeTotalGeral > 0 ? custoTotalGeral / quantidadeTotalGeral : 0;

  return (
    <div className="space-y-6">
      {/* Filtros + exportação */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
          <Input
            className="h-11"
            placeholder="Buscar material..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <ComboboxBusca
            options={[{ value: 'todos', label: 'Todas as Categorias' }, ...categorias.map((cat) => ({ value: cat, label: cat }))]}
            value={categoriaFiltro}
            onSelect={(v) => setCategoriaFiltro(v || 'todos')}
            placeholder="Todas as Categorias"
            searchPlaceholder="Buscar categoria..."
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
              <Package className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Quantidade Total</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate">
                  {quantidadeTotalGeral.toLocaleString('pt-BR')}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Preço Médio</p>
                <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 tabular-nums truncate" title={fmtBRL(precoMedioGeral)}>
                  {fmtCompactBRL(precoMedioGeral)}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-gray-300 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Top 10 Materiais por Custo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosGraficoBarras}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Bar dataKey="custo" fill="#8B5CF6" name="Custo Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Custos por Categoria</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={custosPorCategoria}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="categoria" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Bar dataKey="custo" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Detalhamento por Material</h3>

          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2">
            {materiaisPag.map(material => (
              <div key={material.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{material.nome}</p>
                    <p className="text-xs text-gray-500">{material.codigo || '-'}</p>
                  </div>
                  <Badge className="border-0 bg-blue-100 text-blue-700 flex-shrink-0">{material.categoria}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                  <div><span className="text-gray-400">Custo: </span><span className="font-semibold text-gray-900">{fmtBRL(material.custoTotal)}</span></div>
                  <div><span className="text-gray-400">Preço méd.: </span>{fmtBRL(material.precoMedio)}</div>
                  <div><span className="text-gray-400">Qtd: </span>{Math.abs(material.quantidadeTotal).toLocaleString('pt-BR')} {material.unidade}</div>
                  <div><span className="text-gray-400">Movim.: </span>{material.movimentacoes}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Material</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Categoria</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Quantidade</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Preço Médio</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Custo Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Movimentações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {materiaisPag.map(material => (
                  <tr key={material.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{material.codigo || '-'}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{material.nome}</td>
                    <td className="px-4 py-3 text-sm">
                      <Badge className="border-0 bg-blue-100 text-blue-700">
                        {material.categoria}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {Math.abs(material.quantidadeTotal).toLocaleString('pt-BR')} {material.unidade}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {material.precoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {material.custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {material.movimentacoes}
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