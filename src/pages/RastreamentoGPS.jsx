import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Truck, Clock, Activity } from 'lucide-react';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function RastreamentoGPS() {
  const [veiculoSelecionado, setVeiculoSelecionado] = useState('todos');

  const { data: veiculos = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const { data: viagensAtivas = [], isLoading: loadingViagens } = useQuery({
    queryKey: ['viagens-ativas'],
    queryFn: () => base44.entities.Viagem.filter({ status: 'em_andamento' })
  });

  const { data: telemetria = [], isLoading: loadingTelemetria } = useQuery({
    queryKey: ['telemetria', veiculoSelecionado],
    queryFn: () => {
      const filter = veiculoSelecionado !== 'todos' 
        ? { veiculo_id: veiculoSelecionado }
        : {};
      return base44.entities.RegistroTelemetria.filter(filter, '-timestamp', 50);
    }
  });

  const veiculosComViagem = viagensAtivas.map(v => v.veiculo_id);
  const veiculosFiltrados = veiculoSelecionado === 'todos'
    ? veiculos
    : veiculos.filter(v => v.id === veiculoSelecionado);

  if (loadingVeiculos) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PageSkeleton kpis={3} rows={6} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rastreamento GPS</h1>
          <p className="text-gray-600 mt-1">Monitore a localização da frota em tempo real</p>
        </div>
        <Badge variant="outline" className="text-green-600 border-green-600">
          <Activity className="w-4 h-4 mr-1" />
          {viagensAtivas.length} em andamento
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtrar Veículo</CardTitle>
            <Select value={veiculoSelecionado} onValueChange={setVeiculoSelecionado}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione um veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Veículos</SelectItem>
                {veiculos.map(veiculo => (
                  <SelectItem key={veiculo.id} value={veiculo.id}>
                    {veiculo.placa} - {veiculo.modelo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              Mapa de Localização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center">
              <div className="text-center text-gray-600">
                <MapPin className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="font-semibold">Mapa GPS em Desenvolvimento</p>
                <p className="text-sm mt-2">Integração com sistema de rastreamento em andamento</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Veículos Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {veiculosFiltrados.length === 0 ? (
                  <p className="text-sm text-gray-600 text-center py-4">Nenhum veículo encontrado</p>
                ) : (
                  veiculosFiltrados.map(veiculo => {
                    const emViagem = veiculosComViagem.includes(veiculo.id);
                    const viagem = viagensAtivas.find(v => v.veiculo_id === veiculo.id);
                    
                    return (
                      <div key={veiculo.id} className="p-3 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-50 rounded-lg">
                              <Truck className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{veiculo.placa}</p>
                              <p className="text-sm text-gray-600">{veiculo.modelo}</p>
                            </div>
                          </div>
                          <Badge variant={emViagem ? 'default' : 'secondary'}>
                            {emViagem ? 'Em viagem' : 'Parado'}
                          </Badge>
                        </div>
                        
                        {emViagem && viagem && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Navigation className="w-4 h-4" />
                              <span>{viagem.destino}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Clock className="w-4 h-4" />
                              <span>Início: {new Date(viagem.data_saida).toLocaleString('pt-BR')}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {telemetria.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas Posições</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {telemetria.slice(0, 5).map((registro, idx) => (
                    <div key={idx} className="text-sm p-2 bg-gray-50 rounded">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-900">
                          {veiculos.find(v => v.id === registro.veiculo_id)?.placa || 'N/A'}
                        </span>
                        <span className="text-gray-600">
                          {registro.timestamp ? new Date(registro.timestamp).toLocaleTimeString('pt-BR') : 'N/A'}
                        </span>
                      </div>
                      {registro.latitude && registro.longitude && (
                        <p className="text-gray-600 mt-1">
                          {registro.latitude.toFixed(6)}, {registro.longitude.toFixed(6)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}