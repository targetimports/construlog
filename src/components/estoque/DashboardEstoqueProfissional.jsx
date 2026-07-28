import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Warehouse, AlertTriangle, DollarSign, Clock, Building2, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { differenceInDays } from 'date-fns';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DashboardEstoqueProfissional() {
  const { data: locais = [], isLoading: loadLoc } = useQuery({
    queryKey: ['local-estoque'],
    queryFn: () => base44.entities.LocalEstoque.list('-created_date', 500),
    staleTime: 60000
  });

  const { data: saldos = [], isLoading: loadSaldos } = useQuery({
    queryKey: ['saldos-estoque-dash'],
    queryFn: () => base44.entities.SaldoEstoque.list('-updated_date', 5000),
    staleTime: 30000
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras-estoque-dash'],
    queryFn: () => base44.entities.Obra.list('-updated_date', 1000),
    staleTime: 60000
  });

  const localMap = useMemo(() => {
    const m = {};
    locais.forEach(l => { m[l.id] = l; });
    return m;
  }, [locais]);

  const obraMap = useMemo(() => {
    const m = {};
    obras.forEach(o => { m[o.id] = o; });
    return m;
  }, [obras]);

  const stats = useMemo(() => {
    const hoje = new Date();

    // Classificar saldos por tipo de local
    let valorCentral = 0, valorObras = 0, qtdCentral = 0, qtdObras = 0;
    let abaixoMinimo = 0, zerados = 0, parados90dias = 0;
    const consumoPorObra = {};
    const valorPorObra = {};

    for (const s of saldos) {
      const local = localMap[s.local_estoque_id];
      if (!local) continue;

      const valor = s.valor_total_estoque || (s.saldo_atual || 0) * (s.custo_unitario_medio || 0);

      if (local.tipo === 'CENTRAL') {
        valorCentral += valor;
        qtdCentral++;
      } else {
        valorObras += valor;
        qtdObras++;

        // Agrupar por obra
        if (local.obra_id) {
          if (!valorPorObra[local.obra_id]) {
            valorPorObra[local.obra_id] = { valor: 0, itens: 0, nome: local.obra_nome || obraMap[local.obra_id]?.nome || 'Obra' };
          }
          valorPorObra[local.obra_id].valor += valor;
          valorPorObra[local.obra_id].itens++;
        }
      }

      // Alertas
      if ((s.quantidade_minima || 0) > 0 && (s.saldo_atual || 0) < (s.quantidade_minima || 0)) {
        abaixoMinimo++;
      }
      if ((s.saldo_atual || 0) === 0) {
        zerados++;
      }

      // Material parado (90+ dias sem movimentação)
      if (s.data_ultima_movimentacao && (s.saldo_atual || 0) > 0) {
        const dias = differenceInDays(hoje, new Date(s.data_ultima_movimentacao));
        if (dias >= 90) parados90dias++;
      }
    }

    const centrais = locais.filter(l => l.tipo === 'CENTRAL' && l.ativo !== false).length;
    const obrasAlmox = locais.filter(l => l.tipo === 'OBRA' && l.ativo !== false).length;

    // Top obras por valor
    const topObras = Object.entries(valorPorObra)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    return {
      valorCentral, valorObras, qtdCentral, qtdObras,
      abaixoMinimo, zerados, parados90dias,
      centrais, obrasAlmox,
      valorTotal: valorCentral + valorObras,
      topObras
    };
  }, [saldos, locais, localMap, obraMap]);

  const isLoading = loadLoc || loadSaldos;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  const pieData = [
    { name: 'Central', value: stats.valorCentral, fill: '#3b82f6' },
    { name: 'Obras', value: stats.valorObras, fill: '#22c55e' }
  ].filter(d => d.value > 0);

  const chartObras = stats.topObras.map(o => ({
    nome: o.nome.length > 18 ? o.nome.slice(0, 16) + '…' : o.nome,
    valor: o.valor,
    nomeCompleto: o.nome
  }));

  return (
    <div className="space-y-6">
      {/* KPIs Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-500 font-semibold">Valor Total</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{fmt(stats.valorTotal)}</p>
            <p className="text-xs text-gray-500">{saldos.length} itens</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Warehouse className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-gray-500 font-semibold">Estoque Central</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{fmt(stats.valorCentral)}</p>
            <p className="text-xs text-gray-500">{stats.centrais} almoxarifado(s) · {stats.qtdCentral} itens</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-500 font-semibold">Estoque nas Obras</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 break-words">{fmt(stats.valorObras)}</p>
            <p className="text-xs text-gray-500">{stats.obrasAlmox} almox obra · {stats.qtdObras} itens</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`w-4 h-4 ${stats.abaixoMinimo > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-500 font-semibold">Ruptura / Baixo</span>
            </div>
            <p className={`text-xl font-bold ${stats.abaixoMinimo > 0 ? 'text-amber-700' : 'text-gray-600'}`}>
              {stats.abaixoMinimo + stats.zerados}
            </p>
            <p className="text-xs text-gray-500">{stats.abaixoMinimo} baixo + {stats.zerados} zerado</p>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className={`w-4 h-4 ${stats.parados90dias > 0 ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className="text-xs text-gray-500 font-semibold">Material Parado</span>
            </div>
            <p className={`text-xl font-bold ${stats.parados90dias > 0 ? 'text-purple-700' : 'text-gray-600'}`}>
              {stats.parados90dias}
            </p>
            <p className="text-xs text-gray-500">90+ dias sem movimento</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Distribuição Central x Obra */}
        {pieData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Valor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56 flex items-center justify-center gap-4 sm:gap-8">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Central</p>
                      <p className="text-xs text-gray-500">{fmt(stats.valorCentral)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-medium">Obras</p>
                      <p className="text-xs text-gray-500">{fmt(stats.valorObras)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top obras */}
        {chartObras.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valor em Estoque por Obra</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartObras} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="nome" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(v) => fmt(v)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.nomeCompleto || ''}
                    />
                    <Bar dataKey="valor" name="Valor" fill="#22c55e" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Alertas de estoque baixo */}
      {stats.abaixoMinimo > 0 && (
        <AlertasEstoqueBaixoCard saldos={saldos} localMap={localMap} />
      )}

    </div>
  );
}

