import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function CardManutencao({ manutencao }) {
  const statusConfig = {
    agendada: { color: 'bg-blue-500/10 text-blue-400', label: 'Agendada', icon: Calendar },
    em_execucao: { color: 'bg-amber-500/10 text-amber-400', label: 'Em Execução', icon: AlertTriangle },
    concluida: { color: 'bg-emerald-500/10 text-emerald-400', label: 'Concluída', icon: CheckCircle2 },
    cancelada: { color: 'bg-gray-500/10 text-gray-400', label: 'Cancelada', icon: AlertTriangle }
  };

  const config = statusConfig[manutencao.status];
  const Icon = config.icon;

  const dataRelevante = manutencao.data_execucao || manutencao.data_agendamento;
  const diasRestantes = manutencao.status === 'agendada' 
    ? Math.ceil((new Date(manutencao.data_agendamento) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge className={config.color}>{config.label}</Badge>
            <Badge variant="outline" className="border-gray-700 text-gray-400">
              {manutencao.tipo === 'preventiva' ? '' : ''} {manutencao.tipo}
            </Badge>
          </div>
          {manutencao.tipo === 'preventiva' && manutencao.km_proximo && (
            <Badge className="bg-purple-500/10 text-purple-400">
              {manutencao.km_proximo} km
            </Badge>
          )}
        </div>

        <h4 className="text-white font-medium text-sm mb-1">{manutencao.descricao}</h4>
        
        <div className="text-xs text-gray-500 space-y-1">
          <div>Categoria: {manutencao.categoria}</div>
          {dataRelevante && (
            <div>
              {manutencao.status === 'agendada' 
                ? `Agendada para: ${new Date(dataRelevante).toLocaleDateString('pt-BR')}`
                : `Executada em: ${new Date(dataRelevante).toLocaleDateString('pt-BR')}`
              }
            </div>
          )}
          {diasRestantes !== null && (
            <div className={diasRestantes <= 7 ? 'text-amber-400' : ''}>
              {diasRestantes > 0 ? `Faltam ${diasRestantes} dia(s)` : 'Vencida'}
            </div>
          )}
        </div>

        {(manutencao.custo_estimado || manutencao.custo_real) && (
          <div className="mt-2 text-xs text-gray-400">
            {manutencao.custo_real 
              ? `Custo: R$ ${manutencao.custo_real.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              : `Estimado: R$ ${manutencao.custo_estimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '-'}`
            }
          </div>
        )}
      </CardContent>
    </Card>
  );
}