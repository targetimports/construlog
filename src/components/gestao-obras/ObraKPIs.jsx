import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function ObraKPIs({ metricas }) {
  const kpiCards = [
    {
      label: 'Custo Atual',
      valor: metricas.custoAtual,
      icon: DollarSign,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      label: 'Custo Projetado',
      valor: metricas.custoProjetado,
      icon: Target,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      label: 'Margem Atual',
      valor: `${metricas.margem.toFixed(2)}%`,
      icon: TrendingUp,
      color: metricas.margem > 0 ? 'text-green-600' : 'text-red-600',
      bgColor: metricas.margem > 0 ? 'bg-green-50' : 'bg-red-50'
    },
    {
      label: 'Margem Projetada',
      valor: `${metricas.margemProjetada.toFixed(2)}%`,
      icon: TrendingDown,
      color: metricas.margemProjetada > metricas.margem ? 'text-green-600' : 'text-red-600',
      bgColor: metricas.margemProjetada > metricas.margem ? 'bg-green-50' : 'bg-red-50'
    },
    {
      label: 'Receita Atual',
      valor: metricas.receitaAtual,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Progresso Físico',
      valor: `${metricas.progressoFisico}%`,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpiCards.map((kpi, idx) => {
        const Icon = kpi.icon;
        const isNumeric = typeof kpi.valor === 'number';
        
        return (
          <Card key={idx} className={kpi.bgColor}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">{kpi.label}</p>
                  <p className={`text-2xl font-bold ${kpi.color} mt-2`}>
                    {isNumeric ? kpi.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : kpi.valor}
                  </p>
                </div>
                <Icon className={`w-6 h-6 ${kpi.color} opacity-20`} />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}