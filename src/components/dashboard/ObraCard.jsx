import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig = {
  planejamento: { label: 'Planejamento', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  em_andamento: { label: 'Em Andamento', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pausada: { label: 'Pausada', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  concluida: { label: 'Concluída', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  cancelada: { label: 'Cancelada', color: 'bg-red-50 text-red-700 border-red-200' }
};

export default function ObraCard({ obra }) {
  const status = statusConfig[obra.status] || statusConfig.planejamento;
  const orcadoVsRealizado = obra.total_orcamento > 0 ?
    (obra.valor_realizado / obra.total_orcamento * 100).toFixed(0) :
    0;

  return (
    <Link
      to={createPageUrl(`ObraDetalhes?id=${obra.id}`)}
      className="bg-white p-6 rounded-2xl block border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all duration-300 group">

      <div className="flex items-start justify-between mb-4">
        <div>
          <Badge className={cn("mb-2 border", status.color)}>
            {status.label}
          </Badge>
          <h3 className="font-semibold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">
            {obra.nome}
          </h3>
          <p className="text-gray-500 text-sm mt-1">{obra.cliente_nome || obra.cliente}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <MapPin className="w-4 h-4" />
          <span>{obra.cidade}, {obra.estado}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
            <div>
              <p className="text-gray-500 text-xs">Início</p>
              <p className="text-gray-700 font-medium">
                {obra.data_inicio ? new Date(obra.data_inicio).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
            <div>
              <p className="text-gray-500 text-xs">Término</p>
              <p className="text-gray-700 font-medium">
                {obra.data_fim_prevista ? new Date(obra.data_fim_prevista).toLocaleDateString('pt-BR') : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Progresso</span>
            <span className="text-gray-900 font-medium">{obra.percentual_concluido || 0}%</span>
          </div>
          <Progress value={obra.percentual_concluido || 0} className="h-2" />
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">Orçamento</p>
            <p className="text-gray-900 font-semibold">
              {(obra.total_orcamento || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{obra.status === 'concluida' ? 'Garantia' : 'Orçado vs Real'}</p>
            <p className={cn(
              "font-semibold text-sm",
              obra.status === 'concluida' ?
                "text-emerald-600" :
                Number(orcadoVsRealizado) > 100 ? "text-red-600" : "text-emerald-600"
            )}>
              {obra.status === 'concluida' ?
                obra.garantia_meses ? `${obra.garantia_meses}m` : 'N/A' :
                `${orcadoVsRealizado}%`
              }
            </p>
          </div>
        </div>
      </div>
    </Link>);

}
