import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

function ConsolidadoFinanceiroContent() {
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroPeriodo, setFiltroPeriodo] = useState('mensal');
  const [filtroData, setFiltroData] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroResponsavel, setFiltroResponsavel] = useState('');
  const [carregando, setCarregando] = useState(false);

  // Buscar consolidações
  const { data: consolidacoes = [], isLoading: loadingConsolidacoes, refetch } = useQuery({
    queryKey: ['consolidacoes'],
    queryFn: async () => {
      const res = await base44.entities.ConsolidacaoFinanceiraPorObra.list(null, 100);
      return res;
    },
    staleTime: 60000
  });

  // Buscar obras para dropdown
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: async () => {
      const res = await base44.entities.Obra.list(null, 100);
      return res;
    }
  });

  // Filtrar consolidações
  const consolidacoesFiltradas = useMemo(() => {
    return consolidacoes.filter(c => {
      if (filtroObra && c.obra_id !== filtroObra) return false;
      if (filtroPeriodo && c.tipo_periodo !== filtroPeriodo) return false;
      if (filtroData && c.periodo !== filtroData) return false;
      if (filtroCidade && c.cidade !== filtroCidade) return false;
      if (filtroResponsavel && c.responsavel !== filtroResponsavel) return false;
      return true;
    });
  }, [consolidacoes, filtroObra, filtroPeriodo, filtroData, filtroCidade, filtroResponsavel]);

  // Cidades e responsáveis únicos
  const cidades = useMemo(() => [...new Set(consolidacoes.map(c => c.cidade).filter(Boolean))], [consolidacoes]);
  const responsaveis = useMemo(() => [...new Set(consolidacoes.map(c => c.responsavel).filter(Boolean))], [consolidacoes]);

  // Totalizações
  const totais = useMemo(() => {
    return consolidacoesFiltradas.reduce((acc, c) => ({
      receita: acc.receita + (c.receita_total || 0),
      despesa: acc.despesa + (c.despesa_total || 0),
      lucro: acc.lucro + (c.lucro_bruto || 0),
      material: acc.material + (c.despesa_material || 0),
      folha: acc.folha + (c.despesa_folha_pagamento || 0),
      logistica: acc.logistica + (c.despesa_logistica || 0),
      equipamentos: acc.equipamentos + (c.despesa_equipamentos || 0)
    }), { receita: 0, despesa: 0, lucro: 0, material: 0, folha: 0, logistica: 0, equipamentos: 0 });
  }, [consolidacoesFiltradas]);

  const margemMedia = totais.receita > 0 ? ((totais.lucro / totais.receita) * 100).toFixed(2) : 0;

  // Dados para gráficos
  const dadosReceitaDespesa = useMemo(() => {
    return consolidacoesFiltradas
      .sort((a, b) => (a.periodo || '').localeCompare(b.periodo || ''))
      .slice(-12)
      .map(c => ({
        periodo: c.periodo,
        receita: c.receita_total || 0,
        despesa: c.despesa_total || 0,
        lucro: c.lucro_bruto || 0
      }));
  }, [consolidacoesFiltradas]);

  const dadosBreakdown = useMemo(() => {
    if (totais.despesa === 0) return [];
    return [
      { name: 'Material', value: totais.material, fill: '#ef4444' },
      { name: 'Folha', value: totais.folha, fill: '#3b82f6' },
      { name: 'Logística', value: totais.logistica, fill: '#f59e0b' },
      { name: 'Equipamentos', value: totais.equipamentos, fill: '#8b5cf6' }
    ];
  }, [totais]);

  // Consolidar período
  const handleConsolidar = async () => {
    if (!filtroObra) {
      toast.error('Selecione uma obra');
      return;
    }

    setCarregando(true);
    try {
      const periodo = filtroPeriodo === 'diario'
        ? (filtroData || new Date().toISOString().substring(0, 10))
        : new Date().toISOString().substring(0, 7);

      const res = await base44.functions.invoke('consolidarFinanceiroPorObra', {
        obra_id: filtroObra,
        tipo_periodo: filtroPeriodo,
        periodo
      });

      if (res.data.success) {
        toast.success('Consolidação atualizada!');
        refetch();
      }
    } catch (err) {
      toast.error('Erro ao consolidar: ' + err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Consolidado Financeiro por Obra</h1>
        <p className="text-gray-600 mt-2">Receita, despesa, lucro e análise de folha e logística</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Obra</label>
              <Select value={filtroObra} onValueChange={setFiltroObra}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as obras</SelectItem>
                  {obras.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Período</label>
              <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <Input
                type={filtroPeriodo === 'diario' ? 'date' : 'month'}
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cidade</label>
              <Select value={filtroCidade} onValueChange={setFiltroCidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas</SelectItem>
                  {cidades.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Responsável</label>
              <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todos</SelectItem>
                  {responsaveis.map(r => (
                    <SelectItem key={r} value={r}>{r?.split('@')[0]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4">
            <Button
              onClick={handleConsolidar}
              disabled={carregando || !filtroObra}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {carregando ? 'Consolidando...' : 'Consolidar Período'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cards de Totalizações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Receita Total</p>
                <p className="text-2xl font-bold text-green-700 mt-1">
                  R$ {(totais.receita / 1000).toFixed(1)}k
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Despesa Total</p>
                <p className="text-2xl font-bold text-red-700 mt-1">
                  R$ {(totais.despesa / 1000).toFixed(1)}k
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className={`${totais.lucro >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Lucro Bruto</p>
                <p className={`text-2xl font-bold mt-1 ${totais.lucro >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  R$ {(totais.lucro / 1000).toFixed(1)}k
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Margem Média</p>
                <p className={`text-2xl font-bold mt-1 ${margemMedia >= 15 ? 'text-purple-700' : 'text-orange-700'}`}>
                  {margemMedia}%
                </p>
              </div>
              {margemMedia >= 15 ? (
                <TrendingUp className="w-8 h-8 text-purple-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-orange-600" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Receita vs Despesa</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosReceitaDespesa.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dadosReceitaDespesa}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodo" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="lucro" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Breakdown de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {dadosBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dadosBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dadosBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${(value / 1000).toFixed(1)}k`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-center py-8">Sem dados para exibir</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento de Despesas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento de Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Material</p>
              <p className="text-xl font-bold text-red-700 mt-1">R$ {(totais.material / 1000).toFixed(1)}k</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Folha</p>
              <p className="text-xl font-bold text-blue-700 mt-1">R$ {(totais.folha / 1000).toFixed(1)}k</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Logística</p>
              <p className="text-xl font-bold text-amber-700 mt-1">R$ {(totais.logistica / 1000).toFixed(1)}k</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Equipamentos</p>
              <p className="text-xl font-bold text-purple-700 mt-1">R$ {(totais.equipamentos / 1000).toFixed(1)}k</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Consolidações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Consolidações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {consolidacoesFiltradas.length === 0 ? (
            <p className="text-gray-500">Nenhuma consolidação encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Obra</th>
                    <th className="px-4 py-2 text-left font-semibold">Período</th>
                    <th className="px-4 py-2 text-right font-semibold">Receita</th>
                    <th className="px-4 py-2 text-right font-semibold">Despesa</th>
                    <th className="px-4 py-2 text-right font-semibold">Lucro</th>
                    <th className="px-4 py-2 text-right font-semibold">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidacoesFiltradas.slice(0, 10).map(c => (
                    <tr key={c.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2">{c.obra_nome}</td>
                      <td className="px-4 py-2">{c.periodo}</td>
                      <td className="px-4 py-2 text-right text-green-700 font-semibold">
                        R$ {(c.receita_total / 1000).toFixed(1)}k
                      </td>
                      <td className="px-4 py-2 text-right text-red-700 font-semibold">
                        R$ {(c.despesa_total / 1000).toFixed(1)}k
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${c.lucro_bruto >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                        R$ {(c.lucro_bruto / 1000).toFixed(1)}k
                      </td>
                      <td className={`px-4 py-2 text-right font-semibold ${
                        c.margem_status === 'excelente' ? 'text-green-700' :
                        c.margem_status === 'normal' ? 'text-blue-700' :
                        c.margem_status === 'alerta' ? 'text-amber-700' :
                        'text-red-700'
                      }`}>
                        {c.margem_lucro?.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConsolidadoFinanceiro() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="FINANCEIRO_VIEW">
      <ConsolidadoFinanceiroContent />
    </RouteGuardFinalV2>
  );
}