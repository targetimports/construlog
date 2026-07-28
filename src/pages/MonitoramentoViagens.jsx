import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Clock, User, Car, Eye, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function MonitoramentoViagens() {
  const [selectedViagem, setSelectedViagem] = useState(null);

  const { data: viagensEmAndamento, isLoading } = useQuery({
    queryKey: ['viagens-em-andamento'],
    queryFn: () => base44.entities.Viagem.filter({ status: 'em_andamento' }),
    refetchInterval: 30000 // Atualiza a cada 30 segundos
  });

  const { data: motoristas } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list()
  });

  const { data: veiculos } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const getMotorista = (userId) => {
    return motoristas?.find(m => m.user_id === userId);
  };

  const getVeiculo = (veiculoId) => {
    return veiculos?.find(v => v.id === veiculoId);
  };

  const calcularTempoDecorrido = (saidaReal) => {
    if (!saidaReal) return 'N/A';
    const inicio = new Date(saidaReal);
    const agora = new Date();
    const diffMs = agora - inicio;
    const horas = Math.floor(diffMs / 3600000);
    const minutos = Math.floor((diffMs % 3600000) / 60000);
    return `${horas}h ${minutos}min`;
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <PageSkeleton kpis={4} rows={4} cols={4} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Monitoramento de Viagens</h1>
        <p className="text-gray-600">Acompanhe viagens em andamento em tempo real</p>
      </div>

      {/* ESTATÍSTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Viagens Ativas</p>
              <p className="text-3xl font-bold text-blue-600">{viagensEmAndamento?.length || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Motoristas Ativos</p>
              <p className="text-3xl font-bold text-green-600">
                {new Set(viagensEmAndamento?.map(v => v.motorista_user_id)).size || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Veículos em Uso</p>
              <p className="text-3xl font-bold text-orange-600">
                {new Set(viagensEmAndamento?.map(v => v.veiculo_id)).size || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Atualização</p>
              <p className="text-sm font-bold text-gray-700">A cada 30s</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* LISTA DE VIAGENS EM ANDAMENTO */}
      <div>
        <h2 className="text-xl font-bold mb-4">Viagens em Andamento</h2>
        
        {viagensEmAndamento && viagensEmAndamento.length > 0 ? (
          <div className="grid gap-4">
            {viagensEmAndamento.map((viagem) => {
              const motorista = getMotorista(viagem.motorista_user_id);
              const veiculo = getVeiculo(viagem.veiculo_id);
              const tempoDecorrido = calcularTempoDecorrido(viagem.saida_real);

              return (
                <Card key={viagem.id} className="border-2 border-yellow-400 bg-yellow-50">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{viagem.numero}</CardTitle>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <Clock className="w-4 h-4" />
                          Em andamento há: <strong>{tempoDecorrido}</strong>
                        </div>
                      </div>
                      <span className="bg-yellow-500 text-white text-xs px-3 py-1 rounded-full font-bold">
                        EM ANDAMENTO
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Dados do Motorista */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-600">Motorista</p>
                          <p className="font-bold">{motorista?.nome || viagem.motorista_user_id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Car className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-600">Veículo</p>
                          <p className="font-bold">{veiculo?.placa || viagem.veiculo_id}</p>
                        </div>
                      </div>
                    </div>

                    {/* Origem/Destino */}
                    <div className="bg-white p-3 rounded-lg space-y-2">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600">Origem</p>
                          <p className="text-sm font-medium">
                            {viagem.origem_endereco || 'N/A'}
                          </p>
                          {viagem.latitude_origem && (
                            <p className="text-xs text-gray-500 font-mono">
                              {viagem.latitude_origem}, {viagem.longitude_origem}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-600">Destino</p>
                          <p className="text-sm font-medium">{viagem.destino || 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    {/* KM e Motivo */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-600">KM Inicial</p>
                        <p className="font-bold">{viagem.km_inicial || 'N/A'}</p>
                      </div>
                      <div className="bg-purple-50 p-2 rounded text-center">
                        <p className="text-xs text-gray-600">Motivo</p>
                        <p className="font-bold text-sm">{viagem.motivo || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Saída */}
                    <div className="text-xs text-gray-600">
                      <strong>Saída:</strong> {viagem.saida_real ? new Date(viagem.saida_real).toLocaleString('pt-BR') : 'N/A'}
                    </div>

                    {/* Botão Ver no Mapa */}
                    {viagem.latitude_origem && viagem.longitude_origem && (
                      <Button
                        onClick={() => {
                          window.open(
                            `https://www.google.com/maps?q=${viagem.latitude_origem},${viagem.longitude_origem}`,
                            '_blank'
                          );
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        <Navigation className="w-4 h-4 mr-2" />
                        Ver Origem no Mapa
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="font-medium">Nenhuma viagem em andamento no momento</p>
              <p className="text-sm mt-2">Todas as viagens foram finalizadas ou ainda não iniciaram</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}