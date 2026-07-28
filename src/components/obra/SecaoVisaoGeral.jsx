import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, ClipboardList, FileText, TrendingDown, TrendingUp, Wallet, CircleDollarSign } from 'lucide-react';

// Visão Geral da obra — resumo executivo minimalista.
// Recebe por props dados que o ObraDetalhes JÁ busca (sem queries próprias).
const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function SecaoVisaoGeral({ obra, percentConcluida = 0, ultimaBM, contas = [], diarios = [], onNavigate }) {
  const contrato = obra?.valor_contrato || obra?.valor_orcado || obra?.total_orcamento || 0;
  const realizado = obra?.valor_realizado || 0;
  const pctExec = contrato > 0 ? (realizado / contrato) * 100 : 0;

  const aberto = (c) => c.status !== 'cancelado';
  const receberPendente = contas
    .filter((c) => c.tipo === 'receber' && aberto(c) && c.status !== 'recebido' && c.status !== 'pago')
    .reduce((s, c) => s + (c.valor || 0), 0);
  const pagarPendente = contas
    .filter((c) => c.tipo === 'pagar' && aberto(c) && c.status !== 'pago')
    .reduce((s, c) => s + (c.valor || 0), 0);

  const kpis = [
    { label: 'Valor do Contrato', valor: fmtBRL(contrato), icon: FileText, cor: 'text-gray-900' },
    { label: 'Medido (realizado)', valor: fmtBRL(realizado), sub: contrato > 0 ? `${pctExec.toFixed(1)}% do contrato` : null, icon: CircleDollarSign, cor: 'text-blue-700' },
    { label: 'A Receber (pendente)', valor: fmtBRL(receberPendente), icon: TrendingUp, cor: 'text-emerald-700' },
    { label: 'A Pagar (pendente)', valor: fmtBRL(pagarPendente), icon: TrendingDown, cor: 'text-red-700' },
  ];

  const LinkSecao = ({ secao, children }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onNavigate?.(secao)}
      className="gap-1 text-blue-700 hover:text-blue-800 hover:bg-blue-50 h-8 px-2"
    >
      {children} <ChevronRight className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{k.label}</span>
              </div>
              <p className={`text-lg sm:text-xl font-bold break-words ${k.cor}`}>{k.valor}</p>
              {k.sub && <p className="text-xs text-gray-400 mt-1">{k.sub}</p>}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Última medição */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Última Medição</h3>
            </div>
            <LinkSecao secao="medicoes">Ver medições</LinkSecao>
          </div>
          {ultimaBM ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-700 font-medium">BM {ultimaBM.numero ?? '—'}</span>
                <span className="text-blue-700 font-bold">{(Number(ultimaBM.percent_concluida) || 0).toFixed(1)}% concluída</span>
              </div>
              <p className="text-sm text-gray-500">
                Acumulado: <strong className="text-gray-800">{fmtBRL(ultimaBM.total_acumulado)}</strong>
                {ultimaBM.data_fim ? ` · até ${fmtData(ultimaBM.data_fim)}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nenhuma medição aprovada ainda.</p>
          )}
        </div>

        {/* Período da obra */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-gray-400" />
              <h3 className="font-semibold text-gray-900 text-sm">Contrato & Prazo</h3>
            </div>
            <LinkSecao secao="cronograma">Ver cronograma</LinkSecao>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Período</span>
              <span className="text-gray-800">{fmtData(obra?.data_inicio)}{obra?.data_fim ? ` – ${fmtData(obra.data_fim)}` : ''}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Avanço físico</span>
              <span className="text-gray-800 font-medium">{(Number(percentConcluida) || 0).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Saldo a executar</span>
              <span className="text-gray-800 font-medium">{fmtBRL(Math.max(0, contrato - realizado))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Últimos diários */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <h3 className="font-semibold text-gray-900 text-sm">Últimos Diários de Obra</h3>
          </div>
          <LinkSecao secao="equipe_diario">Ver diário</LinkSecao>
        </div>
        {diarios.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum diário registrado ainda.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {diarios.slice(0, 3).map((d) => (
              <div key={d.id} className="py-2 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{fmtData(d.data)}</span>
                  {d.clima && <span className="text-xs text-gray-400">{d.clima}</span>}
                </div>
                {d.atividades_realizadas && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{d.atividades_realizadas}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