function AlertasEstoqueBaixoCard({ saldos, localMap }) {
  const alertas = useMemo(() => {
    return saldos
      .filter(s => (s.quantidade_minima || 0) > 0 && (s.saldo_atual || 0) < (s.quantidade_minima || 0))
      .sort((a, b) => (a.saldo_atual / a.quantidade_minima) - (b.saldo_atual / b.quantidade_minima))
      .slice(0, 10);
  }, [saldos]);

  if (alertas.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          Materiais Abaixo do Mínimo ({alertas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="md:border md:border-gray-200 md:rounded-lg">
          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-y-2">
            {alertas.map(s => {
              const local = localMap[s.local_estoque_id];
              const pct = s.quantidade_minima > 0 ? ((s.saldo_atual / s.quantidade_minima) * 100) : 0;
              return (
                <div key={s.id} className="p-3 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm break-words">{s.material_nome || s.material_id}</p>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">
                        {local?.nome || '—'}
                        <span className="text-[10px] text-gray-400 ml-1">{local?.tipo === 'CENTRAL' ? 'Central' : 'Obra'}</span>
                      </p>
                    </div>
                    <div className="shrink-0">
                      {(s.saldo_atual || 0) === 0 ? (
                        <Badge className="bg-red-100 text-red-700 border-0 text-xs">RUPTURA</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                          {pct.toFixed(0)}% do mín
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    <span className="text-gray-500">Saldo: <span className="font-semibold text-red-600">{fmtN(s.saldo_atual)}</span></span>
                    <span className="text-gray-500">Mínimo: <span className="font-medium text-gray-700">{fmtN(s.quantidade_minima)}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
          {/* Tabela desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500">Local</th>
                  <th className="p-3 text-left text-xs font-semibold text-gray-500">Material</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">Saldo</th>
                  <th className="p-3 text-right text-xs font-semibold text-gray-500">Mínimo</th>
                  <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alertas.map(s => {
                  const local = localMap[s.local_estoque_id];
                  const pct = s.quantidade_minima > 0 ? ((s.saldo_atual / s.quantidade_minima) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="p-3 text-xs">
                        <span className="text-gray-700">{local?.nome || '—'}</span>
                        <span className="text-[10px] text-gray-400 ml-1">{local?.tipo === 'CENTRAL' ? 'Central' : 'Obra'}</span>
                      </td>
                      <td className="p-3 font-medium text-gray-900">{s.material_nome || s.material_id}</td>
                      <td className="p-3 text-right font-semibold text-red-600">{fmtN(s.saldo_atual)}</td>
                      <td className="p-3 text-right text-gray-600">{fmtN(s.quantidade_minima)}</td>
                      <td className="p-3 text-center">
                        {(s.saldo_atual || 0) === 0 ? (
                          <Badge className="bg-red-100 text-red-700 border-0 text-xs">RUPTURA</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                            {pct.toFixed(0)}% do mín
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}