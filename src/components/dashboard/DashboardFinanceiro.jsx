import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

export default function DashboardFinanceiro() {
  const { data: financeKPIs } = useQuery({
    queryKey: ['finance-kpis-dashboard'],
    queryFn: async () => {
      const periodo = { 
        periodStart: new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0]
      };
      const res = await base44.functions.invoke('getFinanceAdvancedKPIs', periodo).catch(() => ({ data: {} }));
      return res.data;
    },
    staleTime: 300000,
    gcTime: 600000
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiro'],
    queryFn: () => base44.entities.ContaFinanceira?.list?.('-data_vencimento', 20).catch(() => []),
    staleTime: 300000,
    gcTime: 600000
  });

  const contasAtrasadas = contas?.filter(c => {
    const hoje = new Date();
    const venc = new Date(c.data_vencimento);
    return c.status === 'pendente' && venc < hoje;
  })?.length || 0;

  const kpis = financeKPIs?.kpis || {};
  const tesouraria = financeKPIs?.tesouraria || {};
  const saldoConsolidado = kpis.saldoConsolidadoTesouraria ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Financeiro</h1>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 font-semibold">Saldo de Caixa (Consolidado)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${saldoConsolidado >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
              {saldoConsolidado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">{tesouraria.qtdContas || 0} conta(s) ativa(s)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">A Pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">
              {(kpis.aPagarPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">A Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {(kpis.aReceberPendente || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Contas Atrasadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${contasAtrasadas > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {contasAtrasadas}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Contas Atrasadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contas.filter(c => {
            const hoje = new Date();
            const venc = new Date(c.data_vencimento);
            return c.status === 'pendente' && venc < hoje;
          }).slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 bg-red-50 rounded border border-red-200 mb-2">
              <div>
                <p className="font-medium text-gray-900">{c.descricao}</p>
                <p className="text-sm text-gray-600">{c.fornecedor_cliente}</p>
              </div>
              <p className="text-red-600 font-semibold">{c.valor?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}