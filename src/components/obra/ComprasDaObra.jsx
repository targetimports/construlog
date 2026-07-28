import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ShoppingCart, FileText, Package, TrendingUp, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NecessidadePrevista from './NecessidadePrevista';
import SCModal from '../suprimentos/SCModal';
import ReceberMaterialTab from './materiais/ReceberMaterialTab';

const statusPCConfig = {
  // "Em Análise" (não "Rascunho"): para a obra, o pedido em rascunho significa que a
  // Central ainda está montando/negociando a compra — mais claro que jargão interno.
  RASCUNHO: { label: 'Em Análise', color: 'bg-amber-100 text-amber-700' },
  ENVIADO: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
  PARCIAL: { label: 'Parcial', color: 'bg-orange-100 text-orange-700' },
  RECEBIDO: { label: 'Recebido', color: 'bg-green-100 text-green-700' },
  CANCELADO: { label: 'Cancelado', color: 'bg-gray-100 text-gray-400' },
};

const statusSCConfig = {
  RASCUNHO: { label: 'Rascunho', color: 'bg-gray-100 text-gray-600' },
  ENVIADA: { label: 'Enviada', color: 'bg-blue-100 text-blue-700' },
  APROVADA: { label: 'Aprovada', color: 'bg-emerald-100 text-emerald-700' },
  REPROVADA: { label: 'Reprovada', color: 'bg-red-100 text-red-700' },
  CONVERTIDA: { label: 'Convertida', color: 'bg-purple-100 text-purple-700' },
  CANCELADA: { label: 'Cancelada', color: 'bg-gray-100 text-gray-400' },
};

