import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Calculator, TrendingUp, TrendingDown } from 'lucide-react';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMes = (m) => {
  if (!m || m === 'sem-data') return 'Sem data';
  const [y, mm] = String(m).split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[Number(mm) - 1] || mm}/${y}`;
};

export default function ViabilidadeObra({ obra_id }) {
  const [caixaInicial, setCaixaInicial] = useState(0);
  const [resultado, setResultado] = useState(null);

  const simular = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('simularViabilidadeObra', {
        obra_id,
        caixa_inicial: Number(caixaInicial) || 0,
      });
      setResultado(res.data);
      return res.data;
    },
    onError: (e) => { /* toast no caller */ console.error(e); },
  });

  const r = resultado;

  return (
    <div className="space-y-6">
      {/* Parâmetros */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900 text-base">
            <Calculator className="w-5 h-5 text-blue-600" />
            Viabilidade da Obra (pré-ativação)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs font-medium text-gray-600 mb-1.5 block">Caixa inicial / aporte (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={caixaInicial}
                onChange={(e) => setCaixaInicial(e.target.value)}
                className="h-11"
              />
              <p className="text-xs text-gray-400 mt-1">Saldo de caixa disponível para a obra no início (opcional).</p>
            </div>
            <Button onClick={() => simular.mutate()} disabled={simular.isPending} className="bg-blue-600 hover:bg-blue-700 gap-2 h-11">
              <Calculator className="w-4 h-4" />
              {simular.isPending ? 'Projetando…' : 'Simular Viabilidade'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {r && (
        <>
          {/* Veredito + KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className={`border ${r.pode_ativar ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  {r.pode_ativar
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    : <XCircle className="w-5 h-5 text-red-600" />}
                  <span className="text-xs font-semibold text-gray-500">Resultado</span>
                </div>
                <p className={`text-lg font-bold ${r.pode_ativar ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.pode_ativar ? 'Pode ativar' : 'Não pode ativar'}
                </p>
                <p className="text-xs text-gray-500 mt-1">{r.motivo}</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Mês crítico</p>
                <p className="text-lg font-bold text-gray-900">{r.mes_critico ? fmtMes(r.mes_critico.mes) : '—'}</p>
                <p className={`text-xs mt-1 tabular-nums ${r.mes_critico && r.mes_critico.saldo_acumulado < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {r.mes_critico ? `Saldo: ${fmt(r.mes_critico.saldo_acumulado)}` : 'Sem projeção'}
                </p>
              </CardContent>
            </Card>

            <Card className={`border ${r.valor_necessario_cobrir > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Valor necessário p/ cobrir</p>
                <p className={`text-lg font-bold tabular-nums ${r.valor_necessario_cobrir > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                  {fmt(r.valor_necessario_cobrir)}
                </p>
                <p className="text-xs text-gray-400 mt-1">Aporte para o caixa não ficar negativo.</p>
              </CardContent>
            </Card>

            <Card className="bg-white border-gray-200">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-gray-500 mb-1">Margem projetada</p>
                <p className={`text-lg font-bold tabular-nums ${r.margem_percentual >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {r.margem_percentual.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400 mt-1 tabular-nums">
                  Receb. {fmt(r.total_recebimentos)} · Custo {fmt(r.total_custos)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabela de projeção mensal */}
          <Card className="bg-white border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-base">Fluxo de Caixa Projetado (mês a mês)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {r.meses.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Sem dados para projetar (cadastre recebimentos previstos).</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-500 uppercase bg-gray-50">
                        <th className="px-4 py-3">Mês</th>
                        <th className="px-4 py-3 text-right">Entradas</th>
                        <th className="px-4 py-3 text-right">Saídas</th>
                        <th className="px-4 py-3 text-right">Saldo do mês</th>
                        <th className="px-4 py-3 text-right">Saldo acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.meses.map((m) => {
                        const critico = r.mes_critico && r.mes_critico.mes === m.mes;
                        return (
                          <tr key={m.mes} className={`border-b border-gray-100 ${critico ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                              {fmtMes(m.mes)}
                              {critico && <Badge className="ml-2 bg-red-100 text-red-700 text-[10px]">crítico</Badge>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{m.entradas > 0 ? fmt(m.entradas) : '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums text-red-600">{m.saidas > 0 ? fmt(m.saidas) : '—'}</td>
                            <td className={`px-4 py-3 text-right tabular-nums font-medium ${m.saldo_mes < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                              <span className="inline-flex items-center gap-1 justify-end">
                                {m.saldo_mes < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {fmt(m.saldo_mes)}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right tabular-nums font-bold ${m.saldo_acumulado < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              {fmt(m.saldo_acumulado)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {r.custo_fonte === 'orcamento_uniforme' && (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              Os custos foram distribuídos uniformemente pelo prazo da obra (sem cronograma físico-financeiro nem custos previstos por mês cadastrados). Para maior precisão, importe o cronograma físico-financeiro ou cadastre os custos previstos.
            </div>
          )}
        </>
      )}
    </div>
  );
}
