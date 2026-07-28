import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Package, Link2, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function SecaoOrcamento({ obraId, obra, resumoOrcamento: resumoProp }) {
  // Se o pai já passou o resumo agregado, usar direto; caso contrário buscar localmente
  const { data: orcamentos = [], isLoading } = useQuery({
    queryKey: ['orcamento-obra', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId && !resumoProp,
    staleTime: 30000
  });

  const orcamentoAtivo = orcamentos[0] || null;

  const { data: orcamentoItens = [] } = useQuery({
    queryKey: ['orcamento-itens', orcamentoAtivo?.id],
    queryFn: () => base44.entities.ItemOrcamento.filter({ orcamento_id: orcamentoAtivo.id }),
    enabled: !!orcamentoAtivo?.id && !resumoProp,
    staleTime: 60000
  });

  // BMs APROVADAS para calcular realizado oficial via motor
  const { data: bmsAprovadas = [] } = useQuery({
    queryKey: ['bms-aprovadas-secao', obraId],
    queryFn: () => base44.entities.BM.filter({ obra_id: obraId, status: 'APROVADA' }),
    enabled: !!obraId,
    staleTime: 30000
  });

  // BM RASCUNHO mais recente (preview)
  const { data: bmsRascunho = [] } = useQuery({
    queryKey: ['bms-rascunho-secao', obraId],
    queryFn: () => base44.entities.BM.filter({ obra_id: obraId, status: 'RASCUNHO' }),
    enabled: !!obraId,
    staleTime: 30000
  });

  if (isLoading && !resumoProp) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
        </div>
        <Skeleton className="h-72 bg-gray-50 rounded-xl" />
      </div>);

  }

  // Calcular valores: priorizar resumo agregado se disponível
  let valorOrcado, valorRealizado, totalItens, hasOrcamento, orcamentoId;

  if (resumoProp) {
    valorOrcado = resumoProp.total_orcado || 0;
    valorRealizado = resumoProp.valor_realizado || 0;
    totalItens = resumoProp.total_itens || 0;
    hasOrcamento = resumoProp.hasOrcamento;
    orcamentoId = resumoProp.orcamento_id;
  } else {
    const somaItens = orcamentoItens.reduce((s, i) => s + (i.valor_total || i.custo_total || 0), 0);
    valorOrcado =
    (obra?.total_final_orcamento > 0 ? obra.total_final_orcamento : null) ?? (
    obra?.total_orcamento > 0 ? obra.total_orcamento : null) ?? (
    obra?.valor_orcado > 0 ? obra.valor_orcado : null) ?? (
    orcamentoAtivo?.valor_total > 0 ? orcamentoAtivo.valor_total : null) ?? (
    somaItens > 0 ? somaItens : 0);
    totalItens = orcamentoItens.length;
    hasOrcamento = !!orcamentoAtivo;
    orcamentoId = orcamentoAtivo?.id || null;
  }

  // Valor Realizado oficial = soma total_periodo das BMs APROVADAS (motor)
  const valorRealizadoOficial = bmsAprovadas.reduce((s, b) => s + (b.total_periodo || 0), 0);
  // Acumulado aprovado = última BM aprovada (total_acumulado)
  const ultimaBMAprovada = bmsAprovadas.sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
  const acumuladoOficial = ultimaBMAprovada?.total_acumulado || 0;
  const pctOficial = ultimaBMAprovada?.percent_concluida || 0;

  // Preview do rascunho mais recente
  const ultimaRascunho = bmsRascunho.sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
  const pctPreview = ultimaRascunho?.percent_concluida || null;

  // Usar realizado oficial como valorRealizado quando disponível
  valorRealizado = acumuladoOficial > 0 ? acumuladoOficial : (resumoProp?.valor_realizado || obra?.valor_realizado || 0);

  // TRUNC2
  const trunc2 = (v) => Math.trunc(v * 100) / 100;
  const percentualConsumido = valorOrcado > 0 ? trunc2(valorRealizado / valorOrcado * 100) : 0;
  const semDados = valorOrcado === 0 && valorRealizado === 0;
  // Evita exibir "0,0%" quando há realizado pequeno (> 0 mas < 0,1% do orçado).
  const fmtPctConsumido = () => {
    if (valorOrcado === 0) return '—';
    if (valorRealizado > 0 && percentualConsumido < 0.1) return '<0,1%';
    return `${percentualConsumido.toFixed(1)}%`;
  };

  const chartData = [
  { mes: 'Planejado', orçado: valorOrcado, realizado: 0 },
  { mes: 'Atual', orçado: valorOrcado, realizado: valorRealizado }];


  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Valor Orçado</CardTitle>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{fmt(valorOrcado)}</div>
            {valorOrcado === 0 &&
            <p className="text-xs text-amber-600 mt-1">Sem orçamento definido</p>
            }
            {obra?.importada_orca_facil &&
            <p className="text-xs text-emerald-600 mt-1">✓ OrçaFascio</p>
            }
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Valor Realizado</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{fmt(valorRealizado)}</div>
            {valorRealizado === 0
              ? <p className="text-xs text-gray-500 mt-1">Nenhuma BM aprovada</p>
              : <p className="text-xs text-emerald-600 mt-1">✓ Acumulado oficial ({bmsAprovadas.length} BM(s) aprovada(s))</p>
            }
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">% Consumido</CardTitle>
            <Package className="w-4 h-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {fmtPctConsumido()}
            </div>
            {pctPreview !== null && pctPreview !== pctOficial && (
              <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Preview rascunho: {pctPreview.toFixed(1)}%
              </p>
            )}
            {valorOrcado === 0 &&
              <p className="text-xs text-gray-500 mt-1">Defina um orçamento</p>
            }
          </CardContent>
        </Card>
      </div>

      {/* Gráfico */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Orçado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          {semDados ?
          <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <TrendingUp className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Sem dados de orçamento ainda</p>
              <p className="text-xs mt-1">Importe um orçamento ou crie manualmente</p>
            </div> :

          <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" stroke="#9CA3AF" tick={{ fontSize: 11 }} />
                <YAxis stroke="#9CA3AF" width={44} tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v} />
                <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                formatter={(value) => fmt(value)} />

                <Legend />
                <Line type="monotone" dataKey="orçado" stroke="#3B82F6" strokeWidth={2} name="Orçado" dot={{ r: 5 }} />
                <Line type="monotone" dataKey="realizado" stroke="#10B981" strokeWidth={2} name="Realizado" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          }
        </CardContent>
      </Card>

      {/* Orçamento ativo */}
      <Card className="bg-gray-50 border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-gray-900 text-sm">Orçamento Ativo</CardTitle>
          {orcamentoId &&
          <Link to={createPageUrl(`OrcamentoDetalhes?id=${orcamentoId}`)}>
              <Button size="sm" variant="outline" className="bg-white text-zinc-950 px-3 text-xs font-medium opacity-100 rounded-md inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-gray-50 border-gray-600 h-7 gap-1">
                <Link2 className="w-3 h-3" /> Abrir
              </Button>
            </Link>
          }
        </CardHeader>
        <CardContent>
          {!hasOrcamento ?
          <div className="text-center py-6">
              <p className="text-gray-400 text-sm">Nenhum orçamento cadastrado para esta obra</p>
              <Link to={createPageUrl(`Orcamentos?obra_id=${obraId}`)}>
                <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700 text-xs">
                  Criar Orçamento
                </Button>
              </Link>
            </div> :

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-400">Total Orçado</p>
                <p className="text-base font-semibold text-gray-900 break-words">{fmt(valorOrcado)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Itens</p>
                <p className="text-base font-semibold text-gray-900">{totalItens}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">% Executado</p>
                <p className="text-base font-semibold text-gray-900">
                  {fmtPctConsumido()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Saldo</p>
                <p className={`text-base font-semibold break-words ${valorOrcado - valorRealizado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmt(valorOrcado - valorRealizado)}
                </p>
              </div>
            </div>
          }
        </CardContent>
      </Card>
    </div>);

}