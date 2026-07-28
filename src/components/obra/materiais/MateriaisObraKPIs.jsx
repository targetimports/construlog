import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Package, ClipboardList, Truck, Warehouse } from 'lucide-react';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MateriaisObraKPIs({ obraId }) {
  const { data: necessidades = [] } = useQuery({
    queryKey: ['necessidades-obra-kpi', obraId],
    queryFn: () => base44.entities.NecessidadeMaterialObra.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-obra-kpi', obraId],
    queryFn: () => base44.entities.RequisicaoObra.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  // Buscar LocalEstoque da obra para saldos
  const { data: locais = [] } = useQuery({
    queryKey: ['locais-obra-kpi', obraId],
    queryFn: () => base44.entities.LocalEstoque.filter({ obra_id: obraId, tipo: 'OBRA' }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  const localObraId = locais[0]?.id;

  const { data: saldos = [] } = useQuery({
    queryKey: ['saldos-obra-kpi', localObraId],
    queryFn: () => base44.entities.SaldoEstoque.filter({ local_estoque_id: localObraId }),
    enabled: !!localObraId,
    staleTime: 60000,
  });

  const totalPlanejado = necessidades.length;
  const valorPlanejado = necessidades.reduce((s, n) => s + (n.valor_total_previsto || 0), 0);

  const reqPendentes = requisicoes.filter(r => ['RASCUNHO', 'ENVIADA'].includes(r.status)).length;
  const reqAprovadas = requisicoes.filter(r => r.status === 'APROVADA').length;

  // Requisições já atendidas (material transferido para a obra).
  const atendidas = requisicoes.filter(r => r.status === 'BAIXADA').length;

  const totalEstoque = saldos.reduce((s, sd) => s + (sd.saldo_atual || 0), 0);
  const valorEstoque = saldos.reduce((s, sd) => s + (sd.valor_total_estoque || 0), 0);

  const cards = [
    { label: 'Planejado', value: totalPlanejado, unit: 'itens', sub: valorPlanejado > 0 ? fmtBRL(valorPlanejado) : null, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Solicitado', value: reqPendentes, unit: 'pendentes', sub: reqAprovadas > 0 ? `${reqAprovadas} a atender` : null, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Atendidas', value: atendidas, unit: 'requisições', sub: null, icon: Truck, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Estoque na Obra', value: totalEstoque, unit: 'itens', sub: valorEstoque > 0 ? fmtBRL(valorEstoque) : null, icon: Warehouse, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-wide leading-tight">{c.label}</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${c.bg}`}>
                <Icon className={`w-4 h-4 ${c.color}`} />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className={`text-2xl sm:text-3xl font-bold tabular-nums ${c.color}`}>{c.value}</span>
              <span className="text-xs text-gray-400">{c.unit}</span>
            </div>
            {c.sub && <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5 break-words">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}