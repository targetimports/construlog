import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, MapPin, AlertCircle } from 'lucide-react';

export default function VeiculosAtivosWidget() {
  const { data: rotas = [] } = useQuery({
    queryKey: ['rotas-veiculos-ativos'],
    queryFn: () => base44.entities.RotaMotorista.filter({ status: 'em_andamento' }, '-created_date', 50),
    refetchInterval: 5000 // Atualiza a cada 5 segundos
  });

  if (rotas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-gray-500">
          <Truck className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          Nenhum veículo em rota no momento
        </CardContent>
      </Card>);

  }

  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-gray-900 font-semibold flex items-center gap-2">
          <AlertCircle className="text-red-500 w-5 h-5" />
          Veículos em Rota Ativa
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {rotas.map((rota) =>
          <div key={rota.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{rota.veiculo_placa || 'Veículo'}</p>
                  <p className="text-xs text-gray-600">{rota.motorista_email || 'Motorista'}</p>
                </div>
                <Badge className="bg-red-100 text-red-700 border-0 px-2.5 py-0.5 text-xs font-semibold animate-pulse">Em rota</Badge>
              </div>

              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-green-500" />
                  <span className="truncate">{rota.endereco_origem || '-'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="truncate">{rota.endereco_destino || '-'}</span>
                </div>
              </div>

              {rota.motivo &&
            <p className="text-xs mt-2 text-gray-700 bg-white p-1.5 rounded border border-gray-200">
                  {rota.motivo}
                </p>
            }
            </div>
          )}
        </div>
      </CardContent>
    </Card>);

}