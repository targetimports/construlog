import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import { Package, TrendingDown, Truck, Warehouse, ClipboardList, ArrowRight, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// DASHBOARD DO ALMOXARIFE — o que ele precisa resolver hoje.
//
// Reescrito sobre o fluxo VIVO (RequisicaoObra + PedidoCompra). A versão anterior
// lia `TransferenciaEstoque`, entidade do fluxo antigo que está vazia — os cartões
// mostravam zero para sempre.
//
// A ordem segue a fila de trabalho dele: o que precisa separar/enviar, o que está
// na estrada, o que vai chegar do fornecedor e o que está acabando na prateleira.

const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const fmtQtd = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

export default function DashboardAlmoxarifado() {
  const { data: user } = useQuery({ queryKey: ['user'], queryFn: () => base44.auth.me() });

  const { data: requisicoes = [], isLoading: carregandoReq } = useQuery({
    queryKey: ['requisicoes-almox'],
    queryFn: () => base44.entities.RequisicaoObra.list('-data_requisicao', 500).catch(() => []),
  });

  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos-almox'],
    queryFn: () => base44.entities.PedidoCompra.list('-created_date', 500).catch(() => []),
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ['saldos-almox'],
    queryFn: () => base44.entities.SaldoEstoque.list('-updated_date', 5000).catch(() => []),
  });

  // Fila de trabalho. APROVADA = liberada pela Central e esperando ele separar.
  const aSeparar = useMemo(() => requisicoes.filter((r) => r.status === 'APROVADA'), [requisicoes]);
  const emTransito = useMemo(() => requisicoes.filter((r) => r.status === 'EM_TRANSITO'), [requisicoes]);
  const aguardandoAprovacao = useMemo(() => requisicoes.filter((r) => r.status === 'ENVIADA'), [requisicoes]);
  const pedidosAReceber = useMemo(
    () => pedidos.filter((p) => ['APROVADO', 'EM_TRANSITO', 'COMPRADO'].includes(String(p.status || '').toUpperCase())),
    [pedidos],
  );

  // "Acabando" = saldo positivo mas abaixo do mínimo do próprio item; sem mínimo
  // cadastrado, usa 10 como referência (era o critério da versão anterior).
  const acabando = useMemo(
    () => saldos.filter((s) => {
      const qtd = Number(s.saldo_atual ?? s.quantidade ?? 0);
      const min = Number(s.estoque_minimo ?? 0) || 10;
      return qtd > 0 && qtd <= min;
    }),
    [saldos],
  );
  const zerados = useMemo(
    () => saldos.filter((s) => Number(s.saldo_atual ?? s.quantidade ?? 0) <= 0),
    [saldos],
  );

  const Kpi = ({ titulo, valor, sub, icone: Icone, cor, para }) => {
    const conteudo = (
      <Card className="bg-white border-gray-200 h-full hover:border-blue-300 transition">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">{titulo}</CardTitle>
          <Icone className={`h-4 w-4 ${cor}`} />
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-2xl font-bold tabular-nums text-gray-900">{valor}</div>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </CardContent>
      </Card>
    );
    return para ? <Link to={createPageUrl(para)} className="block h-full">{conteudo}</Link> : conteudo;
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Almoxarifado</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.full_name}</p>
      </div>

      {carregandoReq ? (
        <KpiCardsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Kpi titulo="A separar" valor={aSeparar.length} sub="requisições liberadas"
            icone={ClipboardList} cor="text-amber-600" para="SuprimentosRequisicoes" />
          <Kpi titulo="Em trânsito" valor={emTransito.length} sub="a caminho da obra"
            icone={Truck} cor="text-blue-600" para="SuprimentosRequisicoes" />
          <Kpi titulo="Compras a receber" valor={pedidosAReceber.length} sub="pedidos do fornecedor"
            icone={ShoppingCart} cor="text-purple-600" para="SuprimentosPedidos" />
          <Kpi titulo="Estoque baixo" valor={acabando.length + zerados.length}
            sub={`${zerados.length} zerado(s)`} icone={TrendingDown} cor="text-red-600" para="Almoxarifados" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* O que ele precisa separar AGORA — o coração do trabalho dele. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Requisições a separar</CardTitle>
            <Link to={createPageUrl('SuprimentosRequisicoes')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {aSeparar.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nada aguardando separação.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {aSeparar.slice(0, 6).map((r) => (
                  <li key={r.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{r.obra_nome || 'Obra'}</p>
                      <p className="text-xs text-gray-500">
                        {r.solicitante_nome || '—'} · {dataBR(r.data_requisicao)}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 shrink-0">Aprovada</Badge>
                  </li>
                ))}
                {aSeparar.length > 6 && (
                  <li className="pt-2 text-xs text-gray-400">+{aSeparar.length - 6} outras</li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Prateleira acabando — evita a obra parar por falta de material. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Materiais acabando</CardTitle>
            <Link to={createPageUrl('Almoxarifados')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ver estoque <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {acabando.length === 0 && zerados.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum item em falta.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {[...zerados, ...acabando].slice(0, 6).map((s) => {
                  const qtd = Number(s.saldo_atual ?? s.quantidade ?? 0);
                  return (
                    <li key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{s.insumo_nome || s.material_nome || 'Material'}</p>
                        <p className="text-xs text-gray-500 truncate">{s.local_estoque_nome || '—'}</p>
                      </div>
                      <span className={`text-sm font-medium tabular-nums shrink-0 ${qtd <= 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {fmtQtd(qtd)} {s.unidade || ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white border-gray-200">
        <CardHeader><CardTitle className="text-base">Acesso rápido</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { page: 'SuprimentosRequisicoes', nome: 'Requisições de Material', icone: ClipboardList, cor: 'text-amber-600' },
            { page: 'Almoxarifados', nome: 'Almoxarifados', icone: Warehouse, cor: 'text-blue-600' },
            { page: 'SuprimentosPedidos', nome: 'Pedidos de Compra', icone: Package, cor: 'text-purple-600' },
          ].map((a) => (
            <Link key={a.page} to={createPageUrl(a.page)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <a.icone className={`h-5 w-5 ${a.cor}`} />
              <span className="font-medium text-sm text-gray-800">{a.nome}</span>
            </Link>
          ))}
        </CardContent>
      </Card>

      {aguardandoAprovacao.length > 0 && (
        <p className="text-xs text-gray-500">
          {aguardandoAprovacao.length} requisição(ões) ainda aguardando aprovação da Central — aparecem aqui quando forem liberadas.
        </p>
      )}
    </div>
  );
}
