import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const COLORS_ABC = { A: '#ef4444', B: '#f59e0b', C: '#22c55e' };
const PIE_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function EstoqueGraficosAvancados({ saldos = [], locais = [] }) {
  const localMap = useMemo(() => {
    const m = {};
    locais.forEach(l => { m[l.id] = l; });
    return m;
  }, [locais]);

  // Curva ABC — calculada dinamicamente (Pareto por valor): A = primeiros 80%
  // do valor acumulado, B = até 95%, C = restante. Não depende de campo salvo.
  const curvaABC = useMemo(() => {
    const itens = saldos
      .map(s => (s.saldo_atual || 0) * (s.custo_unitario_medio || 0))
      .filter(v => v > 0)
      .sort((a, b) => b - a);
    const total = itens.reduce((s, v) => s + v, 0);
    if (total === 0) return [];

    const contagem = { A: 0, B: 0, C: 0 };
    const valores = { A: 0, B: 0, C: 0 };
    let acum = 0;
    for (const v of itens) {
      acum += v;
      const pct = acum / total;
      const classe = pct <= 0.8 ? 'A' : pct <= 0.95 ? 'B' : 'C';
      contagem[classe]++;
      valores[classe] += v;
    }
    return [
      { name: 'Curva A', qtd: contagem.A, valor: valores.A, fill: COLORS_ABC.A },
      { name: 'Curva B', qtd: contagem.B, valor: valores.B, fill: COLORS_ABC.B },
      { name: 'Curva C', qtd: contagem.C, valor: valores.C, fill: COLORS_ABC.C },
    ].filter(d => d.qtd > 0);
  }, [saldos]);

  // Distribuição Central x Obras
  const distribuicao = useMemo(() => {
    const porLocal = {};
    for (const s of saldos) {
      const local = localMap[s.local_estoque_id];
      if (!local) continue;
      const nome = local.nome || 'Desconhecido';
      if (!porLocal[nome]) porLocal[nome] = { nome, valor: 0 };
      porLocal[nome].valor += (s.saldo_atual || 0) * (s.custo_unitario_medio || 0);
    }
    return Object.values(porLocal).sort((a, b) => b.valor - a.valor).slice(0, 10);
  }, [saldos, localMap]);

  // Status breakdown
  const statusBreakdown = useMemo(() => {
    const counts = { OK: 0, ALERTA: 0, CRITICO: 0, RUPTURA: 0, PARADO: 0 };
    for (const s of saldos) {
      const saldo = s.saldo_atual || 0;
      if (saldo === 0) counts.RUPTURA++;
      else if ((s.quantidade_minima || 0) > 0 && saldo < s.quantidade_minima) counts.CRITICO++;
      else if ((s.ponto_reposicao || 0) > 0 && saldo <= s.ponto_reposicao) counts.ALERTA++;
      else counts.OK++;
    }
    return [
      { name: 'OK', value: counts.OK, fill: '#22c55e' },
      { name: 'Alerta', value: counts.ALERTA, fill: '#f59e0b' },
      { name: 'Crítico', value: counts.CRITICO, fill: '#ef4444' },
      { name: 'Ruptura', value: counts.RUPTURA, fill: '#991b1b' },
    ].filter(d => d.value > 0);
  }, [saldos]);

  const semDados = curvaABC.length === 0 && statusBreakdown.length === 0 && distribuicao.length === 0;
  if (semDados) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="py-12 text-center">
          <p className="text-gray-900 font-medium">Sem dados para relatórios</p>
          <p className="text-sm text-gray-500 mt-1">Cadastre saldos de estoque para visualizar os gráficos.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Curva ABC */}
      {curvaABC.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Curva ABC — Valor em Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={curvaABC}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="valor" name="Valor" radius={[4, 4, 0, 0]}>
                    {curvaABC.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-600">
              {curvaABC.map(c => (
                <span key={c.name}><span className="font-semibold">{c.name}:</span> {c.qtd} itens</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status */}
      {statusBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Status dos Itens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="70%" height="100%">
                <PieChart>
                  <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                    {statusBreakdown.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                  <Tooltip formatter={v => `${v} itens`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Locais por Valor */}
      {distribuicao.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Valor em Estoque por Almoxarifado (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribuicao} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Bar dataKey="valor" name="Valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}