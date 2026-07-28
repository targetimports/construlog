import React from 'react';
import { Truck } from 'lucide-react';

export default function TodayTripsList({ config }) {
  // Mock data
  const viagens = [
    { id: 1, veiculo: 'ABC-1234', destino: 'Obra Centro', status: 'em_andamento' },
    { id: 2, veiculo: 'XYZ-5678', destino: 'Fornecedor SP', status: 'planejada' },
  ];

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Truck className="w-4 h-4" /> Viagens de Hoje
      </h3>
      <div className="space-y-2">
        {viagens.map(v => (
          <div key={v.id} className="text-xs p-2 bg-blue-50 rounded">
            <p className="font-semibold text-gray-900">{v.veiculo}</p>
            <p className="text-gray-600">{v.destino}</p>
          </div>
        ))}
      </div>
    </div>
  );
}