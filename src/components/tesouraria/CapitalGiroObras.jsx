import React, { useMemo } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, TrendingDown, TrendingUp, Building2, DollarSign, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtK = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000000) return `R$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `R$${(n / 1000).toFixed(0)}k`;
  return `R$${n.toFixed(0)}`;
};

export default function CapitalGiroObras() {
  // Obras ativas
  const { data: obras = [], isLoading: loadObras } = useQuery({
    queryKey: ['obras-capital-giro'],
    queryFn: async () => {
      const all = await base44.entities.Obra.list('-updated_date', 500);
      return all.filter(o => ['em_andamento', 'EM_ANDAMENTO', 'a_iniciar', 'ativa', 'pausada'].includes(o.status));
    }
  });

  // Contas financeiras (pagamentos e recebimentos realizados)
  const { data: contasFinanceiras = [], isLoading: loadContas } = useQuery({
    queryKey: ['contas-financeiras-cg'],
    queryFn: () => base44.entities.ContaFinanceira.list('-updated_date', 5000)
  });

  // Movimentações da tesouraria (pagamentos e recebimentos reais)
  const { data: movimentacoes = [], isLoading: loadMov } = useQuery({
    queryKey: ['movimentacoes-capital-giro'],
    queryFn: () => base44.entities.MovimentacaoTesouraria.list('-data_movimentacao', 5000)
  });

  const analise = useMemo(() => {
    if (!obras.length) return { obras: [], totais: { exposicaoTotal: 0, obrasNegativas: 0, capitalNecessario: 0 } };

    const resultado = obras.map(obra => {
      // Custos pagos (saídas reais da tesouraria vinculadas à obra)
      const saidasObra = movimentacoes
        .filter(m => m.obra_id === obra.id && m.tipo === 'saida')
        .reduce((s, m) => s + (m.valor || 0), 0);

      // Também considerar contas a pagar pagas
      const contasPagas = contasFinanceiras
        .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && c.status === 'pago')
        .reduce((s, c) => s + (c.valor_pago || c.valor || 0), 0);

      const custoRealizado = Math.max(saidasObra, contasPagas);

      // Receita recebida (entradas reais na tesouraria vinculadas à obra)
      const entradasObra = movimentacoes
        .filter(m => m.obra_id === obra.id && m.tipo === 'entrada')
        .reduce((s, m) => s + (m.valor || 0), 0);

      // Contas a receber liquidadas (status 'recebido')
      const contasRecebidas = contasFinanceiras
        .filter(c => c.obra_id === obra.id && c.tipo === 'receber' && c.status === 'recebido')
        .reduce((s, c) => s + (c.valor_recebido || c.valor || 0), 0);

      const receitaRealizada = Math.max(entradasObra, contasRecebidas);

      // Contas a pagar pendentes
      const aPagarPendente = contasFinanceiras
        .filter(c => c.obra_id === obra.id && c.tipo === 'pagar' && (c.status === 'pendente' || c.status === 'aprovado'))
        .reduce((s, c) => s + (c.valor || 0), 0);

      // Contas a receber pendentes
      const aReceberPendente = contasFinanceiras
        .filter(c => c.obra_id === obra.id && c.tipo === 'receber' && c.status === 'pendente')
        .reduce((s, c) => s + (c.valor || 0), 0);

      // Exposição = custo pago - receita recebida (quanto de capital próprio está investido)
      const exposicao = custoRealizado - receitaRealizada;

      // Exposição futura = (custo pago + a pagar) - (receita recebida + a receber)
      const exposicaoFutura = (custoRealizado + aPagarPendente) - (receitaRealizada + aReceberPendente);

      // % de cobertura = receita / custo
      const cobertura = custoRealizado > 0 ? (receitaRealizada / custoRealizado) * 100 : 100;

      const valorContrato = obra.total_final_orcamento || obra.total_orcamento || 0;

      return {
        id: obra.id,
        nome: obra.nome,
        status: obra.status,
        valorContrato,
        custoRealizado,
        receitaRealizada,
        exposicao,
        exposicaoFutura,
        aPagarPendente,
        aReceberPendente,
        cobertura: Math.min(cobertura, 100),
        risco: exposicao > 0 ? (exposicao > valorContrato * 0.3 ? 'alto' : 'medio') : 'baixo'
      };
    });

    // Ordenar por exposição (mais exposta primeiro)
    resultado.sort((a, b) => b.exposicao - a.exposicao);

    const totais = {
      exposicaoTotal: resultado.reduce((s, o) => s + Math.max(o.exposicao, 0), 0),
      obrasNegativas: resultado.filter(o => o.exposicao > 0).length,
      capitalNecessario: resultado.reduce((s, o) => s + Math.max(o.exposicaoFutura, 0), 0),
      totalObras: resultado.length
    };

    return { obras: resultado, totais };
  }, [obras, contasFinanceiras, movimentacoes]);

  const isLoading = loadObras || loadContas || loadMov;

  if (isLoading) {
    return <TableSkeleton rows={6} cols={6} />;
  }

  if (!analise.obras.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>Nenhuma obra ativa encontrada.</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = analise.obras
    .filter(o => o.custoRealizado > 0 || o.receitaRealizada > 0)
    .slice(0, 15)
    .map(o => ({
      nome: o.nome.length > 20 ? o.nome.slice(0, 18) + '…' : o.nome,
      exposicao: o.exposicao,
      nomeCompleto: o.nome
    }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Capital de Giro Investido</p>
                <p title={fmt(analise.totais.exposicaoTotal)} className="text-lg sm:text-2xl font-bold text-blue-700 tabular-nums mt-1 truncate">{fmtCompactBRL(analise.totais.exposicaoTotal)}</p>
                <p className="text-xs text-gray-500 mt-1">Custo pago sem receita correspondente</p>
              </div>
              <div className="p-2 rounded-lg bg-blue-50 flex-shrink-0">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Obras com Exposição</p>
                <p className="text-lg sm:text-2xl font-bold text-amber-700 tabular-nums mt-1">{analise.totais.obrasNegativas} / {analise.totais.totalObras}</p>
                <p className="text-xs text-gray-500 mt-1">Obras financiadas com caixa próprio</p>
              </div>
              <div className="p-2 rounded-lg bg-amber-50 flex-shrink-0">
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">Necessidade Futura</p>
                <p title={fmt(analise.totais.capitalNecessario)} className="text-lg sm:text-2xl font-bold text-red-700 tabular-nums mt-1 truncate">{fmtCompactBRL(analise.totais.capitalNecessario)}</p>
                <p className="text-xs text-gray-500 mt-1">Incluindo contas a pagar pendentes</p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 flex-shrink-0">
                <TrendingDown className="w-4 h-4 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200 shadow-none">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-500">A Receber (Pendente)</p>
                <p title={fmt(analise.obras.reduce((s, o) => s + o.aReceberPendente, 0))} className="text-lg sm:text-2xl font-bold text-green-700 tabular-nums mt-1 truncate">
                  {fmtCompactBRL(analise.obras.reduce((s, o) => s + o.aReceberPendente, 0))}
                </p>
                <p className="text-xs text-gray-500 mt-1">Medições e recebíveis pendentes</p>
              </div>
              <div className="p-2 rounded-lg bg-green-50 flex-shrink-0">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Exposição */}
      {chartData.length > 0 && (
        <Card className="border-gray-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              Exposição Financeira por Obra
            </CardTitle>
            <p className="text-xs text-gray-500">Positivo = capital de giro investido (custo &gt; receita). Negativo = obra cobrindo custos.</p>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={fmtK} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v) => fmt(v)}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.nomeCompleto || ''}
                  />
                  <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="4 4" />
                  <Bar dataKey="exposicao" name="Exposição" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.exposicao > 0 ? '#ef4444' : '#22c55e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela Detalhada */}
      <Card className="border-gray-200 shadow-none">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-gray-900">Detalhamento por Obra</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Cards (mobile) */}
          <div className="md:hidden flex flex-col gap-2 p-2">
            {analise.obras.map(o => (
              <div key={`mc-${o.id}`} className="p-3 rounded-lg border border-gray-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-gray-900 break-words min-w-0" title={o.nome}>{o.nome}</p>
                  {o.risco === 'alto' && <Badge className="bg-red-100 text-red-700 border-0 text-xs shrink-0">ALTO</Badge>}
                  {o.risco === 'medio' && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs shrink-0">MÉDIO</Badge>}
                  {o.risco === 'baixo' && <Badge className="bg-green-100 text-green-700 border-0 text-xs shrink-0">BAIXO</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div><p className="text-xs text-gray-500">Custo Pago</p><p className="font-medium text-red-600 break-words">{fmt(o.custoRealizado)}</p></div>
                  <div><p className="text-xs text-gray-500">Receita Receb.</p><p className="font-medium text-green-600 break-words">{fmt(o.receitaRealizada)}</p></div>
                  <div><p className="text-xs text-gray-500">Exposição</p><p className={`font-bold break-words ${o.exposicao > 0 ? 'text-red-600' : 'text-green-600'}`}>{o.exposicao > 0 ? '+' : ''}{fmt(o.exposicao)}</p></div>
                  <div><p className="text-xs text-gray-500">A Pagar</p><p className="text-orange-600 break-words">{fmt(o.aPagarPendente)}</p></div>
                  <div><p className="text-xs text-gray-500">A Receber</p><p className="text-blue-600 break-words">{fmt(o.aReceberPendente)}</p></div>
                  <div>
                    <p className="text-xs text-gray-500">Cobertura</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${o.cobertura >= 80 ? 'bg-green-500' : o.cobertura >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${o.cobertura}%` }} />
                      </div>
                      <span className="text-xs font-medium">{o.cobertura.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tabela (desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">Custo Pago</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">Receita Recebida</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">Exposição</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">A Pagar</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">A Receber</th>
                  <th className="p-3 text-center text-xs font-semibold text-gray-500">Cobertura</th>
                  <th className="p-3 text-center text-xs font-semibold text-gray-500">Risco</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {analise.obras.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 font-medium max-w-[200px] truncate" title={o.nome}>{o.nome}</td>
                    <td className="p-3 text-right text-red-600 font-medium">{fmt(o.custoRealizado)}</td>
                    <td className="p-3 text-right text-green-600 font-medium">{fmt(o.receitaRealizada)}</td>
                    <td className={`p-3 text-right font-bold ${o.exposicao > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {o.exposicao > 0 ? '+' : ''}{fmt(o.exposicao)}
                    </td>
                    <td className="p-3 text-right text-amber-600">{fmt(o.aPagarPendente)}</td>
                    <td className="p-3 text-right text-blue-600">{fmt(o.aReceberPendente)}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${o.cobertura >= 80 ? 'bg-green-500' : o.cobertura >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${o.cobertura}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{o.cobertura.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {o.risco === 'alto' && <Badge className="bg-red-100 text-red-700 border-0 text-xs">ALTO</Badge>}
                      {o.risco === 'medio' && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">MÉDIO</Badge>}
                      {o.risco === 'baixo' && <Badge className="bg-green-100 text-green-700 border-0 text-xs">BAIXO</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Legenda explicativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">Como interpretar</p>
        <ul className="space-y-1 text-xs text-blue-700">
          <li><strong>Exposição positiva</strong> = obra financiada com capital de giro próprio (custos &gt; receitas recebidas)</li>
          <li><strong>Exposição negativa</strong> = obra já cobriu os custos com receitas recebidas</li>
          <li><strong>Cobertura</strong> = % da receita recebida em relação ao custo pago</li>
          <li><strong>Necessidade Futura</strong> = inclui contas a pagar pendentes ainda não cobertas por recebíveis</li>
        </ul>
      </div>
    </div>
  );
}