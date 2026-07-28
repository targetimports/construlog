import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, Calendar, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AlertasIA() {
  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: materiais = [] } = useQuery({
    queryKey: ['materiais'],
    queryFn: () => base44.entities.Material.list()
  });

  // Detectar obras com risco de estouro
  const obrasRisco = obras.filter(o => {
    if (o.status !== 'em_andamento') return false;
    const percentualGasto = o.valor_orcado > 0 ? (o.valor_realizado / o.valor_orcado) * 100 : 0;
    const percentualConcluido = o.percentual_concluido || 0;
    // Risco se gastou mais que executou (com margem de 10%)
    return percentualGasto > percentualConcluido + 10;
  });

  // Detectar contas atrasadas
  const contasAtrasadas = contas.filter(c => {
    if (c.status !== 'pendente') return false;
    return new Date(c.data_vencimento) < new Date();
  });

  // Materiais com estoque baixo
  const materiaisBaixos = materiais.filter(m => 
    m.estoque_atual <= m.estoque_minimo && m.estoque_minimo > 0
  );

  const alertas = [
    ...obrasRisco.slice(0, 3).map(o => ({
      tipo: 'risco_orcamento',
      titulo: 'Risco de Estouro de Orçamento',
      descricao: `${o.nome} - Custo acima do cronograma`,
      severidade: 'alta',
      icon: TrendingDown
    })),
    ...contasAtrasadas.slice(0, 2).map(c => ({
      tipo: 'conta_atrasada',
      titulo: 'Conta Vencida',
      descricao: `${c.descricao} - Vencida em ${new Date(c.data_vencimento).toLocaleDateString('pt-BR')}`,
      severidade: 'media',
      icon: Calendar
    })),
    ...materiaisBaixos.slice(0, 2).map(m => ({
      tipo: 'estoque_baixo',
      titulo: 'Estoque Crítico',
      descricao: `${m.nome} - ${m.estoque_atual} ${m.unidade} (mín: ${m.estoque_minimo})`,
      severidade: 'media',
      icon: Package
    }))
  ];

  if (alertas.length === 0) return null;

  const severidadeConfig = {
    alta: { color: 'bg-red-500/10 border-red-500/20', iconColor: 'text-red-400' },
    media: { color: 'bg-amber-500/10 border-amber-500/20', iconColor: 'text-amber-400' },
    baixa: { color: 'bg-blue-500/10 border-blue-500/20', iconColor: 'text-blue-400' }
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Alertas Inteligentes ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alertas.map((alerta, idx) => {
            const Icon = alerta.icon;
            const config = severidadeConfig[alerta.severidade];
            
            return (
              <div key={idx} className={cn("flex items-start gap-3 p-4 rounded-xl border", config.color)}>
                <Icon className={cn("w-5 h-5 mt-0.5 flex-shrink-0", config.iconColor)} />
                <div className="flex-1">
                  <p className="text-white font-medium mb-1">{alerta.titulo}</p>
                  <p className="text-gray-400 text-sm">{alerta.descricao}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}