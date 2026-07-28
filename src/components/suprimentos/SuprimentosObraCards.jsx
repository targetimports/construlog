import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, ShoppingCart, ClipboardList, Truck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function calcSaldoObra(movs, obraId) {
  const saldos = {};
  for (const m of movs) {
    if (m.obra_id !== obraId || !m.material_id) continue;
    if (!saldos[m.material_id]) saldos[m.material_id] = { nome: m.material_nome, qtd: 0 };
    if (m.tipo === 'ENTRADA') saldos[m.material_id].qtd += m.quantidade || 0;
    if (m.tipo === 'SAIDA') saldos[m.material_id].qtd -= m.quantidade || 0;
  }
  return Object.values(saldos).filter(s => s.qtd > 0);
}

export default function SuprimentosObraCards({ obraId }) {
  const { data: movs = [] } = useQuery({
    queryKey: ['movs-obra', obraId],
    queryFn: () => base44.entities.EstoqueMovimentacao.filter({ obra_id: obraId }, '-data_mov', 500),
    enabled: !!obraId,
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['req-obra', obraId],
    queryFn: () => base44.entities.RequisicaoObra.filter({ obra_id: obraId }, '-created_date', 50),
    enabled: !!obraId,
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-obra', obraId],
    queryFn: () => base44.entities.PedidoCompra.filter({ obra_id: obraId }, '-created_date', 50),
    enabled: !!obraId,
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ['recv-obra', obraId],
    queryFn: () => base44.entities.Recebimento.filter({ obra_id: obraId }, '-created_date', 10),
    enabled: !!obraId,
  });

  const saldoItens = useMemo(() => calcSaldoObra(movs, obraId), [movs, obraId]);
  const reqPendentes = requisicoes.filter(r => ['ENVIADA', 'APROVADA'].includes(r.status));
  const pedidosAbertos = pedidos.filter(p => ['RASCUNHO', 'ENVIADO', 'PARCIAL'].includes(p.status));
  const recebRecentes = recebimentos.filter(r => r.status === 'CONFIRMADO').slice(0, 5);

  const STATUS_REQ = { ENVIADA: 'bg-blue-100 text-blue-700', APROVADA: 'bg-yellow-100 text-yellow-700' };
  const STATUS_PC  = { RASCUNHO: 'bg-gray-100 text-gray-500', ENVIADO: 'bg-blue-100 text-blue-700', PARCIAL: 'bg-orange-100 text-orange-700' };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2"><Package className="w-5 h-5 text-blue-500" />Suprimentos da Obra</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Saldo do Estoque */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              Saldo no Estoque (vinculado à obra)
              <Link to={createPageUrl('SuprimentosEstoque')} className="text-blue-500 hover:underline text-xs flex items-center gap-0.5">Ver tudo <ArrowRight className="w-3 h-3" /></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {saldoItens.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">Sem movimentações de estoque para esta obra</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {saldoItens.slice(0, 8).map((s, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700 truncate">{s.nome}</span>
                    <span className="text-sm font-bold text-green-700 ml-2">{s.qtd.toFixed(2)}</span>
                  </div>
                ))}
                {saldoItens.length > 8 && <p className="text-xs text-gray-400 text-center pt-1">+{saldoItens.length - 8} materiais</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Requisições Pendentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-1"><ClipboardList className="w-4 h-4" />Requisições Pendentes {reqPendentes.length > 0 && <Badge className="bg-blue-100 text-blue-700 ml-1">{reqPendentes.length}</Badge>}</span>
              <Link to={createPageUrl('SuprimentosRequisicoes')} className="text-blue-500 hover:underline text-xs flex items-center gap-0.5">Ver tudo <ArrowRight className="w-3 h-3" /></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reqPendentes.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">Sem requisições pendentes</p>
            ) : (
              <div className="space-y-2">
                {reqPendentes.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{r.local_estoque_nome || 'Local'} · {r.solicitante_nome || '—'}</span>
                    <Badge className={STATUS_REQ[r.status]}>{r.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pedidos em Aberto */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-1"><ShoppingCart className="w-4 h-4" />Pedidos em Aberto {pedidosAbertos.length > 0 && <Badge className="bg-orange-100 text-orange-700 ml-1">{pedidosAbertos.length}</Badge>}</span>
              <Link to={createPageUrl('SuprimentosPedidos')} className="text-blue-500 hover:underline text-xs flex items-center gap-0.5">Ver tudo <ArrowRight className="w-3 h-3" /></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pedidosAbertos.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">Sem pedidos em aberto</p>
            ) : (
              <div className="space-y-2">
                {pedidosAbertos.slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{p.fornecedor_nome || '—'} {p.numero ? `· ${p.numero}` : ''}</span>
                    <div className="flex items-center gap-2">
                      {p.valor_total ? <span className="text-xs text-gray-400">R$ {p.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span> : null}
                      <Badge className={STATUS_PC[p.status] || 'bg-gray-100 text-gray-500'}>{p.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recebimentos Recentes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
              <span className="flex items-center gap-1"><Truck className="w-4 h-4" />Recebimentos Recentes</span>
              <Link to={createPageUrl('SuprimentosRecebimentos')} className="text-blue-500 hover:underline text-xs flex items-center gap-0.5">Ver tudo <ArrowRight className="w-3 h-3" /></Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recebRecentes.length === 0 ? (
              <p className="text-sm text-gray-400 py-3 text-center">Sem recebimentos registrados</p>
            ) : (
              <div className="space-y-2">
                {recebRecentes.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-700">{r.fornecedor_nome || '—'}</span>
                      {r.numero_nf && <span className="text-xs text-gray-400 ml-1">NF {r.numero_nf}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {r.valor_total ? <span className="text-xs text-gray-400">R$ {r.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</span> : null}
                      <span className="text-xs text-gray-400">{r.data_recebimento ? format(new Date(r.data_recebimento), 'dd/MM', { locale: ptBR }) : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}