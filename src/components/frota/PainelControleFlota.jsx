import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play, Square, ArrowRight, AlertCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import FormCheckIn from './FormCheckIn';
import FormCheckOut from './FormCheckOut';
import TrocaMotoristaModal from './TrocaMotoristaModal';

export default function PainelControleFlota() {
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showTroca, setShowTroca] = useState(false);
  const [selectedUso, setSelectedUso] = useState(null);

  // Buscar usos ativos
  const { data: usosAtivos = [], isLoading } = useQuery({
    queryKey: ['usos-ativos'],
    queryFn: async () => {
      const usos = await base44.entities.UsoVeiculo.filter({ status: 'ativo' });
      return usos || [];
    },
    refetchInterval: 5000 // Atualizar a cada 5 segundos
  });

  // Buscar veículos
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-status'],
    queryFn: async () => {
      const vecs = await base44.entities.Veiculo.list();
      return vecs || [];
    }
  });

  const getStatusColor = (status) => {
    const colors = {
      'DISPONÍVEL': 'bg-green-100 text-green-800',
      'EM_USO': 'bg-blue-100 text-blue-800',
      'MANUTENÇÃO': 'bg-yellow-100 text-yellow-800',
      'INDISPONÍVEL': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Botoeira Rápida */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Controle de Frota
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setShowCheckIn(true)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Play className="w-4 h-4" /> Check-in
            </Button>
            <Button
              onClick={() => {
                if (!selectedUso) {
                  toast.error('Selecione um veículo em uso');
                  return;
                }
                setShowCheckOut(true);
              }}
              variant="outline"
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
            >
              <Square className="w-4 h-4" /> Check-out
            </Button>
            <Button
              onClick={() => {
                if (!selectedUso) {
                  toast.error('Selecione um veículo em uso');
                  return;
                }
                setShowTroca(true);
              }}
              variant="outline"
              className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <ArrowRight className="w-4 h-4" /> Trocar Motorista
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Veículos em Uso */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Veículos em Uso ({usosAtivos.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          {usosAtivos.length === 0 ? (
            <p className="text-center text-gray-500 py-6">Nenhum veículo em uso</p>
          ) : (
            <div className="space-y-3">
              {usosAtivos.map(uso => (
                <div
                  key={uso.id}
                  onClick={() => setSelectedUso(uso)}
                  className={`p-4 border rounded-lg cursor-pointer transition ${
                    selectedUso?.id === uso.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-gray-600">Veículo</p>
                      <p className="font-semibold text-gray-900">{uso.veiculo_placa}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Motorista</p>
                      <p className="font-semibold text-gray-900">{uso.motorista_nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">KM Inicial</p>
                      <p className="font-semibold text-gray-900">{uso.km_inicial}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tempo</p>
                      <p className="font-semibold text-gray-900">
                        {calcularTempoDecorrido(uso.data_hora_inicio)}
                      </p>
                    </div>
                  </div>
                  {uso.destino && (
                    <p className="text-xs text-gray-600 mt-2">Destino: {uso.destino}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status dos Veículos */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Status da Frota</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {['DISPONÍVEL', 'EM_USO', 'MANUTENÇÃO', 'INDISPONÍVEL'].map(status => {
              const count = veiculos.filter(v => v.status === status).length;
              return (
                <div key={status} className="text-center p-4 border border-gray-200 rounded-lg">
                  <p className={`inline-block px-3 py-1 rounded text-sm font-medium ${getStatusColor(status)}`}>
                    {status}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{count}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modais */}
      <FormCheckIn isOpen={showCheckIn} onClose={() => setShowCheckIn(false)} />
      <FormCheckOut isOpen={showCheckOut} onClose={() => setShowCheckOut(false)} uso={selectedUso} />
      <TrocaMotoristaModal isOpen={showTroca} onClose={() => setShowTroca(false)} uso={selectedUso} />
    </div>
  );
}

function calcularTempoDecorrido(dataInicio) {
  const inicio = new Date(dataInicio);
  const agora = new Date();
  const diffMs = agora - inicio;
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHoras}h ${diffMinutos}min`;
}