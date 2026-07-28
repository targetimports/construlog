import React from 'react';
import { Truck, Gauge, Calendar, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  manutencao: { label: 'Manutenção', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  inativo: { label: 'Inativo', color: 'bg-red-500/10 text-red-400 border-red-500/20' }
};

const tipoConfig = {
  caminhao: 'Caminhão',
  carreta: 'Carreta',
  maquina_pesada: 'Máquina Pesada',
  utilitario: 'Utilitário',
  veiculo_leve: 'Veículo Leve'
};

import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';

export default function VeiculoCard({ veiculo, onClick }) {
  const status = statusConfig[veiculo.status] || statusConfig.ativo;

  return (
    <Link to={createPageUrl(`VeiculoDetalhes?id=${veiculo.id}`)}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300 cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-800 rounded-xl flex items-center justify-center">
              <Truck className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{veiculo.placa}</h3>
              <p className="text-gray-500 text-sm">{veiculo.marca} {veiculo.modelo}</p>
            </div>
          </div>
          <Badge className={cn("border", status.color)}>
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Gauge className="w-4 h-4" />
              <span>KM Atual</span>
            </div>
            <p className="text-white font-medium">
              {veiculo.km_atual?.toLocaleString('pt-BR')} km
            </p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Wrench className="w-4 h-4" />
              <span>Próx. Manutenção</span>
            </div>
            <p className="text-white font-medium">
              {veiculo.proxima_manutencao_km?.toLocaleString('pt-BR') || '-'} km
            </p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-center text-sm">
          <span className="text-gray-500">{tipoConfig[veiculo.tipo] || veiculo.tipo}</span>
          <span className="text-gray-400">Ano {veiculo.ano}</span>
        </div>
      </div>
    </Link>
  );
}