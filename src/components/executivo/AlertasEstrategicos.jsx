import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AlertasEstrategicos({ obras, contas, colaboradores }) {
  const alertas = [];

  // Obras com margem negativa
  obras.forEach(obra => {
    const margem = obra.valor_contrato > 0 
      ? ((obra.valor_contrato - (obra.valor_realizado || 0)) / obra.valor_contrato) * 100 
      : 0;

    if (margem < 5 && obra.status === 'em_andamento') {
      alertas.push({
        tipo: 'critico',
        categoria: 'Margem Crítica',
        titulo: `${obra.nome} - Margem ${margem.toFixed(1)}%`,
        descricao: 'Obra operando com margem muito baixa',
        icone: TrendingDown,
        valor: `${margem.toFixed(1)}%`
      });
    }
  });

  // Obras atrasadas
  const hoje = new Date();
  obras.forEach(obra => {
    if (obra.status === 'em_andamento' && obra.data_prevista_fim) {
      const previsao = new Date(obra.data_prevista_fim);
      const diasAtraso = Math.ceil((hoje - previsao) / (1000 * 60 * 60 * 24));
      
      if (diasAtraso > 0) {
        alertas.push({
          tipo: 'urgente',
          categoria: 'Prazo',
          titulo: `${obra.nome} - ${diasAtraso} dias atrasada`,
          descricao: 'Obra ultrapassou prazo previsto',
          icone: Clock,
          valor: `${diasAtraso}d`
        });
      }
    }
  });

  // Contas críticas
  const contasCriticas = contas.filter(c => {
    if (c.status !== 'pendente') return false;
    const venc = new Date(c.data_vencimento);
    const dias = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
    return dias < 0 && Math.abs(dias) > 30; // Mais de 30 dias atrasado
  });

  if (contasCriticas.length > 0) {
    const totalCritico = contasCriticas.reduce((acc, c) => acc + (c.valor || 0), 0);
    alertas.push({
      tipo: 'critico',
      categoria: 'Financeiro',
      titulo: `${contasCriticas.length} contas críticas`,
      descricao: 'Contas com mais de 30 dias de atraso',
      icone: DollarSign,
      valor: totalCritico.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' })
    });
  }

  // Ordenar por tipo (crítico > urgente > atenção)
  const tipoOrdem = { critico: 1, urgente: 2, atencao: 3 };
  alertas.sort((a, b) => tipoOrdem[a.tipo] - tipoOrdem[b.tipo]);

  const tipoConfig = {
    critico: { 
      bg: 'bg-red-500/10', 
      border: 'border-red-500/20', 
      text: 'text-red-400',
      badge: 'bg-red-500 text-white'
    },
    urgente: { 
      bg: 'bg-amber-500/10', 
      border: 'border-amber-500/20', 
      text: 'text-amber-400',
      badge: 'bg-amber-500 text-gray-900'
    },
    atencao: { 
      bg: 'bg-blue-500/10', 
      border: 'border-blue-500/20', 
      text: 'text-blue-400',
      badge: 'bg-blue-500 text-white'
    }
  };

  if (alertas.length === 0) {
    return (
      <Card className="bg-emerald-500/10 border-emerald-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-emerald-400 font-semibold">Sistema Operando Normalmente</h3>
              <p className="text-gray-400 text-sm">Nenhum alerta crítico identificado</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Alertas Estratégicos
          </CardTitle>
          <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
            {alertas.length} {alertas.length === 1 ? 'alerta' : 'alertas'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alertas.slice(0, 5).map((alerta, idx) => {
          const config = tipoConfig[alerta.tipo];
          const Icon = alerta.icone;

          return (
            <div
              key={idx}
              className={cn(
                "p-4 rounded-xl border",
                config.bg,
                config.border
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", config.bg)}>
                  <Icon className={cn("w-5 h-5", config.text)} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <Badge className={cn("text-xs mb-2", config.badge)}>
                        {alerta.categoria}
                      </Badge>
                      <h4 className={cn("font-semibold", config.text)}>{alerta.titulo}</h4>
                      <p className="text-gray-400 text-sm mt-1">{alerta.descricao}</p>
                    </div>
                    <span className={cn("text-lg font-bold", config.text)}>
                      {alerta.valor}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}