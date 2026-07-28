import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../utils';
import { ArrowLeft, MapPin, Clock, Gauge, Fuel, Battery, Thermometer, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

export default function TelemetriaVeiculo() {
  const urlParams = new URLSearchParams(window.location.search);
  const veiculoId = urlParams.get('id');
  const [periodoFilter, setPeriodoFilter] = useState('24');

  const { data: veiculoData, isLoading } = useQuery({
    queryKey: ['veiculo', veiculoId],
    queryFn: () => base44.entities.Veiculo.filter({ id: veiculoId }),
    enabled: !!veiculoId
  });

  const { data: registros = [] } = useQuery({
    queryKey: ['telemetria-veiculo', veiculoId],
    queryFn: () => base44.entities.RegistroTelemetria.filter({ veiculo_id: veiculoId }, '-created_date', 500),
    enabled: !!veiculoId
  });

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas-veiculo', veiculoId],
    queryFn: () => base44.entities.AlertaTelemetria.filter({ veiculo_id: veiculoId }, '-data_hora', 50),
    enabled: !!veiculoId
  });

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-64 bg-gray-800 rounded-2xl" /></div>;
  }

  const veiculo = veiculoData?.[0];
  if (!veiculo) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Veículo não encontrado</p>
      </div>
    );
  }

  // Filtro de período
  const horasAtras = parseInt(periodoFilter);
  const dataCorte = new Date(Date.now() - horasAtras * 60 * 60 * 1000);
  const registrosFiltrados = registros.filter(r => new Date(r.created_date) >= dataCorte);

  const ultimoRegistro = registros[0];

  // Dados para gráficos
  const dadosVelocidade = registrosFiltrados.slice(0, 50).reverse().map(r => ({
    hora: new Date(r.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    velocidade: r.velocidade || 0,
    rpm: r.rpm || 0
  }));

  const dadosCombustivel = registrosFiltrados.slice(0, 50).reverse().map(r => ({
    hora: new Date(r.created_date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    nivel: r.nivel_combustivel || 0
  }));

  // Estatísticas
  const velocidadeMedia = registrosFiltrados.length > 0
    ? (registrosFiltrados.reduce((acc, r) => acc + (r.velocidade || 0), 0) / registrosFiltrados.length).toFixed(1)
    : 0;

  const velocidadeMaxima = Math.max(...registrosFiltrados.map(r => r.velocidade || 0));

  const tempoLigado = registrosFiltrados.filter(r => r.ignicao).length;
  const horasLigado = (tempoLigado * 5 / 60).toFixed(1); // Estimativa: 5 min por registro

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.href = createPageUrl('Telemetria')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{veiculo.placa}</h1>
            <p className="text-gray-500">{veiculo.marca} {veiculo.modelo} • {veiculo.ano}</p>
          </div>
        </div>
        <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
          <SelectTrigger className="w-44 bg-gray-900 border-gray-800 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-800">
            <SelectItem value="1">Última 1 hora</SelectItem>
            <SelectItem value="6">Últimas 6 horas</SelectItem>
            <SelectItem value="24">Últimas 24 horas</SelectItem>
            <SelectItem value="168">Última semana</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Atual */}
      {ultimoRegistro && (
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              Status Atual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <Gauge className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-gray-400 text-sm">Velocidade</p>
                  <p className="text-white font-bold text-xl">{ultimoRegistro.velocidade || 0} km/h</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Fuel className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="text-gray-400 text-sm">Combustível</p>
                  <p className="text-white font-bold text-xl">{ultimoRegistro.nivel_combustivel || 0}%</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Battery className="w-8 h-8 text-emerald-500" />
                <div>
                  <p className="text-gray-400 text-sm">Bateria</p>
                  <p className="text-white font-bold text-xl">{ultimoRegistro.bateria || 0}V</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-gray-400 text-sm">Horímetro</p>
                  <p className="text-white font-bold text-xl">{ultimoRegistro.horimetro || 0}h</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas do Período */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <p className="text-gray-400 text-sm mb-1">Velocidade Média</p>
            <p className="text-2xl font-bold text-white">{velocidadeMedia} km/h</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <p className="text-gray-400 text-sm mb-1">Velocidade Máxima</p>
            <p className="text-2xl font-bold text-white">{velocidadeMaxima} km/h</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <p className="text-gray-400 text-sm mb-1">Tempo Ligado</p>
            <p className="text-2xl font-bold text-white">{horasLigado}h</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Velocidade */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Velocidade & RPM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dadosVelocidade}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hora" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                  />
                  <Line type="monotone" dataKey="velocidade" stroke="#3B82F6" strokeWidth={2} name="Velocidade (km/h)" />
                  <Line type="monotone" dataKey="rpm" stroke="#F59E0B" strokeWidth={2} name="RPM" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Combustível */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Nível de Combustível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosCombustivel}>
                  <defs>
                    <linearGradient id="colorComb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="hora" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '12px',
                      color: '#fff'
                    }}
                    formatter={(value) => `${value}%`}
                  />
                  <Area type="monotone" dataKey="nivel" stroke="#F59E0B" fillOpacity={1} fill="url(#colorComb)" strokeWidth={2} name="Nível (%)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Alertas */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Histórico de Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Nenhum alerta registrado</p>
          ) : (
            <div className="space-y-3">
              {alertas.map(alerta => (
                <div key={alerta.id} className="p-4 bg-gray-800/50 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white font-medium capitalize">{alerta.tipo.replace(/_/g, ' ')}</p>
                    <Badge className={cn("border text-xs", alerta.severidade === 'critica' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')}>
                      {alerta.severidade}
                    </Badge>
                  </div>
                  <p className="text-gray-400 text-sm mb-1">{alerta.descricao}</p>
                  <p className="text-gray-500 text-xs">
                    {new Date(alerta.data_hora || alerta.created_date).toLocaleString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}