import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingDown, TrendingUp, Wallet, AlertCircle, PlusCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CORES_PIE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function SecaoFinanceiro({ obraId, obra, resumoFinanceiro: resumoProp }) {
  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-financeiras-obra', obraId],
    queryFn: () => base44.entities.ContaFinanceira.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
          <Skeleton className="h-28 bg-gray-50 rounded-xl" />
        </div>
        <Skeleton className="h-72 bg-gray-50 rounded-xl" />
      </div>
    );
  }

  // Calcular a partir das contas (sempre fresco). Ignora CANCELADAS — igual às
  // funções canônicas (calcularDREGlobalEmpresa, consolidarFinanceiro...), senão
  // conta cancelada inflava receitas/despesas/% consumido.
  const ativas = contas.filter(c => c.status !== 'cancelado');
  const receitas = ativas.filter(c => c.tipo === 'receber').reduce((acc, c) => acc + (c.valor || 0), 0);
  const despesas = ativas.filter(c => c.tipo === 'pagar').reduce((acc, c) => acc + (c.valor || 0), 0);
  const saldo = receitas - despesas;

  const contasReceberTotal = ativas.filter(c => c.tipo === 'receber').length;
  const contasRecebidas = ativas.filter(c => c.tipo === 'receber' && c.status === 'pago').length;
  const contasPagarTotal = ativas.filter(c => c.tipo === 'pagar').length;
  const contasPagas = ativas.filter(c => c.tipo === 'pagar' && c.status === 'pago').length;

  // Rótulo amigável da categoria (sem underline, com inicial maiúscula).
  const CAT_LABELS = {
    mao_de_obra: 'Mão de obra', material: 'Material', materiais: 'Materiais',
    servico: 'Serviços', servicos: 'Serviços', compras: 'Compras', medicao: 'Medição',
    frota: 'Frota', combustivel: 'Combustível', locacao: 'Locação', aluguel: 'Aluguel',
    nf: 'Nota fiscal', outro: 'Outros', outros: 'Outros',
  };
  const fmtCategoria = (c) => {
    const key = String(c || 'Outros').toLowerCase();
    if (CAT_LABELS[key]) return CAT_LABELS[key];
    const s = String(c || 'Outros').replace(/_/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const despesasPorCategoria = ativas
    .filter(c => c.tipo === 'pagar' && (c.valor || 0) > 0)
    .reduce((acc, c) => {
      const cat = fmtCategoria(c.categoria);
      const ex = acc.find(x => x.name === cat);
      if (ex) { ex.value += c.valor || 0; }
      else { acc.push({ name: cat, value: c.valor || 0 }); }
      return acc;
    }, []);

  // Valor orçado (para comparativo)
  const valorOrcado = obra?.total_final_orcamento || obra?.total_orcamento || obra?.valor_orcado || resumoProp?.total_orcado || 0;
  const percentualConsumido = valorOrcado > 0 ? (despesas / valorOrcado * 100) : 0;

  const semDados = ativas.length === 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total de Receitas</CardTitle>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{fmt(receitas)}</div>
            <p className="text-xs text-gray-400 mt-1">{contasRecebidas}/{contasReceberTotal} recebidas</p>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total de Despesas</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-gray-900 break-words">{fmt(despesas)}</div>
            <p className="text-xs text-gray-400 mt-1">{contasPagas}/{contasPagarTotal} pagas</p>
          </CardContent>
        </Card>

        <Card className={`border-gray-200 ${saldo >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Saldo</CardTitle>
            <Wallet className={`w-4 h-4 ${saldo >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-bold break-words ${saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmt(saldo)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado vazio */}
      {semDados ? (
        <Card className="bg-gray-50 border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm font-medium mb-1">Nenhum lançamento financeiro</p>
            <p className="text-gray-500 text-xs mb-4">Registre contas a pagar e receber para esta obra</p>
            <Link to={createPageUrl(`ContasPagar?obra_id=${obraId}`)}>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1 text-xs">
                <PlusCircle className="w-3 h-3" /> Novo Lançamento
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumo de contas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Contas a Receber
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-gray-400">Total: <span className="text-gray-900 font-semibold">{contasReceberTotal}</span></p>
                <p className="text-gray-400">Recebidas: <span className="text-emerald-600 font-semibold">{contasRecebidas}</span></p>
                <p className="text-gray-400">Pendentes: <span className="text-amber-600 font-semibold">{contasReceberTotal - contasRecebidas}</span></p>
              </CardContent>
            </Card>

            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Contas a Pagar
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-gray-400">Total: <span className="text-gray-900 font-semibold">{contasPagarTotal}</span></p>
                <p className="text-gray-400">Pagas: <span className="text-emerald-600 font-semibold">{contasPagas}</span></p>
                <p className="text-gray-400">Pendentes: <span className="text-red-600 font-semibold">{contasPagarTotal - contasPagas}</span></p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de pizza */}
          {despesasPorCategoria.length > 0 && (
            <Card className="bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-gray-900 text-sm">Distribuição de Despesas por Categoria</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={despesasPorCategoria}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={90}
                      dataKey="value"
                    >
                      {despesasPorCategoria.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, color: '#111827' }}
                      itemStyle={{ color: '#111827' }}
                      labelStyle={{ color: '#111827' }}
                      formatter={(v) => fmt(v)}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Comparativo orçado vs realizado */}
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500" />
                Comparativo Orçado vs Realizado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Orçado</p>
                  <p className="text-base font-semibold text-gray-900 break-words">{fmt(valorOrcado)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Despesas</p>
                  <p className="text-base font-semibold text-gray-900 break-words">{fmt(despesas)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Saldo Restante</p>
                  <p className={`text-base font-semibold break-words ${(valorOrcado - despesas) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmt(valorOrcado - despesas)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">% Consumido</p>
                  <p className="text-base font-semibold text-gray-900">
                    {valorOrcado === 0 ? '0%' : `${percentualConsumido.toFixed(1)}%`}
                  </p>
                </div>
              </div>
              {valorOrcado === 0 && (
                <p className="text-xs text-amber-600 mt-2">Defina um orçamento para calcular o % consumido</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}