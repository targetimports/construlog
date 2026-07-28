import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CalendarDays, TrendingUp } from 'lucide-react';
import { addDays, format, isWithinInterval, parseISO } from 'date-fns';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ProjecaoCaixa3060() {
  const hoje = new Date();

  // Saldo atual
  const { data: contasTesouraria = [], isLoading: loadContas } = useQuery({
    queryKey: ['contas-tesouraria-projecao'],
    queryFn: () => base44.entities.ContaTesouraria.filter({ status: 'ativa' }),
    staleTime: 30000
  });

  // Contas financeiras
  const { data: contasFinanceiras = [], isLoading: loadFin } = useQuery({
    queryKey: ['contas-fin-projecao'],
    queryFn: () => base44.entities.ContaFinanceira.list('-updated_date', 5000),
    staleTime: 30000
  });

  // Recebimentos previstos
  const { data: recebimentos = [], isLoading: loadReceb } = useQuery({
    queryKey: ['receb-previstos-projecao'],
    queryFn: async () => {
      const all = await base44.entities.RecebimentoPrevisto.list('-updated_date', 2000);
      return all.filter(r => r.status === 'PREVISTO' || r.status === 'FATURADO');
    },
    staleTime: 30000
  });

  const projecao = useMemo(() => {
    const saldoAtual = contasTesouraria.reduce((s, c) => s + (c.saldo_atual || 0), 0);
    
    const periodos = [30, 60, 90];
    return periodos.map(dias => {
      const inicio = hoje;
      const fim = addDays(hoje, dias);

      // Saídas previstas (contas a pagar pendentes com vencimento no período)
      const saidas = contasFinanceiras
        .filter(c => {
          if (c.tipo !== 'pagar' || (c.status !== 'pendente' && c.status !== 'aprovado')) return false;
          if (!c.data_vencimento) return false;
          try {
            return isWithinInterval(parseISO(c.data_vencimento), { start: inicio, end: fim });
          } catch { return false; }
        })
        .reduce((s, c) => s + (c.valor || 0), 0);

      // Entradas previstas (contas a receber pendentes + recebimentos previstos)
      const entradasCR = contasFinanceiras
        .filter(c => {
          if (c.tipo !== 'receber' || c.status !== 'pendente') return false;
          if (!c.data_vencimento) return false;
          try {
            return isWithinInterval(parseISO(c.data_vencimento), { start: inicio, end: fim });
          } catch { return false; }
        })
        .reduce((s, c) => s + (c.valor || 0), 0);

      const entradasRP = recebimentos
        .filter(r => {
          if (!r.data_prevista) return false;
          try {
            return isWithinInterval(parseISO(r.data_prevista), { start: inicio, end: fim });
          } catch { return false; }
        })
        .reduce((s, r) => s + (r.valor_previsto || 0), 0);

      const entradas = entradasCR + entradasRP;
      const saldoProjetado = saldoAtual + entradas - saidas;

      return {
        dias,
        label: `${dias} dias`,
        dataFim: format(fim, 'dd/MM/yyyy'),
        entradas,
        saidas,
        saldoProjetado,
        status: saldoProjetado < 0 ? 'critico' : saldoProjetado < saidas * 0.2 ? 'atencao' : 'ok'
      };
    });
  }, [contasTesouraria, contasFinanceiras, recebimentos]);

  const saldoAtual = contasTesouraria.reduce((s, c) => s + (c.saldo_atual || 0), 0);
  const isLoading = loadContas || loadFin || loadReceb;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <Card className="border-gray-200 shadow-none">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          Projeção de Caixa — 30 / 60 / 90 dias
        </CardTitle>
        <p className="text-xs text-gray-500">Saldo atual: {fmt(saldoAtual)}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {projecao.map(p => (
            <div
              key={p.dias}
              className={`p-4 rounded-lg border ${
                p.status === 'critico' ? 'border-red-200 bg-red-50' :
                p.status === 'atencao' ? 'border-amber-200 bg-amber-50' :
                'border-green-200 bg-green-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-lg">{p.label}</span>
                {p.status === 'critico' && (
                  <Badge className="bg-red-100 text-red-800 gap-1 text-xs">
                    <AlertTriangle className="w-3 h-3" /> Déficit
                  </Badge>
                )}
                {p.status === 'atencao' && (
                  <Badge className="bg-amber-100 text-amber-800 text-xs">Atenção</Badge>
                )}
                {p.status === 'ok' && (
                  <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> OK
                  </Badge>
                )}
              </div>

              <p className={`text-2xl font-bold tabular-nums mb-3 ${
                p.saldoProjetado < 0 ? 'text-red-700' : 'text-green-700'
              }`}>
                {fmt(p.saldoProjetado)}
              </p>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600">+ Entradas previstas</span>
                  <span className="text-green-700 font-medium">{fmt(p.entradas)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">− Saídas previstas</span>
                  <span className="text-red-700 font-medium">{fmt(p.saidas)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t mt-1">
                  <span className="text-gray-500">Até {p.dataFim}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}