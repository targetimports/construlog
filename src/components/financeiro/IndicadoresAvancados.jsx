import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Clock, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function IndicadoresAvancados({ obras, contas, contratos, medicoes }) {
  // ROI - Return on Investment
  const obrasComROI = obras.map(obra => {
    const investimento = obra.valor_realizado || 0;
    const retorno = obra.valor_contrato || 0;
    const roi = investimento > 0 ? ((retorno - investimento) / investimento) * 100 : 0;
    return { obra, roi, investimento, retorno };
  }).sort((a, b) => b.roi - a.roi).slice(0, 5);

  // Prazo Médio de Recebimento
  const contasRecebidas = contas.filter(c => c.tipo === 'receber' && c.status === 'pago' && c.data_vencimento && c.data_pagamento);
  const prazoMedioReceb = contasRecebidas.length > 0
    ? contasRecebidas.reduce((acc, c) => {
        const venc = new Date(c.data_vencimento);
        const pag = new Date(c.data_pagamento);
        const dias = Math.ceil((pag - venc) / (1000 * 60 * 60 * 24));
        return acc + dias;
      }, 0) / contasRecebidas.length
    : 0;

  // Prazo Médio de Pagamento
  const contasPagas = contas.filter(c => c.tipo === 'pagar' && c.status === 'pago' && c.data_vencimento && c.data_pagamento);
  const prazoMedioPag = contasPagas.length > 0
    ? contasPagas.reduce((acc, c) => {
        const venc = new Date(c.data_vencimento);
        const pag = new Date(c.data_pagamento);
        const dias = Math.ceil((pag - venc) / (1000 * 60 * 60 * 24));
        return acc + dias;
      }, 0) / contasPagas.length
    : 0;

  // Ciclo Financeiro = PMR - PMP
  const cicloFinanceiro = prazoMedioReceb - prazoMedioPag;

  // Liquidez Corrente
  const totalReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
  const totalPagar = contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente').reduce((acc, c) => acc + (c.valor || 0), 0);
  const liquidezCorrente = totalPagar > 0 ? totalReceber / totalPagar : 0;

  // Taxa de Inadimplência
  const recebiveisVencidos = contas.filter(c => {
    if (c.tipo !== 'receber' || c.status !== 'pendente') return false;
    const venc = new Date(c.data_vencimento);
    return venc < new Date();
  }).length;
  const totalRecebiveis = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente').length;
  const taxaInadimplencia = totalRecebiveis > 0 ? (recebiveisVencidos / totalRecebiveis) * 100 : 0;

  // Eficiência de Medições
  const medicoesAprovadas = medicoes.filter(m => m.status === 'aprovada').length;
  const eficienciaMedicoes = medicoes.length > 0 ? (medicoesAprovadas / medicoes.length) * 100 : 0;

  const indicadores = [
    {
      titulo: 'Liquidez Corrente',
      valor: liquidezCorrente.toFixed(2),
      descricao: 'Capacidade de pagamento',
      icon: DollarSign,
      status: liquidezCorrente >= 1.5 ? 'bom' : liquidezCorrente >= 1 ? 'medio' : 'ruim',
      referencia: 'Ideal: ≥ 1.5'
    },
    {
      titulo: 'Ciclo Financeiro',
      valor: `${Math.abs(cicloFinanceiro).toFixed(0)} dias`,
      descricao: cicloFinanceiro > 0 ? 'Recebe antes de pagar' : 'Paga antes de receber',
      icon: Clock,
      status: cicloFinanceiro <= 0 ? 'bom' : cicloFinanceiro <= 30 ? 'medio' : 'ruim',
      referencia: 'Ideal: ≤ 0 dias'
    },
    {
      titulo: 'Taxa de Inadimplência',
      valor: `${taxaInadimplencia.toFixed(1)}%`,
      descricao: `${recebiveisVencidos} contas vencidas`,
      icon: AlertTriangle,
      status: taxaInadimplencia <= 5 ? 'bom' : taxaInadimplencia <= 15 ? 'medio' : 'ruim',
      referencia: 'Ideal: ≤ 5%'
    },
    {
      titulo: 'Eficiência Medições',
      valor: `${eficienciaMedicoes.toFixed(1)}%`,
      descricao: `${medicoesAprovadas} aprovadas`,
      icon: Target,
      status: eficienciaMedicoes >= 80 ? 'bom' : eficienciaMedicoes >= 60 ? 'medio' : 'ruim',
      referencia: 'Ideal: ≥ 80%'
    }
  ];

  const statusConfig = {
    bom: { bg: 'bg-white', border: 'border-gray-200', text: 'text-emerald-600' },
    medio: { bg: 'bg-white', border: 'border-gray-200', text: 'text-amber-600' },
    ruim: { bg: 'bg-white', border: 'border-gray-200', text: 'text-red-600' }
  };

  return (
    <div className="space-y-6">
      {/* Indicadores Chave */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indicadores.map((ind, idx) => {
          const config = statusConfig[ind.status];
          const Icon = ind.icon;
          
          return (
            <Card key={idx} className={cn("border", config.bg, config.border)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <Icon className={cn("w-6 h-6", config.text)} />
                </div>
                <p className="text-gray-500 text-sm mb-1">{ind.titulo}</p>
                <p className={cn("text-2xl font-bold mb-1", config.text)}>{ind.valor}</p>
                <p className="text-gray-500 text-xs mb-2">{ind.descricao}</p>
                <p className="text-gray-600 text-xs">{ind.referencia}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ROI por Obra */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            ROI - Top 5 Obras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {obrasComROI.map(({ obra, roi, investimento, retorno }) => (
              <div key={obra.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-gray-900 font-medium">{obra.nome}</p>
                  <p className={cn(
                    "text-xl font-bold",
                    roi > 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {roi.toFixed(1)}%
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Investido:</span>
                    <span className="text-gray-900 ml-2">{investimento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Retorno:</span>
                    <span className="text-gray-900 ml-2">{retorno.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}