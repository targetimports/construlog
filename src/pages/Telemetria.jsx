import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { 
  Truck,
  MapPin,
  Activity,
  AlertTriangle,
  Clock,
  Gauge,
  Zap,
  TrendingUp,
  Eye,
  DollarSign,
  Route,
  BarChart3,
  Calendar
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import MapaFrota from '../components/telemetria/MapaFrota';
import SimuladorRota from '../components/logistica/SimuladorRota';
import AnaliseOciosidade from '../components/logistica/AnaliseOciosidade';

const statusVeiculoConfig = {
  movimento: { label: 'Em Movimento', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: Activity },
  parado: { label: 'Parado', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: Clock },
  ocioso: { label: 'Ocioso', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle },
  desligado: { label: 'Desligado', color: 'bg-gray-500/10 text-gray-500 border-gray-700', icon: Zap }
};

const severidadeConfig = {
  baixa: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  media: { color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  alta: { color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  critica: { color: 'bg-red-500/20 text-red-300 border-red-500/30' }
};

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6'];

export default function Telemetria() {
  const [veiculoSelecionado, setVeiculoSelecionado] = useState(null);
  const [periodoFilter, setPeriodoFilter] = useState('30');

  const { data: veiculos = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: registros = [] } = useQuery({
    queryKey: ['telemetria-registros'],
    queryFn: () => base44.entities.RegistroTelemetria.list('-created_date', 500)
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['telemetria-alertas'],
    queryFn: () => base44.entities.AlertaTelemetria.list('-data_hora', 100)
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

  // Último registro por veículo
  const ultimosRegistros = veiculos.map(veiculo => {
    const regsVeiculo = registros.filter(r => r.veiculo_id === veiculo.id);
    return {
      veiculo,
      ultimoRegistro: regsVeiculo[0] || null
    };
  });

  // Status da frota
  const veiculosEmMovimento = ultimosRegistros.filter(v => v.ultimoRegistro?.evento === 'movimento').length;
  const veiculosOciosos = ultimosRegistros.filter(v => v.ultimoRegistro?.evento === 'ocioso').length;
  const veiculosParados = ultimosRegistros.filter(v => v.ultimoRegistro?.ignicao && v.ultimoRegistro?.velocidade === 0).length;

  // Alertas não resolvidos
  const alertasAbertos = alertas.filter(a => a.status === 'aberto');
  const alertasCriticos = alertasAbertos.filter(a => a.severidade === 'critica').length;

  // Tempo médio ocioso hoje
  const hoje = new Date().toISOString().split('T')[0];
  const registrosHoje = registros.filter(r => r.created_date?.startsWith(hoje) && r.evento === 'ocioso');
  const tempoOciosoMedio = registrosHoje.length > 0 
    ? (registrosHoje.length * 5 / 60).toFixed(1)
    : 0;

  // Dados análise avançada
  const dataCorte = new Date();
  dataCorte.setDate(dataCorte.getDate() - Number(periodoFilter));
  const viagensPeriodo = viagens.filter(v => new Date(v.created_date) >= dataCorte);
  const totalKmRodados = viagensPeriodo.reduce((acc, v) => acc + (v.km_percorrido || 0), 0);
  const custoTotalViagens = viagensPeriodo.reduce((acc, v) => acc + (v.custo_total || 0), 0);
  const custoMedioKm = totalKmRodados > 0 ? custoTotalViagens / totalKmRodados : 0;

  const custoPorVeiculo = veiculos.map(veiculo => {
    const viagensVeiculo = viagensPeriodo.filter(v => v.veiculo_id === veiculo.id);
    const custoViagens = viagensVeiculo.reduce((acc, v) => acc + (v.custo_total || 0), 0);
    const abastVeiculo = abastecimentos.filter(a => a.veiculo_id === veiculo.id);
    const custoAbast = abastVeiculo.reduce((acc, a) => acc + (a.valor_total || 0), 0);
    return { placa: veiculo.placa, custo: custoViagens + custoAbast, km: viagensVeiculo.reduce((acc, v) => acc + (v.km_percorrido || 0), 0) };
  }).sort((a, b) => b.custo - a.custo).slice(0, 8);

  const eficienciaPorTipo = {};
  viagens.forEach(v => {
    const veiculo = veiculos.find(ve => ve.id === v.veiculo_id);
    if (!veiculo || !v.km_percorrido) return;
    if (!eficienciaPorTipo[veiculo.tipo]) eficienciaPorTipo[veiculo.tipo] = { total_km: 0, total_combustivel: 0 };
    eficienciaPorTipo[veiculo.tipo].total_km += v.km_percorrido;
    eficienciaPorTipo[veiculo.tipo].total_combustivel += v.combustivel_gasto || 0;
  });

  const dadosEficiencia = Object.entries(eficienciaPorTipo).map(([tipo, data]) => ({
    tipo: tipo.replace('_', ' ').charAt(0).toUpperCase() + tipo.slice(1).replace('_', ' '),
    kmPorLitro: data.total_combustivel > 0 ? (data.total_km / data.total_combustivel).toFixed(2) : 0
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetria & Análise"
        subtitle="Rastreamento e análise avançada da frota"
      />

      <Tabs defaultValue="rastreamento" className="space-y-6">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="rastreamento">Rastreamento</TabsTrigger>
          <TabsTrigger value="analise">Análise Avançada</TabsTrigger>
        </TabsList>

        <TabsContent value="rastreamento" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard title="Veículos Ativos" value={veiculosEmMovimento} subtitle={`${veiculos.length} total`} icon={Truck} iconBg="bg-emerald-500/10" iconColor="text-emerald-500" />
            <StatCard title="Veículos Ociosos" value={veiculosOciosos} icon={Clock} iconBg="bg-amber-500/10" iconColor="text-amber-500" />
            <StatCard title="Alertas Críticos" value={alertasCriticos} subtitle={`${alertasAbertos.length} abertos`} icon={AlertTriangle} iconBg="bg-red-500/10" iconColor="text-red-500" />
            <StatCard title="Tempo Ocioso Médio" value={`${tempoOciosoMedio}h`} subtitle="Hoje" icon={Gauge} iconBg="bg-blue-500/10" iconColor="text-blue-500" />
          </div>

          <MapaFrota veiculos={ultimosRegistros} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status dos Veículos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Status da Frota ({veiculos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingVeiculos ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 bg-gray-800 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {ultimosRegistros.map(({ veiculo, ultimoRegistro }) => {
                  const status = ultimoRegistro?.evento 
                    ? statusVeiculoConfig[ultimoRegistro.evento] || statusVeiculoConfig.desligado
                    : statusVeiculoConfig.desligado;
                  const Icon = status.icon;

                  return (
                    <div key={veiculo.id} className="flex items-center justify-between p-4 bg-gray-100 rounded-xl hover:bg-gray-50 transition-colors">
                        <div className="flex items-center gap-3 flex-1">
                          <Icon className={cn("w-5 h-5", status.color.split(' ')[1])} />
                          <div>
                            <p className="text-gray-900 font-medium">{veiculo.placa}</p>
                            <p className="text-gray-600 text-xs">{veiculo.modelo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <Badge className={cn("border text-xs", status.color)}>
                            {status.label}
                          </Badge>
                          {ultimoRegistro?.velocidade !== undefined && (
                            <p className="text-gray-600 text-xs mt-1">
                              {ultimoRegistro.velocidade} km/h
                            </p>
                          )}
                        </div>
                        <Link to={createPageUrl(`TelemetriaVeiculo?id=${veiculo.id}`)}>
                          <Button size="sm" variant="ghost" className="text-amber-500">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  Alertas Recentes ({alertasAbertos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alertas.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Nenhum alerta registrado</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {alertas.slice(0, 10).map(alerta => {
                      const veiculo = veiculos.find(v => v.id === alerta.veiculo_id);
                      const sev = severidadeConfig[alerta.severidade] || severidadeConfig.media;
                      return (
                        <div key={alerta.id} className={cn("p-4 rounded-xl border", sev.color)}>
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4" />
                              <span className="font-medium capitalize">{alerta.tipo.replace(/_/g, ' ')}</span>
                            </div>
                            <Badge className={cn("border text-xs", sev.color)}>{alerta.severidade}</Badge>
                          </div>
                          <p className="text-sm mb-1">{alerta.descricao}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <span>{veiculo?.placa || 'Veículo desconhecido'}</span>
                            <span>•</span>
                            <span>{new Date(alerta.data_hora || alerta.created_date).toLocaleString('pt-BR')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analise" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Análise de Rotas e Eficiência</h3>
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

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard title="Total de KM" value={totalKmRodados.toLocaleString('pt-BR')} subtitle={`${viagensPeriodo.length} viagens`} icon={Truck} iconBg="bg-blue-500/10" iconColor="text-blue-500" />
            <StatCard title="Custo Total" value={custoTotalViagens.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={DollarSign} iconBg="bg-emerald-500/10" iconColor="text-emerald-500" />
            <StatCard title="Custo por KM" value={custoMedioKm.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} icon={TrendingUp} iconBg="bg-amber-500/10" iconColor="text-amber-500" />
            <StatCard title="Média KM/L" value={totalKmRodados > 0 && abastecimentos.length > 0 ? `${(totalKmRodados / abastecimentos.reduce((a, b) => a + (b.litros || 0), 0)).toFixed(1)} km/L` : '-'} icon={Gauge} iconBg="bg-purple-500/10" iconColor="text-purple-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SimuladorRota veiculos={veiculos} obras={obras} />
            <AnaliseOciosidade veiculos={veiculos} viagens={viagensPeriodo} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="placa" stroke="#6B7280" fontSize={11} />
                      <YAxis stroke="#6B7280" fontSize={12} tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                      <Bar dataKey="custo" fill="#F59E0B" radius={[8, 8, 0, 0]} name="Custo" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-500" />
                  Eficiência por Tipo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosEficiencia}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="tipo" stroke="#6B7280" fontSize={11} />
                      <YAxis stroke="#6B7280" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px' }} formatter={(value) => `${value} km/l`} />
                      <Bar dataKey="kmPorLitro" fill="#10B981" radius={[8, 8, 0, 0]} name="KM por Litro" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}