export default function ComprasDaObra({ obraId, podeSolicitar = true }) {
  const [showSC, setShowSC] = useState(false);
  const [scView, setScView] = useState(null);
  const queryClient = useQueryClient();

  // Solicitações de Compra desta obra (o que o botão "Nova Solicitação de Compra" cria).
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-obra', obraId],
    queryFn: () => base44.entities.SolicitacaoCompra.filter({ obra_id: obraId }, '-created_date'),
    enabled: !!obraId
  });

  // Pedidos e requisições da obra: para MOSTRAR, na solicitação, em que etapa ela
  // está (virou pedido PC-X? já foi recebida?). Antes a obra criava a solicitação e
  // não via nada acontecer — a aprovação/geração de pedido é feita na Central.
  const { data: pedidosObra = [] } = useQuery({
    queryKey: ['pedidos-obra-sc', obraId],
    queryFn: () => base44.entities.PedidoCompra.filter({ obra_id: obraId }, '-created_date', 200).catch(() => []),
    enabled: !!obraId,
  });
  const pedidoPorId = React.useMemo(() => Object.fromEntries(pedidosObra.map((p) => [p.id, p])), [pedidosObra]);

  // Etapa "de ponta a ponta" de uma solicitação, seguindo o elo SC → PC → recebimento.
  const etapaDaSC = (s) => {
    const status = String(s.status || '').toUpperCase();
    if (status === 'CANCELADA' || status === 'REPROVADA') return { label: status === 'CANCELADA' ? 'Cancelada' : 'Reprovada', cls: 'text-gray-400', pedido: null };
    const ped = s.pedido_id ? pedidoPorId[s.pedido_id] : null;
    if (ped) {
      const ps = String(ped.status || '').toUpperCase();
      if (ps === 'RECEBIDO') return { label: `Recebido — ${ped.numero}`, cls: 'text-green-700', pedido: ped };
      if (ps === 'PARCIAL') return { label: `Recebimento parcial — ${ped.numero}`, cls: 'text-orange-700', pedido: ped };
      return { label: `Virou pedido ${ped.numero} — em compra`, cls: 'text-purple-700', pedido: ped };
    }
    if (status === 'CONVERTIDA') return { label: 'Convertida em pedido', cls: 'text-purple-700', pedido: null };
    if (status === 'APROVADA') return { label: 'Aprovada — aguardando virar pedido', cls: 'text-emerald-700', pedido: null };
    if (status === 'ENVIADA') return { label: 'Enviada — aguardando aprovação da Central', cls: 'text-blue-700', pedido: null };
    return { label: 'Rascunho', cls: 'text-gray-500', pedido: null };
  };

  // Compras a receber = requisições-sombra EM_TRANSITO com origem 'compra' (badge da aba).
  const { data: aReceberCompra = 0 } = useQuery({
    queryKey: ['compras-em-transito-count', obraId],
    queryFn: async () => {
      const reqs = await base44.entities.RequisicaoObra.filter({ obra_id: obraId, status: 'EM_TRANSITO' }).catch(() => []);
      return (reqs || []).filter((r) => r.origem_tipo === 'compra').length;
    },
    enabled: !!obraId,
  });

  // Pedidos de Compra (fluxo Suprimentos) — inclui pedidos diretos da obra e
  // consolidados (multi-obra) que incluam esta obra.
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-compra-obra', obraId],
    queryFn: async () => {
      const todos = await base44.entities.PedidoCompra.list('-created_date', 1000).catch(() => []);
      return todos.filter((p) => p.obra_id === obraId || (p.obras_multi || []).some((o) => o.id === obraId));
    },
    enabled: !!obraId,
  });

  return (
    <div className="space-y-6">
      {/* Header com Botões */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs text-gray-600">Solicitações</p>
            <p className="text-2xl font-bold text-blue-600">{solicitacoes.length}</p>
          </div>
          <div className="text-center p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-xs text-gray-600">Pedidos</p>
            <p className="text-2xl font-bold text-indigo-600">{pedidos.length}</p>
          </div>
          <div className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs text-gray-600">A receber</p>
            <p className="text-2xl font-bold text-emerald-600">{aReceberCompra}</p>
          </div>
        </div>
        {podeSolicitar && (
          <Button onClick={() => setShowSC(true)} className="bg-blue-600 hover:bg-blue-700 gap-2 w-full sm:w-auto flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="sm:hidden">Solicitar</span>
            <span className="hidden sm:inline">Nova Solicitação de Compra</span>
          </Button>
        )}
      </div>

      {/* Necessidade Prevista */}
      <NecessidadePrevista obraId={obraId} />

      {/* Tabs */}
      <Tabs defaultValue="solicitacoes">
        <TabsList className="w-full bg-gray-100 justify-start sm:justify-center overflow-x-auto">
          <TabsTrigger value="solicitacoes" className="flex-shrink-0 sm:flex-1 whitespace-nowrap">
            <FileText className="w-4 h-4 mr-2" />
            Solicitações ({solicitacoes.length})
          </TabsTrigger>
          <TabsTrigger value="pedidos" className="flex-shrink-0 sm:flex-1 whitespace-nowrap">
            <ShoppingCart className="w-4 h-4 mr-2" />
            Pedidos ({pedidos.length})
          </TabsTrigger>
          {/* "Requisições" e "Ordens" removidas: eram histórico vazio/redundante do
              fluxo antigo. O que importa para a obra é RECEBER o que foi comprado. */}
          <TabsTrigger value="recebimentos" className="flex-shrink-0 sm:flex-1 whitespace-nowrap">
            <Package className="w-4 h-4 mr-2" />
            Receber{aReceberCompra > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-semibold">{aReceberCompra}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="solicitacoes" className="mt-4">
          {solicitacoes.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Nenhuma solicitação de compra para esta obra</p>
              {podeSolicitar && <Button onClick={() => setShowSC(true)} variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700">Nova Solicitação</Button>}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Desktop: tabela */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Etapa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Observação</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {solicitacoes.map((s) => {
                      const st = statusSCConfig[s.status] || statusSCConfig.RASCUNHO;
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setScView(s)}>
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{s.numero || `SC-${s.id.slice(0, 8)}`}</td>
                          <td className="px-4 py-3"><Badge className={st.color}>{st.label}</Badge></td>
                          <td className="px-4 py-3">
                            {(() => { const e = etapaDaSC(s); return (
                              <span className={`text-xs font-medium ${e.cls}`}>{e.label}</span>
                            ); })()}
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[240px] truncate" title={s.observacao}>{s.observacao || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{s.created_date ? new Date(s.created_date).toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={(e) => { e.stopPropagation(); setScView(s); }}>
                              <Eye className="w-3.5 h-3.5" /> Ver
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile: cards */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {solicitacoes.map((s) => {
                  const st = statusSCConfig[s.status] || statusSCConfig.RASCUNHO;
                  return (
                    <div key={s.id} className="p-3 rounded-lg border border-gray-200" onClick={() => setScView(s)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{s.numero || `SC-${s.id.slice(0, 8)}`}</p>
                          {s.observacao && <p className="text-xs text-gray-500 truncate">{s.observacao}</p>}
                        </div>
                        <Badge className={`${st.color} shrink-0`}>{st.label}</Badge>
                      </div>
                      {(() => { const e = etapaDaSC(s); return (
                        <p className={`text-xs font-medium mt-1.5 ${e.cls}`}>{e.label}</p>
                      ); })()}
                      <div className="flex items-center justify-between gap-2 mt-2 text-xs text-gray-500">
                        <span className="capitalize">{String(s.prioridade || '—').toLowerCase()}</span>
                        <span>{s.created_date ? new Date(s.created_date).toLocaleDateString('pt-BR') : ''}</span>
                      </div>
                      <Button size="sm" variant="outline" className="w-full h-8 gap-1 mt-2" onClick={(e) => { e.stopPropagation(); setScView(s); }}>
                        <Eye className="w-3.5 h-3.5" /> Ver detalhes
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pedidos" className="mt-4">
          {pedidos.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">Nenhum pedido de compra para esta obra</p>
              <p className="text-xs text-gray-400 mt-1">Os pedidos aparecem aqui quando a Central aprova uma solicitação.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Desktop: tabela (mesmo padrão da aba Solicitações) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Número</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Fornecedor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Entrega</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pedidos.map((p) => {
                      const st = statusPCConfig[p.status] || statusPCConfig.RASCUNHO;
                      return (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                            {p.numero || `PC-${p.id.slice(0, 8)}`}
                            {p.consolidado && <Badge className="bg-blue-100 text-blue-700 ml-2 text-[10px]">Multi-obra</Badge>}
                          </td>
                          <td className="px-4 py-3"><Badge className={st.color}>{st.label}</Badge></td>
                          <td className="px-4 py-3 text-gray-600 max-w-[220px] truncate" title={p.fornecedor_nome}>{p.fornecedor_nome || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{p.previsao_entrega ? new Date(p.previsao_entrega).toLocaleDateString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{(p.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Mobile: cards */}
              <div className="md:hidden flex flex-col gap-y-2 p-2">
                {pedidos.map((p) => {
                  const st = statusPCConfig[p.status] || statusPCConfig.RASCUNHO;
                  return (
                    <div key={p.id} className="p-3 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{p.numero || `PC-${p.id.slice(0, 8)}`}</p>
                          <p className="text-xs text-gray-500 truncate">Fornecedor: {p.fornecedor_nome || '—'}</p>
                        </div>
                        <Badge className={`${st.color} shrink-0`}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-2 text-xs text-gray-500">
                        <span>{p.previsao_entrega ? `Entrega: ${new Date(p.previsao_entrega).toLocaleDateString('pt-BR')}` : ''}</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{(p.valor_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="recebimentos" className="mt-4">
          {/* Receber material COMPRADO: reutiliza a mesma tela de recebimento (com
              conferência, fotos e quebra) que a aba Materiais & Estoque → Receber.
              `somente=compra` mostra aqui só o que veio de compra; a requisição de
              estoque interno continua na aba de Materiais. */}
          <ReceberMaterialTab obraId={obraId} podeEditar={podeSolicitar} somente="compra" />
        </TabsContent>
      </Tabs>

      {/* Resumo Financeiro — total dos pedidos de compra desta obra. */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-xs text-gray-600 font-semibold">Total em pedidos de compra</p>
          <p className="text-lg sm:text-xl font-bold text-indigo-600 tabular-nums">
            {pedidos.reduce((s, p) => s + (Number(p.valor_total) || 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </CardContent>
      </Card>

      <SCModal
        open={showSC}
        onClose={() => setShowSC(false)}
        obraIdPreset={obraId}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['solicitacoes-obra', obraId] })}
      />

      <SCModal
        open={!!scView}
        sc={scView}
        onClose={() => setScView(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['solicitacoes-obra', obraId] })}
      />

    </div>
  );
}