import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, TrendingDown, DollarSign, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CustoPrevistoForm from './CustoPrevistoForm';

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const num = (v) => Number(v) || 0;

const STATUS_CONFIG = {
  PREVISTO:     { label: 'Previsto',     cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  COMPROMETIDO: { label: 'Comprometido', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  PAGO:         { label: 'Pago',         cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELADO:    { label: 'Cancelado',    cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const CAT_LABELS = {
  material: 'Material', mao_de_obra: 'Mão de obra', servico: 'Serviços',
  equipamento: 'Equipamentos', locacao: 'Locação', frota: 'Frota', outro: 'Outros',
};
const catLabel = (c) => CAT_LABELS[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Outros');

export default function CustosPrevistoTab({ obraId, podeEditar = true }) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState(null);

  const { data: custos = [], isLoading } = useQuery({
    queryKey: ['custos-previstos', obraId],
    queryFn: () => base44.entities.PlannedCostItem.filter({ obra_id: obraId }, 'data_prevista'),
    enabled: !!obraId,
  });

  // Realizado (Centro de Custos): lançamentos + diárias aprovadas.
  const { data: realizado = 0 } = useQuery({
    queryKey: ['custos-realizado-resumo', obraId],
    queryFn: async () => {
      const [lcs, aps] = await Promise.all([
        base44.entities.LancamentoCustoObra.filter({ obra_id: obraId }, '-data_lancamento', 5000).catch(() => []),
        base44.entities.ApontamentoMaoObra.filter({ obra_id: obraId, status: 'APROVADO' }, '-data', 5000).catch(() => []),
      ]);
      const totalLanc = (lcs || []).reduce((s, l) => s + num(l.valor), 0);
      const totalAp = (aps || []).reduce((s, a) => s + num(a.total ?? a.valor_diaria), 0);
      // Evita dupla contagem: se já há lançamento de mão de obra, não soma apontamento.
      const temMoLanc = (lcs || []).some((l) => String(l.categoria || '').toLowerCase() === 'mao_de_obra');
      return totalLanc + (temMoLanc ? 0 : totalAp);
    },
    enabled: !!obraId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PlannedCostItem.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-previstos', obraId] });
      queryClient.invalidateQueries({ queryKey: ['viabilidade-obra', obraId] });
      toast.success('Removido!');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const totais = useMemo(() => {
    const ativos = custos.filter((c) => c.status !== 'CANCELADO');
    const valorDe = (c) => num(c.valor_previsto ?? c.valor_estimado);
    const totalPrevisto = ativos.reduce((s, c) => s + valorDe(c), 0);
    const comprometido = ativos.filter((c) => c.status === 'COMPROMETIDO').reduce((s, c) => s + valorDe(c), 0);
    const pago = ativos.filter((c) => c.status === 'PAGO').reduce((s, c) => s + valorDe(c), 0);
    const desvio = realizado - totalPrevisto;
    return { totalPrevisto, comprometido, pago, desvio };
  }, [custos, realizado]);

  const handleNovo = () => { setEditando(null); setFormOpen(true); };
  const handleEditar = (c) => { setEditando(c); setFormOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-gray-900">Custos Previstos</h2>
          <p className="text-gray-500 text-sm mt-1 hidden sm:block">Planejamento das saídas por categoria, etapa e data</p>
        </div>
        {podeEditar && (
          <Button onClick={handleNovo} className="bg-blue-600 hover:bg-blue-700 gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Novo</span>
            <span className="hidden sm:inline">Novo Custo Previsto</span>
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 min-w-0">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2"><TrendingDown className="w-4 h-4 text-gray-600" /><span className="text-xs text-gray-500 font-semibold">Total Previsto</span></div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(totais.totalPrevisto)}</span>
              <span className="hidden sm:inline">{fmt(totais.totalPrevisto)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-amber-500" /><span className="text-xs text-gray-500 font-semibold">Comprometido</span></div>
            <p className="text-lg sm:text-xl font-bold text-amber-600 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(totais.comprometido)}</span>
              <span className="hidden sm:inline">{fmt(totais.comprometido)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-600" /><span className="text-xs text-gray-500 font-semibold">Realizado (Centro de Custos)</span></div>
            <p className="text-lg sm:text-xl font-bold text-emerald-600 tabular-nums truncate">
              <span className="sm:hidden">{fmtCompact(realizado)}</span>
              <span className="hidden sm:inline">{fmt(realizado)}</span>
            </p>
          </CardContent>
        </Card>
        <Card className={`border ${totais.desvio > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-2"><AlertTriangle className={`w-4 h-4 ${totais.desvio > 0 ? 'text-red-600' : 'text-gray-500'}`} /><span className="text-xs text-gray-500 font-semibold">Desvio (real − previsto)</span></div>
            <p className={`text-lg sm:text-xl font-bold tabular-nums truncate ${totais.desvio > 0 ? 'text-red-600' : 'text-gray-900'}`}>
              <span className="sm:hidden">{totais.desvio > 0 ? '+' : ''}{fmtCompact(totais.desvio)}</span>
              <span className="hidden sm:inline">{totais.desvio > 0 ? '+' : ''}{fmt(totais.desvio)}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900 text-base">Custos Planejados ({custos.length} registros)</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />)}</div>
          ) : custos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum custo previsto cadastrado</p>
              <p className="text-xs mt-1 text-gray-500">Clique em "Novo Custo Previsto" para planejar as saídas da obra.</p>
            </div>
          ) : (
            <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {custos.map((c) => {
                const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.PREVISTO;
                const atrasado = c.status !== 'PAGO' && c.status !== 'CANCELADO' && c.data_prevista && isPast(parseISO(c.data_prevista));
                return (
                  <div key={c.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-gray-900 font-medium break-words">{c.descricao}</p>
                        {c.observacao && <p className="text-xs text-gray-500 mt-0.5">{c.observacao}</p>}
                      </div>
                      <span className="text-gray-900 font-semibold tabular-nums whitespace-nowrap shrink-0">{fmt(c.valor_previsto ?? c.valor_estimado)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                      <Badge className={`${st.cls} text-xs border`}>{st.label}</Badge>
                      <span className="text-gray-600">{catLabel(c.categoria)}</span>
                      {c.etapa && <span className="text-gray-500">{c.etapa}</span>}
                      <span className={atrasado ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {c.data_prevista ? format(parseISO(c.data_prevista), 'dd MMM yyyy', { locale: ptBR }) : '—'}
                        {atrasado && ' (vencido)'}
                      </span>
                    </div>
                    <div className="flex gap-1 justify-end mt-1">
                      {podeEditar && (<>
                        <Button size="icon" variant="ghost" onClick={() => handleEditar(c)} className="text-gray-600 hover:text-gray-900 p-2 h-9 w-9"><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(c.id)} className="text-red-600 hover:text-red-700 p-2 h-9 w-9" disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                      </>)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Descrição</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Categoria</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Etapa</th>
                    <th className="px-3 py-3 text-left text-gray-500 font-semibold">Data Prevista</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Valor Previsto</th>
                    <th className="px-3 py-3 text-center text-gray-500 font-semibold">Status</th>
                    <th className="px-3 py-3 text-right text-gray-500 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {custos.map((c) => {
                    const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.PREVISTO;
                    const atrasado = c.status !== 'PAGO' && c.status !== 'CANCELADO' && c.data_prevista && isPast(parseISO(c.data_prevista));
                    return (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-3">
                          <span className="text-gray-900 font-medium">{c.descricao}</span>
                          {c.observacao && <p className="text-xs text-gray-500 mt-0.5">{c.observacao}</p>}
                        </td>
                        <td className="px-3 py-3 text-gray-600">{catLabel(c.categoria)}</td>
                        <td className="px-3 py-3 text-gray-500">{c.etapa || '—'}</td>
                        <td className={`px-3 py-3 ${atrasado ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                          {c.data_prevista ? format(parseISO(c.data_prevista), 'dd MMM yyyy', { locale: ptBR }) : '—'}
                          {atrasado && <span className="text-xs block text-red-500">vencido</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900 font-semibold tabular-nums">{fmt(c.valor_previsto ?? c.valor_estimado)}</td>
                        <td className="px-3 py-3 text-center"><Badge className={`${st.cls} text-xs border`}>{st.label}</Badge></td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 justify-end">
                            {podeEditar && (<>
                              <Button size="icon" variant="ghost" onClick={() => handleEditar(c)} className="text-gray-600 hover:text-gray-900 h-7 w-7"><Pencil className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(c.id)} className="text-red-600 hover:text-red-700 h-7 w-7" disabled={deleteMutation.isPending}><Trash2 className="w-4 h-4" /></Button>
                            </>)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      <CustoPrevistoForm open={formOpen} onOpenChange={setFormOpen} obraId={obraId} custo={editando} />
    </div>
  );
}
