import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function BoletosKPIs({ boletos }) {
  const hoje = new Date().toISOString().split('T')[0];
  const em7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  const abertos = boletos.filter(b => b.status === 'ABERTO' || b.status === 'RASCUNHO');
  const totalAberto = abertos.reduce((s, b) => s + (b.valor || 0), 0);

  const vencidos = abertos.filter(b => b.data_vencimento < hoje);
  const totalVencido = vencidos.reduce((s, b) => s + (b.valor || 0), 0);

  const vencem7d = abertos.filter(b => b.data_vencimento >= hoje && b.data_vencimento <= em7dias);

  const pagos = boletos.filter(b => b.status === 'PAGO');
  const totalPago = pagos.reduce((s, b) => s + (b.valor_pago || b.valor || 0), 0);

  const cards = [
    { label: 'Total a Pagar', valor: fmt(totalAberto), icon: DollarSign, color: 'text-blue-600', count: `${abertos.length} boleto(s)` },
    { label: 'Vencidos', valor: fmt(totalVencido), icon: AlertTriangle, color: 'text-red-600', count: `${vencidos.length} boleto(s)` },
    { label: 'Vencem em 7 dias', valor: fmt(vencem7d.reduce((s, b) => s + (b.valor || 0), 0)), icon: Clock, color: 'text-amber-600', count: `${vencem7d.length} boleto(s)` },
    { label: 'Pagos', valor: fmt(totalPago), icon: CheckCircle2, color: 'text-green-600', count: `${pagos.length} boleto(s)` }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c, i) => (
        <Card key={i} className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.valor}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.count}</p>
              </div>
              <c.icon className={`w-8 h-8 ${c.color} opacity-30`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}