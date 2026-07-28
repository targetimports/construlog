import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign, Warehouse, Building2, AlertTriangle, Clock,
  Lock, Truck, Package, ShieldCheck
} from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtN = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export default function EstoqueKPIsAvancados({ saldos = [], locais = [] }) {
  const localMap = useMemo(() => {
    const m = {};
    locais.forEach(l => { m[l.id] = l; });
    return m;
  }, [locais]);

  const stats = useMemo(() => {
    let valorTotal = 0, valorCentral = 0, valorObras = 0;
    let qtdReservada = 0, valorReservado = 0;
    let qtdEmTransito = 0, valorEmTransito = 0;
    let qtdDisponivel = 0, valorDisponivel = 0;
    let abaixoMinimo = 0, zerados = 0, parados90 = 0;
    let pontoReposicao = 0;
    let itensTotal = saldos.length;

    const hoje = new Date();

    for (const s of saldos) {
      const local = localMap[s.local_estoque_id];
      const custoMedio = s.custo_unitario_medio || 0;
      const saldoAtual = s.saldo_atual || 0;
      const reservada = s.quantidade_reservada || 0;
      const emTransito = s.quantidade_em_transito || 0;
      const disponivel = Math.max(0, saldoAtual - reservada - emTransito);
      const valor = saldoAtual * custoMedio;

      valorTotal += valor;
      if (local?.tipo === 'CENTRAL') valorCentral += valor;
      else valorObras += valor;

      qtdReservada += reservada;
      valorReservado += reservada * custoMedio;
      qtdEmTransito += emTransito;
      valorEmTransito += emTransito * custoMedio;
      qtdDisponivel += disponivel;
      valorDisponivel += disponivel * custoMedio;

      if ((s.quantidade_minima || 0) > 0 && saldoAtual < (s.quantidade_minima || 0)) abaixoMinimo++;
      if ((s.ponto_reposicao || 0) > 0 && saldoAtual <= (s.ponto_reposicao || 0)) pontoReposicao++;
      if (saldoAtual === 0) zerados++;

      if (s.data_ultima_movimentacao && saldoAtual > 0) {
        const diff = Math.floor((hoje - new Date(s.data_ultima_movimentacao)) / 86400000);
        if (diff >= 90) parados90++;
      }
    }

    return {
      valorTotal, valorCentral, valorObras,
      qtdReservada, valorReservado,
      qtdEmTransito, valorEmTransito,
      qtdDisponivel, valorDisponivel,
      abaixoMinimo, zerados, parados90, pontoReposicao,
      itensTotal
    };
  }, [saldos, localMap]);

  // Enxugado para os 4 KPIs essenciais (o detalhamento — Central/Obras/Reservado/
  // Parado — vive dentro da aba Análises/Dashboard).
  const cards = [
    { label: 'Valor Total', valor: fmt(stats.valorTotal), sub: `${stats.itensTotal} itens`, icon: DollarSign, color: 'blue' },
    { label: 'Disponível', valor: fmt(stats.valorDisponivel), sub: `${fmtN(stats.qtdDisponivel)} un`, icon: ShieldCheck, color: 'emerald' },
    { label: 'Ruptura / Baixo', valor: stats.abaixoMinimo + stats.zerados, sub: `${stats.abaixoMinimo} baixo + ${stats.zerados} zero`, icon: AlertTriangle, color: stats.abaixoMinimo > 0 ? 'amber' : 'gray' },
    { label: 'Em Trânsito', valor: fmt(stats.valorEmTransito), sub: `${fmtN(stats.qtdEmTransito)} un`, icon: Truck, color: 'cyan' },
  ];

  const iconColorMap = {
    blue: 'text-blue-600', indigo: 'text-indigo-600', green: 'text-green-600',
    emerald: 'text-emerald-600', orange: 'text-orange-600', cyan: 'text-cyan-600',
    amber: 'text-amber-600', purple: 'text-purple-600', gray: 'text-gray-400',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className="bg-white border-gray-200">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${iconColorMap[c.color]}`} />
                <span className="text-xs text-gray-500 font-semibold">{c.label}</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{c.valor}</p>
              {c.sub && <p className="text-xs text-gray-500">{c.sub}</p>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}