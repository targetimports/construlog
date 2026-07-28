import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

export default function MapaFrota({ veiculos }) {
  const veiculosComLocalizacao = veiculos.filter(v => v.ultimoRegistro?.latitude && v.ultimoRegistro?.longitude);

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Mapa da Frota
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-gray-800 rounded-xl p-12 text-center">
          <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Visualização de Mapa</h3>
          <p className="text-gray-400 mb-4">
            {veiculosComLocalizacao.length} veículos com localização registrada
          </p>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Para visualizar o mapa em tempo real, integre com serviços de GPS como Google Maps ou OpenStreetMap.
            Os dados de latitude/longitude já estão sendo capturados.
          </p>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {veiculosComLocalizacao.slice(0, 4).map(({ veiculo, ultimoRegistro }) => (
              <div key={veiculo.id} className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-white font-medium text-sm mb-1">{veiculo.placa}</p>
                <p className="text-gray-500 text-xs">
                  {ultimoRegistro.latitude.toFixed(4)}, {ultimoRegistro.longitude.toFixed(4)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}