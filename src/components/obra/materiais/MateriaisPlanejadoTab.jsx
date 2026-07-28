import React, { useState } from 'react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, AlertTriangle, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQtd = (v) => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function MateriaisPlanejadoTab({ obraId }) {
  const [pagItens, setPagItens] = useState(1);
  const POR_PAGINA = 15;

  // Orçamento da obra
  const { data: orcamentos = [], isLoading: loadingOrc } = useQuery({
    queryKey: ['orcamento-materiais-plan', obraId],
    queryFn: () => base44.entities.Orcamento.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  const orc = orcamentos[0] || null;

  // Composições (se analítico)
  const { data: composicoes = [], isLoading: loadingComp } = useQuery({
    queryKey: ['composicoes-materiais-plan', orc?.id],
    queryFn: () => base44.entities.ComposicaoInsumo.filter({ orcamento_id: orc.id }),
    enabled: !!orc?.id,
    staleTime: 60000,
  });

  // Necessidades planejadas
  const { data: necessidades = [], isLoading: loadingNec } = useQuery({
    queryKey: ['necessidades-materiais-plan', obraId],
    queryFn: () => base44.entities.NecessidadeMaterialObra.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 60000,
  });

  // Itens do orçamento (para exibição sintético) — busca por orcamento_id OU obra_id
  const { data: itensOrc = [], isLoading: loadingItens } = useQuery({
    queryKey: ['itens-orc-materiais-plan', orc?.id, obraId],
    queryFn: async () => {
      if (orc?.id) {
        const byOrc = await base44.entities.ItemOrcamento.filter({ orcamento_id: orc.id }, null, 500);
        if (byOrc.length > 0) return byOrc;
      }
      const byObra = await base44.entities.ItemOrcamento.filter({ obra_id: obraId }, null, 500);
      return byObra;
    },
    enabled: !!obraId && !!orc,
    staleTime: 60000,
  });

  const isLoading = loadingOrc || loadingComp || loadingNec || loadingItens;

  if (isLoading) {
    return <TableSkeleton rows={8} cols={6} />;
  }

  const temOrcamento = orcamentos.length > 0;
  const temComposicoes = composicoes.length > 0;

  // Sem orçamento
  if (!temOrcamento) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-700 font-medium">Esta obra ainda não possui orçamento vinculado.</p>
          <p className="text-xs text-gray-500 mt-2">Importe ou crie um orçamento para esta obra.</p>
        </CardContent>
      </Card>
    );
  }

  // Orçamento sintético
  if (temOrcamento && !temComposicoes) {
    const totalValor = itensOrc.reduce(
      (s, it) => s + (it.custo_total ?? it.valor_total ?? ((it.quantidade ?? 0) * (it.custo_unitario ?? it.valor_unitario ?? 0))),
      0
    );
    const totalPaginas = Math.max(1, Math.ceil(itensOrc.length / POR_PAGINA));
    const pagAtual = Math.min(pagItens, totalPaginas);
    const itensPagina = itensOrc.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium text-sm">Orçamento Sintético</p>
            <p className="text-amber-700 text-xs mt-1">
              Para gerar planejamento detalhado de materiais, é necessário orçamento analítico com composição de insumos.
            </p>
          </div>
        </div>

        {itensOrc.length > 0 && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-900 font-semibold">Itens do Orçamento</p>
                <span className="text-xs text-gray-400">(referência)</span>
                <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs ml-auto">{itensOrc.length} itens</Badge>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Mobile: cards */}
                <div className="md:hidden divide-y divide-gray-100">
                  {itensPagina.map((item, idx) => {
                    const qtd = item.quantidade ?? 0;
                    const custoUnit = item.custo_unitario ?? item.valor_unitario ?? 0;
                    const custoTotal = item.custo_total ?? item.valor_total ?? (qtd * custoUnit);
                    return (
                      <div key={item.id || idx} className="p-3 bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-gray-800 min-w-0 break-words">{item.descricao || '—'}</p>
                          <span className="text-sm text-gray-900 font-medium tabular-nums whitespace-nowrap shrink-0">
                            {custoTotal > 0 ? fmtBRL(custoTotal) : '—'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {fmtQtd(qtd)} {item.unidade || '—'} × {custoUnit > 0 ? fmtBRL(custoUnit) : '—'}
                        </p>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border-t-2 border-gray-200">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total do Orçamento</span>
                    <span className="text-sm text-emerald-700 font-bold tabular-nums whitespace-nowrap">{fmtBRL(totalValor)}</span>
                  </div>
                </div>
                {/* Desktop: tabela */}
                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Descrição</th>
                      <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unid.</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Qtd</th>
                      <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Valor Unit.</th>
                      <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {itensPagina.map((item, idx) => {
                      const qtd = item.quantidade ?? 0;
                      const custoUnit = item.custo_unitario ?? item.valor_unitario ?? 0;
                      const custoTotal = item.custo_total ?? item.valor_total ?? (qtd * custoUnit);
                      return (
                        <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-800 align-top">{item.descricao || '—'}</td>
                          <td className="px-3 py-2.5 text-center text-gray-500 whitespace-nowrap align-top">{item.unidade || '—'}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap align-top">{fmtQtd(qtd)}</td>
                          <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums whitespace-nowrap align-top">
                            {custoUnit > 0 ? fmtBRL(custoUnit) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-900 font-medium tabular-nums whitespace-nowrap align-top">
                            {custoTotal > 0 ? fmtBRL(custoTotal) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total do Orçamento</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-bold tabular-nums whitespace-nowrap">
                        {fmtBRL(totalValor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-gray-200 bg-white">
                  <span className="text-xs text-gray-500">
                    Mostrando {(pagAtual - 1) * POR_PAGINA + 1}–{Math.min(pagAtual * POR_PAGINA, itensOrc.length)} de {itensOrc.length} itens
                  </span>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPagItens(p => Math.max(1, p - 1))} disabled={pagAtual <= 1} className="h-8 gap-1 border-gray-300 text-gray-700">
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <span className="text-xs text-gray-600">Página {pagAtual} de {totalPaginas}</span>
                    <Button variant="outline" size="sm" onClick={() => setPagItens(p => Math.min(totalPaginas, p + 1))} disabled={pagAtual >= totalPaginas} className="h-8 gap-1 border-gray-300 text-gray-700">
                      Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Analítico com necessidades
  if (necessidades.length === 0) {
    return (
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-700 font-medium">Nenhum material planejado gerado ainda.</p>
          <p className="text-xs text-gray-500 mt-2">O orçamento analítico está vinculado. Gere o planejamento de materiais a partir das composições.</p>
        </CardContent>
      </Card>
    );
  }

  // Agrupar por insumo
  const agrupado = {};
  for (const nec of necessidades) {
    const key = nec.insumo_id || nec.id;
    if (!agrupado[key]) {
      agrupado[key] = { ...nec, quantidade_prevista: 0, valor_total_previsto: 0 };
    }
    agrupado[key].quantidade_prevista += (nec.quantidade_prevista || 0);
    agrupado[key].valor_total_previsto += (nec.valor_total_previsto || 0);
  }
  const lista = Object.values(agrupado);
  const totalAnalitico = lista.reduce((s, it) => s + (it.valor_total_previsto || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-gray-600">
          {lista.length} {lista.length === 1 ? 'material planejado' : 'materiais planejados'}
        </p>
        <Badge variant="outline" className="text-emerald-700 border-emerald-200 bg-emerald-50 text-xs w-fit">Orçamento Analítico</Badge>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Mobile: cards */}
        <div className="md:hidden divide-y divide-gray-100">
          {lista.map((item, idx) => {
            const statusCfg = {
              planejado: { label: 'Planejado', cls: 'bg-slate-100 text-slate-700' },
              parcialmente_comprado: { label: 'Parcial', cls: 'bg-amber-50 text-amber-700' },
              comprado: { label: 'Comprado', cls: 'bg-emerald-50 text-emerald-700' },
              concluido: { label: 'Concluído', cls: 'bg-gray-100 text-gray-600' },
            };
            const st = statusCfg[item.status] || statusCfg.planejado;
            return (
              <div key={item.id || idx} className="p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-800 min-w-0 break-words">{item.descricao || `Insumo #${(item.insumo_id || '').substring(0, 8)}`}</p>
                  <span className="text-sm text-gray-900 font-medium tabular-nums whitespace-nowrap shrink-0">
                    {item.valor_total_previsto > 0 ? fmtBRL(item.valor_total_previsto) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-1">
                  <p className="text-xs text-gray-500">
                    {fmtQtd(item.quantidade_prevista)} {item.unidade || '—'}
                  </p>
                  <Badge className={`text-xs ${st.cls}`}>{st.label}</Badge>
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 border-t-2 border-gray-200">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Estimado</span>
            <span className="text-sm text-emerald-700 font-bold tabular-nums whitespace-nowrap">{fmtBRL(totalAnalitico)}</span>
          </div>
        </div>
        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Material</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unidade</th>
              <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Qtd Planejada</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Valor Est.</th>
              <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map((item, idx) => {
              const statusCfg = {
                planejado: { label: 'Planejado', cls: 'bg-slate-100 text-slate-700' },
                parcialmente_comprado: { label: 'Parcial', cls: 'bg-amber-50 text-amber-700' },
                comprado: { label: 'Comprado', cls: 'bg-emerald-50 text-emerald-700' },
                concluido: { label: 'Concluído', cls: 'bg-gray-100 text-gray-600' },
              };
              const st = statusCfg[item.status] || statusCfg.planejado;
              return (
                <tr key={item.id || idx} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-800">{item.descricao || `Insumo #${(item.insumo_id || '').substring(0, 8)}`}</td>
                  <td className="px-3 py-2.5 text-center text-gray-500">{item.unidade || '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-700 tabular-nums">{fmtQtd(item.quantidade_prevista)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 font-medium tabular-nums">
                    {item.valor_total_previsto > 0 ? fmtBRL(item.valor_total_previsto) : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge className={`text-xs ${st.cls}`}>{st.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={3} className="px-4 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Estimado</td>
              <td className="px-4 py-3 text-right text-emerald-700 font-bold tabular-nums">{fmtBRL(totalAnalitico)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
        </div>
      </div>
    </div>
  );
}
