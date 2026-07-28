import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { RefreshCw, TrendingDown, AlertCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Resumo() {
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [obraFiltro, setObraFiltro] = useState('todas');

  const { data: resumo, refetch, isRefetching } = useQuery({
    queryKey: ['resumo-financeiro', periodo],
    queryFn: async () => {
      const resultado = await base44.functions.invoke('consolidarResumoFinanceiro', { periodo });
      return resultado.data.resumo || resultado.data;
    }
  });

  const { data: pessoasData } = useQuery({
    queryKey: ['totais-pessoas', periodo],
    queryFn: async () => {
      const resultado = await base44.functions.invoke('obterTotaisPorPessoa', { periodo });
      return resultado.data.pessoas || [];
    }
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: tendencias = [] } = useQuery({
    queryKey: ['tendencias-mensais', periodo],
    queryFn: async () => {
      const resultado = await base44.functions.invoke('obterTendenciasMensais', { periodo });
      return resultado.data.tendencias || [];
    }
  });

  const handleConsolidar = async () => {
    await refetch();
  };

  // Gerar alertas financeiros
  const alertasFinanceiros = useMemo(() => {
    const alertas = [];
    
    if (!resumo) return alertas;

    // Alerta 1: Fluxo de caixa baixo
    const despesasAltas = resumo.total_geral > 50000;
    if (despesasAltas) {
      alertas.push({
        tipo: 'critico',
        titulo: 'Fluxo de Caixa Crítico',
        descricao: `Despesas em R$ ${resumo.total_geral.toLocaleString('pt-BR')} - Acima do esperado`,
        icon: AlertTriangle
      });
    }

    // Alerta 2: Picos de despesas
    const categoriasAltas = dadadosGrafico.filter(c => c.value > resumo.total_geral * 0.3);
    if (categoriasAltas.length > 0) {
      alertas.push({
        tipo: 'aviso',
        titulo: 'Picos de Despesas Detectados',
        descricao: `${categoriasAltas.map(c => c.name).join(', ')} acima do padrão`,
        icon: AlertCircle
      });
    }

    // Alerta 3: Material é a maior categoria
    const material = dadadosGrafico.find(c => c.name === 'Material');
    if (material && material.value > resumo.total_geral * 0.5) {
      alertas.push({
        tipo: 'info',
        titulo: 'Material Representa 50% das Despesas',
        descricao: `Revisar fornecedores e otimizar compras`,
        icon: TrendingDown
      });
    }

    return alertas;
  }, [resumo, dadadosGrafico]);

  // Preparar dados para gráfico pizza
  const dadadosGrafico = resumo ? [
    { name: 'Material', value: resumo.total_material || 0 },
    { name: 'Mão de Obra', value: resumo.total_mao_de_obra || 0 },
    { name: 'Alimentação', value: resumo.total_alimentacao || 0 },
    { name: 'Aluguel', value: resumo.total_aluguel_equipamento || 0 },
    { name: 'Fretes', value: resumo.total_frete || 0 },
    { name: 'Estadias', value: resumo.total_estadia || 0 },
    { name: 'Impostos', value: resumo.total_imposto || 0 },
    { name: 'Investimento', value: resumo.total_investimento || 0 },
    { name: 'Retirada', value: resumo.total_retirada || 0 },
    { name: 'Empreita', value: resumo.total_empreita || 0 },
    { name: 'Genérico', value: resumo.total_generico || 0 }
  ].filter(x => x.value > 0) : [];

  const cores = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#a855f7'];

  // Filtrar dados por obra
  const pessoasDataFiltradas = obraFiltro === 'todas' 
    ? pessoasData 
    : pessoasData?.filter(p => p.obra_id === obraFiltro) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
         <div>
           <h1 className="text-3xl font-bold mb-2">DASHBOARD FINANCEIRO</h1>
           <div className="flex items-center gap-2 mt-2">
             <TrendingDown className="w-5 h-5 text-blue-500" />
             <p className="text-blue-600 font-semibold">VISÃO CONSOLIDADA - CONTAS E FLUXO</p>
           </div>
           <p className="text-gray-600 text-sm mt-1">Resumo consolidado por obra</p>
         </div>
        <Button onClick={handleConsolidar} disabled={isRefetching} className="bg-blue-600 hover:bg-blue-700">
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Seletor de período e obra */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Filtrar por Obra</label>
          <Select value={obraFiltro} onValueChange={setObraFiltro}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Obras</SelectItem>
              {obras.map(obra => (
                <SelectItem key={obra.id} value={obra.id}>
                  {obra.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        Atualizado em: {resumo?.data_atualizacao ? new Date(resumo.data_atualizacao).toLocaleDateString('pt-BR') : '-'}
      </p>

      {/* KPIs - Contas Principais */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <KPIResumo label="Contas a Pagar" valor={resumo?.total_geral || 0} cor="bg-red-100 text-red-700" />
         <KPIResumo label="Contas a Receber" valor={0} cor="bg-green-100 text-green-700" />
         <KPIResumo label="Saldo em Caixa" valor={0} cor="bg-blue-100 text-blue-700" />
       </div>

      {/* INFO - Resumo por Obra */}
       <Card>
         <CardHeader>
           <CardTitle>Resumo Geral - {periodo}</CardTitle>
         </CardHeader>
         <CardContent className="pt-4">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="border-l-4 border-red-500 pl-4">
               <p className="text-sm text-gray-600 font-medium">Total de Despesas Registradas</p>
               <p className="text-3xl font-bold text-red-600">
                 R$ {(resumo?.total_geral || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
               </p>
             </div>
             <div className="border-l-4 border-blue-500 pl-4">
               <p className="text-sm text-gray-600 font-medium">Nota: Operações Dentro de Obras</p>
               <p className="text-sm text-gray-600 mt-2">Todos os lançamentos (Material, Mão de Obra, Fretes, etc.) agora devem ser registrados dentro de cada obra específica.</p>
             </div>
           </div>
         </CardContent>
       </Card>

      {/* Alertas Financeiros */}
      {alertasFinanceiros.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertTriangle className="w-5 h-5" />
              Alertas Financeiros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alertasFinanceiros.map((alerta, idx) => {
              const Icon = alerta.icon;
              const estilos = {
                critico: 'bg-red-50 border-red-200 text-red-700',
                aviso: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                info: 'bg-blue-50 border-blue-200 text-blue-700'
              };
              return (
                <div key={idx} className={`border rounded-lg p-3 ${estilos[alerta.tipo]}`}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{alerta.titulo}</p>
                      <p className="text-xs mt-1">{alerta.descricao}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {dadadosGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={dadadosGrafico} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {dadadosGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                Nenhum dado para este período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Barras */}
        <Card>
          <CardHeader>
            <CardTitle>Totais por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {dadadosGrafico.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadadosGrafico}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
                  <YAxis />
                  <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                  <Bar dataKey="value" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                Nenhum dado para este período
              </div>
            )}
          </CardContent>
        </Card>
        </div>

        {/* Gráfico de Tendências Mensais */}
        <Card>
        <CardHeader>
          <CardTitle>Tendência de Receitas e Despesas (Últimos 12 Meses)</CardTitle>
        </CardHeader>
        <CardContent>
          {tendencias.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={tendencias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" style={{ fontSize: '12px' }} />
                <YAxis />
                <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} />
                <Legend />
                <Line type="monotone" dataKey="despesas" stroke="#ef4444" name="Despesas" strokeWidth={2} />
                <Line type="monotone" dataKey="receitas" stroke="#10b981" name="Receitas" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400">
              Nenhum dado de tendência disponível
            </div>
          )}
        </CardContent>
        </Card>

        {/* Totais por Pessoa */}
        <Card>
          <CardHeader>
            <CardTitle>Totais por Pessoa - {periodo} {obraFiltro !== 'todas' && `(${obras.find(o => o.id === obraFiltro)?.nome})`}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pessoasDataFiltradas && pessoasDataFiltradas.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2 px-3 font-bold">Pessoa</th>
                  <th className="text-right py-2 px-3 font-bold">Mão de Obra</th>
                  <th className="text-right py-2 px-3 font-bold">Retirada</th>
                  <th className="text-right py-2 px-3 font-bold">Empreita</th>
                  <th className="text-right py-2 px-3 font-bold">Investimento</th>
                  <th className="text-right py-2 px-3 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {pessoasDataFiltradas.map((pessoa, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium">{pessoa.pessoa_id}</td>
                    <td className="text-right py-2 px-3 font-mono">R$ {pessoa.mao_de_obra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-2 px-3 font-mono">R$ {pessoa.retiradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-2 px-3 font-mono">R$ {pessoa.empreitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-2 px-3 font-mono">R$ {pessoa.investimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right py-2 px-3 font-bold font-mono bg-blue-50">R$ {pessoa.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum lançamento vinculado a pessoas neste período
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPIResumo({ label, valor, cor }) {
  return (
    <Card>
      <CardContent className={`pt-4 pb-4 text-center ${cor}`}>
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold mt-1">
          R$ {valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
        </p>
      </CardContent>
    </Card>
  );
}