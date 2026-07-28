import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { ListSkeleton } from '@/components/shared/Skeletons';
import { CheckCircle2, Link as LinkIcon, Scale, Wallet, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { fmtCompactBRL } from '@/lib/fmtCompact';

const moeda = (v) => 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '-');
const ITENS_POR_PAGINA = 20;

const paginar = (arr, pagina) => arr.slice((pagina - 1) * ITENS_POR_PAGINA, (pagina - 1) * ITENS_POR_PAGINA + ITENS_POR_PAGINA);

// Rodapé de paginação — usa o componente compartilhado (padrão do sistema),
// adaptando o estado manual de página desta tela (3 listas independentes).
function Paginacao({ total, pagina, setPagina }) {
  return (
    <Pagination
      currentPage={pagina}
      totalPages={Math.max(1, Math.ceil(total / ITENS_POR_PAGINA))}
      onPageChange={setPagina}
      startIndex={(pagina - 1) * ITENS_POR_PAGINA}
      endIndex={Math.min(pagina * ITENS_POR_PAGINA, total)}
      totalItems={total}
    />
  );
}

export default function Conciliacao({ embedded = false }) {
  const [obraId, setObraId] = useState('');
  const [filtroSit, setFiltroSit] = useState('todas');
  const [pageSug, setPageSug] = useState(1);
  const [pageContas, setPageContas] = useState(1);
  const [pageMov, setPageMov] = useState(1);
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data, isLoading } = useQuery({
    queryKey: ['conciliacao-financeira', obraId],
    queryFn: () => base44.functions.invoke('getConciliacaoFinanceira', { obra_id: obraId || undefined }).then(r => r.data)
  });

  const kpis = data?.kpis || { total_liquidado: 0, conciliado_valor: 0, conciliado_count: 0, pendente_valor: 0, pendente_count: 0, percentual: 0 };
  const contas = data?.contas || [];
  const movimentacoes = data?.movimentacoes || [];
  const sugestoes = data?.sugestoes || [];

  const conciliarMut = useMutation({
    mutationFn: (payload) => base44.functions.invoke('conciliarContaFinanceira', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['conciliacao-financeira'] });
      toast.success(res.data?.conciliado === false ? 'Conciliação desfeita' : 'Conta conciliada');
    },
    onError: (e) => toast.error(e?.response?.data?.error || e?.message || 'Erro ao conciliar')
  });

  const contasFiltradas = contas.filter(c =>
    filtroSit === 'todas' ? true : filtroSit === 'conciliado' ? c.conciliado : !c.conciliado
  );

  // Páginas efetivas (clamp para não estourar quando a lista encolhe após conciliar)
  const pSug = Math.min(pageSug, Math.max(1, Math.ceil(sugestoes.length / ITENS_POR_PAGINA)));
  const pContas = Math.min(pageContas, Math.max(1, Math.ceil(contasFiltradas.length / ITENS_POR_PAGINA)));
  const pMov = Math.min(pageMov, Math.max(1, Math.ceil(movimentacoes.length / ITENS_POR_PAGINA)));
  const sugestoesPag = paginar(sugestoes, pSug);
  const contasPag = paginar(contasFiltradas, pContas);
  const movPag = paginar(movimentacoes, pMov);

  const tipoBadge = (tipo) => tipo === 'pagar'
    ? <Badge className="bg-red-100 text-red-700 border-0">Pagar</Badge>
    : <Badge className="bg-green-100 text-green-700 border-0">Receber</Badge>;

  return (
    <div className={embedded ? 'space-y-6' : 'space-y-6 pb-6'}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Scale className="w-6 h-6 text-blue-600" /> Conciliação Financeira</h1>
          <p className="text-gray-500 text-sm mt-1">Cruze contas liquidadas com as movimentações de tesouraria</p>
        </div>
      )}

      {/* Filtro de obra */}
      <div className="w-full sm:w-72">
        <ComboboxBusca
          options={[{ value: '__all', label: 'Todas as obras' }, ...obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))]}
          value={obraId}
          onSelect={(v) => { setObraId(v === '__all' ? '' : (v || '')); setPageSug(1); setPageContas(1); setPageMov(1); }}
          placeholder="Todas as obras"
          searchPlaceholder="Buscar obra..."
          emptyMessage="Nenhuma obra."
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500">Total Liquidado</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums mt-1 truncate" title={moeda(kpis.total_liquidado)}>{fmtCompactBRL(kpis.total_liquidado)}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.total_count} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500">Conciliado</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums mt-1 truncate" title={moeda(kpis.conciliado_valor)}>{fmtCompactBRL(kpis.conciliado_valor)}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.conciliado_count} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500">Pendente</p>
            <p className="text-lg sm:text-2xl font-bold text-amber-600 tabular-nums mt-1 truncate" title={moeda(kpis.pendente_valor)}>{fmtCompactBRL(kpis.pendente_valor)}</p>
            <p className="text-xs text-gray-400 mt-1">{kpis.pendente_count} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-5 pb-4">
            <p className="text-xs font-medium text-gray-500">% Conciliado</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums mt-1">{kpis.percentual}%</p>
            <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${kpis.percentual}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sugestoes" className="space-y-4">
        <TabsList className="flex w-full overflow-x-auto justify-start md:w-auto md:inline-flex bg-white border border-gray-200">
          <TabsTrigger value="sugestoes" className="shrink-0 whitespace-nowrap gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"><LinkIcon className="w-4 h-4" /> Sugestões ({sugestoes.length})</TabsTrigger>
          <TabsTrigger value="contas" className="shrink-0 whitespace-nowrap gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"><Scale className="w-4 h-4" /> Contas Liquidadas</TabsTrigger>
          <TabsTrigger value="movimentacoes" className="shrink-0 whitespace-nowrap gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white"><Wallet className="w-4 h-4" /> Movimentações ({movimentacoes.length})</TabsTrigger>
        </TabsList>

        {/* Sugestões automáticas */}
        <TabsContent value="sugestoes" className="space-y-3">
          {isLoading ? (
            <ListSkeleton rows={6} />
          ) : sugestoes.length === 0 ? (
            <Card className="bg-white border-gray-200"><CardContent className="py-10 text-center text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              Nenhuma sugestão automática pendente. Tudo conciliado ou sem correspondência exata.
            </CardContent></Card>
          ) : (
            <>
            {sugestoesPag.map((s) => (
              <Card key={s.conta_id} className="bg-white border-gray-200">
                <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{s.conta_descricao}</p>
                      <p className="text-xs text-gray-500">Conta liquidada • {dataBR(s.data)}</p>
                    </div>
                    <LinkIcon className="w-4 h-4 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm text-gray-700">{s.mov_descricao}</p>
                      <p className="text-xs text-gray-500">Caixa e Bancos • {dataBR(s.mov_data)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <span className="font-mono font-bold text-gray-900">{moeda(s.valor)}</span>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={conciliarMut.isPending}
                      onClick={() => conciliarMut.mutate({ conta_id: s.conta_id, movimentacao_id: s.movimentacao_id })}>
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Conciliar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Paginacao total={sugestoes.length} pagina={pSug} setPagina={setPageSug} />
            </>
          )}
        </TabsContent>

        {/* Contas liquidadas */}
        <TabsContent value="contas" className="space-y-4">
          <div className="w-full sm:w-56">
            <ComboboxBusca
              options={[{ value: 'todas', label: 'Todas' }, { value: 'pendente', label: 'Não conciliadas' }, { value: 'conciliado', label: 'Conciliadas' }]}
              value={filtroSit}
              onSelect={(v) => { setFiltroSit(v || 'todas'); setPageContas(1); }}
              placeholder="Todas"
              searchPlaceholder="Buscar..."
            />
          </div>
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              {contasFiltradas.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" /> Nenhuma conta liquidada.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Descrição</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Tipo</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Conciliação</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {contasPag.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="p-3">{dataBR(c.data)}</td>
                            <td className="p-3">
                              <div className="font-medium text-gray-900">{c.descricao}</div>
                              <div className="text-xs text-gray-500">{c.fornecedor_cliente || c.obra_nome}</div>
                            </td>
                            <td className="p-3 text-center">{tipoBadge(c.tipo)}</td>
                            <td className="p-3 text-right font-mono font-bold">{moeda(c.valor)}</td>
                            <td className="p-3 text-center">
                              {c.conciliado
                                ? <Badge className="bg-green-100 text-green-700 border-0">Conciliado</Badge>
                                : <Badge className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>}
                            </td>
                            <td className="p-3 text-center">
                              {c.conciliado ? (
                                <Button size="sm" variant="outline" className="h-8 gap-1 border-gray-300 text-gray-700" disabled={conciliarMut.isPending}
                                  onClick={() => conciliarMut.mutate({ conta_id: c.id, desfazer: true })}>
                                  <RotateCcw className="w-3.5 h-3.5" /> Desfazer
                                </Button>
                              ) : (
                                <Button size="sm" variant="outline" className="h-8 gap-1" disabled={conciliarMut.isPending}
                                  onClick={() => conciliarMut.mutate({ conta_id: c.id })}>
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Conciliar
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden flex flex-col gap-y-2 p-2">
                    {contasPag.map((c) => (
                      <div key={c.id} className="p-3 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 break-words">{c.descricao}</div>
                            <div className="text-xs text-gray-500">{c.fornecedor_cliente || c.obra_nome}</div>
                          </div>
                          {tipoBadge(c.tipo)}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-xs text-gray-500">{dataBR(c.data)}</span>
                          <span className="font-mono font-bold text-gray-900 break-words">{moeda(c.valor)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          {c.conciliado
                            ? <Badge className="bg-green-100 text-green-700 border-0">Conciliado</Badge>
                            : <Badge className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>}
                          {c.conciliado ? (
                            <Button size="sm" variant="outline" className="h-8 gap-1 border-gray-300 text-gray-700" disabled={conciliarMut.isPending}
                              onClick={() => conciliarMut.mutate({ conta_id: c.id, desfazer: true })}>
                              <RotateCcw className="w-3.5 h-3.5" /> Desfazer
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-8 gap-1" disabled={conciliarMut.isPending}
                              onClick={() => conciliarMut.mutate({ conta_id: c.id })}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Conciliar
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Paginacao total={contasFiltradas.length} pagina={pContas} setPagina={setPageContas} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Movimentações de tesouraria */}
        <TabsContent value="movimentacoes" className="space-y-4">
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              {movimentacoes.length === 0 ? (
                <div className="text-center py-8 text-gray-500"><Wallet className="w-12 h-12 mx-auto mb-2 text-gray-300" /> Nenhuma movimentação de tesouraria.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                          <th className="text-left p-3 text-xs font-semibold text-gray-500">Descrição</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Tipo</th>
                          <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                          <th className="text-center p-3 text-xs font-semibold text-gray-500">Conciliação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {movPag.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="p-3">{dataBR(m.data)}</td>
                            <td className="p-3">
                              <div className="font-medium text-gray-900">{m.descricao}</div>
                              <div className="text-xs text-gray-500 capitalize">{(m.categoria || '').replace(/_/g, ' ')}</div>
                            </td>
                            <td className="p-3 text-center">
                              {m.tipo === 'entrada'
                                ? <Badge className="bg-green-100 text-green-700 border-0">Entrada</Badge>
                                : m.tipo === 'saida'
                                  ? <Badge className="bg-red-100 text-red-700 border-0">Saída</Badge>
                                  : <Badge className="bg-blue-100 text-blue-700 border-0">Transf.</Badge>}
                            </td>
                            <td className="p-3 text-right font-mono font-bold">{moeda(m.valor)}</td>
                            <td className="p-3 text-center">
                              {m.conciliado
                                ? <Badge className="bg-green-100 text-green-700 border-0">Conciliada</Badge>
                                : <Badge className="bg-gray-100 text-gray-600 border-0">—</Badge>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="md:hidden flex flex-col gap-y-2 p-2">
                    {movPag.map((m) => (
                      <div key={m.id} className="p-3 rounded-lg border border-gray-200">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-900 break-words">{m.descricao}</div>
                            <div className="text-xs text-gray-500 capitalize">{(m.categoria || '').replace(/_/g, ' ')}</div>
                          </div>
                          {m.tipo === 'entrada'
                            ? <Badge className="bg-green-100 text-green-700 border-0">Entrada</Badge>
                            : m.tipo === 'saida'
                              ? <Badge className="bg-red-100 text-red-700 border-0">Saída</Badge>
                              : <Badge className="bg-blue-100 text-blue-700 border-0">Transf.</Badge>}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-xs text-gray-500">{dataBR(m.data)}</span>
                          <span className="font-mono font-bold text-gray-900 break-words">{moeda(m.valor)}</span>
                        </div>
                        <div className="mt-2">
                          {m.conciliado
                            ? <Badge className="bg-green-100 text-green-700 border-0">Conciliada</Badge>
                            : <Badge className="bg-gray-100 text-gray-600 border-0">—</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Paginacao total={movimentacoes.length} pagina={pMov} setPagina={setPageMov} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
