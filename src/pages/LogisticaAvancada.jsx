import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Truck,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  Calendar,
  BarChart3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import SimuladorRota from '../components/logistica/SimuladorRota';
import AnaliseOciosidade from '../components/logistica/AnaliseOciosidade';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

export default function LogisticaAvancada() {
  const [periodoFilter, setPeriodoFilter] = useState('30');

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: viagens = [] } = useQuery({
    queryKey: ['viagens'],
    queryFn: () => base44.entities.Viagem.list('-data_saida', 200)
  });

  const { data: abastecimentos = [] } = useQuery({
    queryKey: ['abastecimentos'],
    queryFn: () => base44.entities.Abastecimento.list('-data', 200)
  });

  const { data: manutencoes = [] } = useQuery({
    queryKey: ['manutencoes'],
    queryFn: () => base44.entities.Manutencao.list('-data_inicio', 200)
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Filtro de período
  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - Number(periodoFilter));

  const viagensPeriodo = viagens.filter(v => new Date(v.created_date) >= dataCorte);

  // Cálculos
  const totalKmRodados = viagensPeriodo.reduce((acc, v) => acc + (v.km_percorrido || 0), 0);
  const custoTotalViagens = viagensPeriodo.reduce((acc, v) => acc + (v.custo_total || 0), 0);
  const custoMedioKm = totalKmRodados > 0 ? custoTotalViagens / totalKmRodados : 0;

  // Custo por veículo
  const custoPorVeiculo = veiculos.map(veiculo => {
    const viagensVeiculo = viagensPeriodo.filter(v => v.veiculo_id === veiculo.id);
    const custoViagens = viagensVeiculo.reduce((acc, v) => acc + (v.custo_total || 0), 0);
    const abastVeiculo = abastecimentos.filter(a => a.veiculo_id === veiculo.id);
    const custoAbast = abastVeiculo.reduce((acc, a) => acc + (a.valor_total || 0), 0);
    return {
      placa: veiculo.placa,
      custo: custoViagens + custoAbast,
      km: viagensVeiculo.reduce((acc, v) => acc + (v.km_percorrido || 0), 0)
    };
  }).sort((a, b) => b.custo - a.custo).slice(0, 8);

  // Eficiência por tipo de veículo
  const eficienciaPorTipo = {};
  viagens.forEach(v => {
    const veiculo = veiculos.find(ve => ve.id === v.veiculo_id);
    if (!veiculo || !v.km_percorrido) return;
    
    if (!eficienciaPorTipo[veiculo.tipo]) {
      eficienciaPorTipo[veiculo.tipo] = { total_km: 0, total_combustivel: 0 };
    }
    eficienciaPorTipo[veiculo.tipo].total_km += v.km_percorrido;
    eficienciaPorTipo[veiculo.tipo].total_combustivel += v.combustivel_gasto || 0;
  });

  const dadosEficiencia = Object.entries(eficienciaPorTipo).map(([tipo, data]) => ({
    tipo: tipo.replace('_', ' ').charAt(0).toUpperCase() + tipo.slice(1).replace('_', ' '),
    kmPorLitro: data.total_combustivel > 0 ? (data.total_km / data.total_combustivel).toFixed(2) : 0
  }));

  // Análise temporal
  const viagensPorMes = {};
  viagensPeriodo.forEach(v => {
    if (!v.data_saida) return;
    const mes = new Date(v.data_saida).toLocaleDateString('pt-BR', { month: 'short' });
    if (!viagensPorMes[mes]) {
      viagensPorMes[mes] = { viagens: 0, km: 0, custo: 0 };
    }
    viagensPorMes[mes].viagens += 1;
    viagensPorMes[mes].km += v.km_percorrido || 0;
    viagensPorMes[mes].custo += v.custo_total || 0;
  });

  const dadosTemporais = Object.entries(viagensPorMes).map(([mes, data]) => ({
    mes,
    viagens: data.viagens,
    km: data.km,
    custo: data.custo
  }));

  // Tempo médio de viagem
  const viagensComTempo = viagensPeriodo.filter(v => v.data_saida && v.data_chegada);
  const tempoMedioHoras = viagensComTempo.length > 0
    ? viagensComTempo.reduce((acc, v) => {
        const inicio = new Date(v.data_saida);
        const fim = new Date(v.data_chegada);
        return acc + (fim - inicio) / (1000 * 60 * 60);
      }, 0) / viagensComTempo.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <PageHeader
          title="Logística Avançada"
          subtitle="Análise de rotas, custos e eficiência operacional"
        />
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="w-44">
            <Calendar className="w-4 h-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total de KM"
          value={totalKmRodados.toLocaleString('pt-BR')}
          subtitle={`${viagensPeriodo.length} viagens`}
          icon={Truck}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Custo Total"
          value={custoTotalViagens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={DollarSign}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Custo por KM"
          value={custoMedioKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          icon={TrendingUp}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Tempo Médio Viagem"
          value={`${tempoMedioHoras.toFixed(1)}h`}
          icon={Clock}
          iconBg="bg-purple-500/10"
          iconColor="text-purple-500"
        />
      </div>

      {/* Simulador e Ociosidade */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimuladorRota veiculos={veiculos} obras={obras} />
        <AnaliseOciosidade veiculos={veiculos} viagens={viagensPeriodo} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Custo por Veículo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-500" />
              Custo por Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={custoPorVeiculo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="placa" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="custo" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Custo" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Eficiência Combustível */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Eficiência por Tipo de Veículo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosEficiencia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="tipo" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => `${value} km/l`}
                  />
                  <Bar dataKey="kmPorLitro" fill="#10B981" radius={[8, 8, 0, 0]} name="KM por Litro" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evolução Temporal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            Evolução de Custos e KM
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dadosTemporais}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                <YAxis yAxisId="left" stroke="#9CA3AF" fontSize={12} />
                <YAxis yAxisId="right" orientation="right" stroke="#9CA3AF" fontSize={12} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1F2937', 
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Line yAxisId="left" type="monotone" dataKey="km" stroke="#3B82F6" strokeWidth={2} name="KM" />
                <Line yAxisId="right" type="monotone" dataKey="custo" stroke="#F59E0B" strokeWidth={2} name="Custo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}