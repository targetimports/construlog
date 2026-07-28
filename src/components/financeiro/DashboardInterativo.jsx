import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Filter, Download, Calendar, Eye, EyeOff } from 'lucide-react';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function DashboardInterativo({ contas, obras }) {
  const [periodoFiltro, setPeriodoFiltro] = useState('30'); // dias
  const [obraFiltro, setObraFiltro] = useState('todas');
  const [tipoVisualizacao, setTipoVisualizacao] = useState('linha');
  const [metricasSelecionadas, setMetricasSelecionadas] = useState({
    receitas: true,
    despesas: true,
    saldo: true,
    fluxo: true
  });

  // Filtrar por período
  const contasFiltradas = useMemo(() => {
    const hoje = new Date();
    const dataLimite = new Date(hoje);
    dataLimite.setDate(dataLimite.getDate() - parseInt(periodoFiltro));

    return contas.filter(c => {
      const dataVenc = new Date(c.data_vencimento);
      const matchPeriodo = periodoFiltro === 'todos' || dataVenc >= dataLimite;
      const matchObra = obraFiltro === 'todas' || c.obra_id === obraFiltro;
      return matchPeriodo && matchObra;
    });
  }, [contas, periodoFiltro, obraFiltro]);

  // Agrupar por dia/semana/mês baseado no período
  const agruparPorPeriodo = (dias) => {
    if (dias <= 7) return 'dia';
    if (dias <= 30) return 'semana';
    return 'mes';
  };

  const agrupamento = agruparPorPeriodo(parseInt(periodoFiltro));

  // Dados para gráficos
  const dadosTemporais = useMemo(() => {
    const grupos = {};
    
    contasFiltradas.forEach(conta => {
      const data = new Date(conta.data_vencimento);
      let chave;
      
      if (agrupamento === 'dia') {
        chave = data.toISOString().split('T')[0];
      } else if (agrupamento === 'semana') {
        const semana = Math.floor(data.getDate() / 7);
        chave = `${data.getFullYear()}-${data.getMonth()}-S${semana}`;
      } else {
        chave = `${data.getFullYear()}-${data.getMonth()}`;
      }

      if (!grupos[chave]) {
        grupos[chave] = { 
          data: chave, 
          receitas: 0, 
          despesas: 0,
          receitasPagas: 0,
          despesasPagas: 0
        };
      }

      if (conta.tipo === 'receber') {
        grupos[chave].receitas += conta.valor || 0;
        if (conta.status === 'pago') grupos[chave].receitasPagas += conta.valor || 0;
      } else {
        grupos[chave].despesas += conta.valor || 0;
        if (conta.status === 'pago') grupos[chave].despesasPagas += conta.valor || 0;
      }
    });

    return Object.values(grupos)
      .sort((a, b) => a.data.localeCompare(b.data))
      .map(g => ({
        ...g,
        saldo: g.receitas - g.despesas,
        fluxo: g.receitasPagas - g.despesasPagas
      }));
  }, [contasFiltradas, agrupamento]);

  // Distribuição por categoria
  const dadosPorCategoria = useMemo(() => {
    const categorias = {};
    contasFiltradas
      .filter(c => c.tipo === 'pagar')
      .forEach(conta => {
        const cat = conta.categoria || 'outros';
        categorias[cat] = (categorias[cat] || 0) + (conta.valor || 0);
      });
    
    return Object.entries(categorias).map(([name, value]) => ({ name, value }));
  }, [contasFiltradas]);

  // Distribuição por obra
  const dadosPorObra = useMemo(() => {
    const obrasDados = obras.map(obra => {
      const contasObra = contasFiltradas.filter(c => c.obra_id === obra.id);
      const receitas = contasObra.filter(c => c.tipo === 'receber').reduce((s, c) => s + (c.valor || 0), 0);
      const despesas = contasObra.filter(c => c.tipo === 'pagar').reduce((s, c) => s + (c.valor || 0), 0);
      
      return {
        name: obra.nome.length > 15 ? obra.nome.substring(0, 15) + '...' : obra.nome,
        receitas,
        despesas,
        saldo: receitas - despesas
      };
    }).filter(o => o.receitas > 0 || o.despesas > 0);

    return obrasDados;
  }, [contasFiltradas, obras]);

  // KPIs
  const kpis = useMemo(() => {
    const totalReceitas = contasFiltradas.filter(c => c.tipo === 'receber').reduce((s, c) => s + (c.valor || 0), 0);
    const totalDespesas = contasFiltradas.filter(c => c.tipo === 'pagar').reduce((s, c) => s + (c.valor || 0), 0);
    const receitasPagas = contasFiltradas.filter(c => c.tipo === 'receber' && c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    const despesasPagas = contasFiltradas.filter(c => c.tipo === 'pagar' && c.status === 'pago').reduce((s, c) => s + (c.valor || 0), 0);
    
    return {
      totalReceitas,
      totalDespesas,
      saldoProjetado: totalReceitas - totalDespesas,
      fluxoRealizado: receitasPagas - despesasPagas,
      taxaRecebimento: totalReceitas > 0 ? (receitasPagas / totalReceitas) * 100 : 0,
      taxaPagamento: totalDespesas > 0 ? (despesasPagas / totalDespesas) * 100 : 0
    };
  }, [contasFiltradas]);

  const toggleMetrica = (metrica) => {
    setMetricasSelecionadas(prev => ({ ...prev, [metrica]: !prev[metrica] }));
  };

  return (
    <div className="space-y-6">
      {/* Controles */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                <SelectTrigger className="w-40">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="180">Últimos 6 meses</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                  <SelectItem value="todos">Todo período</SelectItem>
                </SelectContent>
              </Select>

              <Select value={obraFiltro} onValueChange={setObraFiltro}>
                <SelectTrigger className="w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as obras</SelectItem>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>{obra.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={tipoVisualizacao} onValueChange={setTipoVisualizacao}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linha">Linha</SelectItem>
                  <SelectItem value="barra">Barra</SelectItem>
                  <SelectItem value="area">Área</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              {Object.entries(metricasSelecionadas).map(([key, value]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={value ? 'default' : 'outline'}
                  onClick={() => toggleMetrica(key)}
                  className="gap-2"
                >
                  {value ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <p className="text-blue-600 text-xs font-medium">Receitas Total</p>
            <p className="text-xl font-bold text-blue-900 mt-1">
              {kpis.totalReceitas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-4">
            <p className="text-red-600 text-xs font-medium">Despesas Total</p>
            <p className="text-xl font-bold text-red-900 mt-1">
              {kpis.totalDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className={kpis.saldoProjetado >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${kpis.saldoProjetado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Saldo Projetado
            </p>
            <p className={`text-xl font-bold mt-1 ${kpis.saldoProjetado >= 0 ? 'text-green-900' : 'text-red-900'}`}>
              {kpis.saldoProjetado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className={kpis.fluxoRealizado >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium ${kpis.fluxoRealizado >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              Fluxo Realizado
            </p>
            <p className={`text-xl font-bold mt-1 ${kpis.fluxoRealizado >= 0 ? 'text-emerald-900' : 'text-amber-900'}`}>
              {kpis.fluxoRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <p className="text-purple-600 text-xs font-medium">Taxa Recebimento</p>
            <p className="text-xl font-bold text-purple-900 mt-1">
              {kpis.taxaRecebimento.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card className="bg-indigo-50 border-indigo-200">
          <CardContent className="p-4">
            <p className="text-indigo-600 text-xs font-medium">Taxa Pagamento</p>
            <p className="text-xl font-bold text-indigo-900 mt-1">
              {kpis.taxaPagamento.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            {tipoVisualizacao === 'linha' ? (
              <LineChart data={dadosTemporais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                {metricasSelecionadas.receitas && <Line type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2} name="Receitas" />}
                {metricasSelecionadas.despesas && <Line type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2} name="Despesas" />}
                {metricasSelecionadas.saldo && <Line type="monotone" dataKey="saldo" stroke="#3B82F6" strokeWidth={2} name="Saldo" />}
                {metricasSelecionadas.fluxo && <Line type="monotone" dataKey="fluxo" stroke="#8B5CF6" strokeWidth={2} name="Fluxo Real" />}
              </LineChart>
            ) : tipoVisualizacao === 'barra' ? (
              <BarChart data={dadosTemporais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                {metricasSelecionadas.receitas && <Bar dataKey="receitas" fill="#10B981" name="Receitas" />}
                {metricasSelecionadas.despesas && <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />}
              </BarChart>
            ) : (
              <AreaChart data={dadosTemporais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                {metricasSelecionadas.receitas && <Area type="monotone" dataKey="receitas" stackId="1" stroke="#10B981" fill="#10B981" name="Receitas" />}
                {metricasSelecionadas.despesas && <Area type="monotone" dataKey="despesas" stackId="1" stroke="#EF4444" fill="#EF4444" name="Despesas" />}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos Secundários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPorCategoria}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / dadosPorCategoria.reduce((s, d) => s + d.value, 0)) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance por Obra</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dadosPorObra}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                <Legend />
                <Bar dataKey="receitas" fill="#10B981" name="Receitas" />
                <Bar dataKey="despesas" fill="#EF4444" name="Despesas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}