import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, TrendingDown, Clock, FileQuestion, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AlertasInteligentes() {
  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const alertas = useMemo(() => {
    const lista = [];
    const hoje = new Date();
    const proximos7 = new Date(hoje.getTime() + 7 * 24 * 60 * 60 * 1000);
    const proximos30 = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Alertas de vencimento próximo
    const vencimentoProximo = contas.filter(c => 
      c.status === 'pendente' && 
      new Date(c.data_vencimento) <= proximos7 &&
      new Date(c.data_vencimento) > hoje
    );
    if (vencimentoProximo.length > 0) {
      lista.push({
        id: 'vencimento',
        tipo: 'warning',
        titulo: `${vencimentoProximo.length} conta(s) vencendo em 7 dias`,
        valor: vencimentoProximo.reduce((a, c) => a + (c.valor || 0), 0),
        icon: Clock,
        cor: 'text-amber-600'
      });
    }

    // Alertas de contas atrasadas
    const atrasadas = contas.filter(c => c.status === 'atrasado' || (c.status === 'pendente' && new Date(c.data_vencimento) < hoje));
    if (atrasadas.length > 0) {
      lista.push({
        id: 'atrasado',
        tipo: 'error',
        titulo: `${atrasadas.length} conta(s) VENCIDA(S)`,
        valor: atrasadas.reduce((a, c) => a + (c.valor || 0), 0),
        icon: AlertTriangle,
        cor: 'text-red-600'
      });
    }

    // Desvios de despesa - mês atual gasto muito
    const mesDespesa = contas.filter(c => {
      const dataObjeto = new Date(c.data_pagamento || c.data_vencimento);
      return c.status === 'pago' && dataObjeto.getMonth() === hoje.getMonth();
    }).reduce((a, c) => a + (c.valor || 0), 0);
    
    const totalMedio = contas.filter(c => c.status === 'pago').reduce((a, c) => a + (c.valor || 0), 0) / 3; // média de 3 meses
    
    if (mesDespesa > totalMedio * 1.3) {
      lista.push({
        id: 'desvio',
        tipo: 'warning',
        titulo: 'Desvio de despesa detectado',
        subtitulo: `Mês ${((mesDespesa / totalMedio - 1) * 100).toFixed(0)}% acima da média`,
        valor: mesDespesa,
        icon: TrendingDown,
        cor: 'text-amber-600'
      });
    }

    // Fluxo negativo próximos 30 dias
    const proximasEntradas = contas.filter(c => 
      c.tipo === 'receber' && c.status === 'pendente' &&
      new Date(c.data_vencimento) <= proximos30 &&
      new Date(c.data_vencimento) > hoje
    ).reduce((a, c) => a + (c.valor || 0), 0);

    const proximasSaidas = contas.filter(c => 
      c.tipo === 'pagar' && c.status === 'pendente' &&
      new Date(c.data_vencimento) <= proximos30 &&
      new Date(c.data_vencimento) > hoje
    ).reduce((a, c) => a + (c.valor || 0), 0);

    if (proximasSaidas > proximasEntradas && proximasEntradas > 0) {
      lista.push({
        id: 'fluxo',
        tipo: 'warning',
        titulo: 'Fluxo de caixa negativo em 30 dias',
        subtitulo: `Saídas: ${proximasSaidas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} | Entradas: ${proximasEntradas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
        icon: Zap,
        cor: 'text-amber-600'
      });
    }

    return lista;
  }, [contas]);

  if (alertas.length === 0) {
    return (
      <Card className="bg-emerald-50 border border-emerald-200">
        <CardContent className="p-6 text-center">
          <p className="text-emerald-700 font-semibold">Tudo em ordem!</p>
          <p className="text-emerald-600 text-sm">Nenhum alerta financeiro no momento</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {alertas.map(alerta => {
        const Icon = alerta.icon;
        const bgColor = alerta.tipo === 'error' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
        
        return (
          <Card key={alerta.id} className={`border ${bgColor}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${alerta.cor}`} />
                <div className="flex-1 min-w-0">
                  <p className={`font-semibold ${alerta.cor}`}>{alerta.titulo}</p>
                  {alerta.subtitulo && <p className="text-sm text-gray-600 mt-1">{alerta.subtitulo}</p>}
                  {alerta.valor && <p className="text-xs text-gray-500 mt-2">Valor: {alerta.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}