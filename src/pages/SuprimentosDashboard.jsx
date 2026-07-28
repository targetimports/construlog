import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ShoppingCart, Package, Truck, ArrowRightLeft, FileText, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

const SOL_STATUS = {
  RASCUNHO: 'bg-gray-100 text-gray-600',
  ENVIADA: 'bg-amber-100 text-amber-700',
  APROVADA: 'bg-green-100 text-green-700',
  REJEITADA: 'bg-red-100 text-red-700',
};
const PED_STATUS = {
  RASCUNHO: 'bg-gray-100 text-gray-600',
  ENVIADO: 'bg-blue-100 text-blue-700',
  PARCIAL: 'bg-orange-100 text-orange-700',
  RECEBIDO: 'bg-green-100 text-green-700',
  CANCELADO: 'bg-gray-100 text-gray-400',
};

function KPICard({ title, value, icon: Icon, color = 'blue', link }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };
  const content = (
    <Card className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl border ${colors[color]}`}><Icon className="w-5 h-5" /></div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-sm font-medium text-gray-700">{title}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return link ? <Link to={createPageUrl(link)}>{content}</Link> : content;
}

export default function SuprimentosDashboard() {
  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['sup-solicitacoes-novo'],
    queryFn: () => base44.entities.SolicitacaoCompra.list('-created_date', 1000).catch(() => []),
  });
  const { data: pedidos = [] } = useQuery({
    queryKey: ['sup-pedidos-novo'],
    queryFn: () => base44.entities.PedidoCompra.list('-created_date', 1000).catch(() => []),
  });
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ['sup-movimentacoes-novo'],
    queryFn: () => base44.entities.EstoqueMovimentacao.list('-created_date', 1000).catch(() => []),
  });

  const solPendentes = solicitacoes.filter((s) => String(s.status).toUpperCase() === 'ENVIADA').length;
  const pedidosAbertos = pedidos.filter((p) => ['ENVIADO', 'PARCIAL'].includes(p.status)).length;
  const entradas = movimentacoes.filter((m) => String(m.tipo).toUpperCase() === 'ENTRADA').length;
  const saidas = movimentacoes.filter((m) => String(m.tipo).toUpperCase() === 'SAIDA').length;

  // Paginação client-side
  const sol = usePagination(solicitacoes, 20);
  const ped = usePagination(pedidos, 20);

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Compras</h1>
        <p className="text-gray-500 text-sm mt-1">Compras e estoque vinculados às obras</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Solicitações Pendentes" value={solPendentes} icon={AlertTriangle} color="amber" link="SuprimentosSolicitacoes" />
        <KPICard title="Pedidos em Aberto" value={pedidosAbertos} icon={ShoppingCart} color="blue" link="SuprimentosPedidos" />
        <KPICard title="Entradas de Estoque" value={entradas} icon={CheckCircle2} color="green" link="SuprimentosEstoque" />
        <KPICard title="Saídas de Estoque" value={saidas} icon={Package} color="purple" link="SuprimentosEstoque" />
      </div>

      {/* Solicitações de Compra */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-gray-900">Solicitações de Compra ({solicitacoes.length})</CardTitle>
          <Link to={createPageUrl('SuprimentosSolicitacoes')}><Button variant="outline" size="sm" className="border-gray-300 text-gray-700">Ver todas</Button></Link>
        </CardHeader>
        <CardContent>
          {solicitacoes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Nenhuma solicitação cadastrada.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-2 font-semibold text-gray-600">Obra</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Solicitante</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Prioridade</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Status</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sol.paginatedItems.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="p-2 font-medium text-gray-900">{s.obra_nome || '—'}</td>
                        <td className="p-2 text-gray-600">{s.solicitante_nome || s.solicitante || '—'}</td>
                        <td className="p-2 text-gray-600">{s.prioridade || '—'}</td>
                        <td className="p-2"><Badge className={`border-0 ${SOL_STATUS[String(s.status).toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>{s.status || '—'}</Badge></td>
                        <td className="p-2 text-gray-400 text-xs">{fmtData(s.created_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {sol.paginatedItems.map((s) => (
                  <div key={s.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 break-words min-w-0">{s.obra_nome || '—'}</p>
                      <Badge className={`border-0 shrink-0 ${SOL_STATUS[String(s.status).toUpperCase()] || 'bg-gray-100 text-gray-600'}`}>{s.status || '—'}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                      <span className="break-words">{s.solicitante_nome || s.solicitante || '—'}</span>
                      <span className="text-gray-300">·</span>
                      <span>Prioridade: {s.prioridade || '—'}</span>
                      <span className="text-gray-300">·</span>
                      <span>{fmtData(s.created_date)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination currentPage={sol.currentPage} totalPages={sol.totalPages} onPageChange={sol.goToPage} startIndex={sol.startIndex} endIndex={sol.endIndex} totalItems={sol.totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Pedidos de Compra */}
      <Card className="bg-white border-gray-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base text-gray-900">Pedidos de Compra ({pedidos.length})</CardTitle>
          <Link to={createPageUrl('SuprimentosPedidos')}><Button variant="outline" size="sm" className="border-gray-300 text-gray-700">Ver todos</Button></Link>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Nenhum pedido cadastrado.</p>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-2 font-semibold text-gray-600">Número</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Obra</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Fornecedor</th>
                      <th className="text-left p-2 font-semibold text-gray-600">Status</th>
                      <th className="text-right p-2 font-semibold text-gray-600">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {ped.paginatedItems.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="p-2 font-mono text-xs text-gray-500">{p.numero || p.id.slice(0, 8)}</td>
                        <td className="p-2 font-medium text-gray-900">{p.obra_nome || (p.consolidado ? 'Multi-obra' : '—')}</td>
                        <td className="p-2 text-gray-600">{p.fornecedor_nome || '—'}</td>
                        <td className="p-2"><Badge className={`border-0 ${PED_STATUS[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status || '—'}</Badge></td>
                        <td className="p-2 text-right tabular-nums text-gray-700">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {ped.paginatedItems.map((p) => (
                  <div key={p.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{p.obra_nome || (p.consolidado ? 'Multi-obra' : '—')}</p>
                        <p className="text-xs text-gray-500 break-words">{p.fornecedor_nome || '—'}</p>
                        <p className="font-mono text-xs text-gray-400 mt-0.5 break-words">{p.numero || p.id.slice(0, 8)}</p>
                      </div>
                      <Badge className={`border-0 shrink-0 ${PED_STATUS[p.status] || 'bg-gray-100 text-gray-600'}`}>{p.status || '—'}</Badge>
                    </div>
                    <p className="text-sm font-semibold text-gray-700 tabular-nums break-words">{p.valor_total ? fmtBRL(p.valor_total) : '—'}</p>
                  </div>
                ))}
              </div>
              <Pagination currentPage={ped.currentPage} totalPages={ped.totalPages} onPageChange={ped.goToPage} startIndex={ped.startIndex} endIndex={ped.endIndex} totalItems={ped.totalItems} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
