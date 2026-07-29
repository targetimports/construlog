import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, CreditCard, ArrowRight, CircleDollarSign } from 'lucide-react';
import { TableSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, FiltroPilulas, fmtBRL, fmtData, hojeISO,
} from '@/components/painel/ui';

// PAGAMENTOS — a saúde financeira de cada cliente, em leitura.
//
// Esta tela NÃO lança nem dá baixa: quem opera cobrança é a tela Cobranças.
// Aqui se responde "quem está em dia e quem está me devendo", olhando o mesmo
// dado (entidade Cobranca) por outro ângulo — o do cliente, não o da fatura.
// Ter uma única porta de escrita é o que impede os números divergirem.

const emAberto = (c) => c.status !== 'pago' && c.status !== 'cancelado';
const vencida = (c) => emAberto(c) && (c.vencimento || '') < hojeISO();

/** Dias de atraso da cobrança vencida mais antiga. */
const diasAtraso = (cobrancas) => {
  const vencidas = cobrancas.filter(vencida);
  if (!vencidas.length) return 0;
  const maisAntiga = vencidas.reduce((a, b) => (a.vencimento < b.vencimento ? a : b));
  return Math.floor((Date.now() - new Date(`${maisAntiga.vencimento}T00:00:00`).getTime()) / 86400000);
};

export default function PainelPagamentos() {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [detalhe, setDetalhe] = useState(null); // cliente aberto no histórico

  const { data: clientes = [], isLoading: carregandoClientes } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('nome', 500).catch(() => []),
  });
  const { data: cobrancas = [], isLoading: carregandoCobrancas } = useQuery({
    queryKey: ['cobrancas-saas'],
    queryFn: () => base44.entities.Cobranca.list('-vencimento', 2000).catch(() => []),
  });

  const carregando = carregandoClientes || carregandoCobrancas;

  // Junta cliente + suas cobranças uma vez só; as telas abaixo só leem daqui.
  const linhas = useMemo(() => {
    const porCliente = new Map();
    for (const c of cobrancas) {
      if (!c.cliente_id) continue;
      if (!porCliente.has(c.cliente_id)) porCliente.set(c.cliente_id, []);
      porCliente.get(c.cliente_id).push(c);
    }

    return clientes.map((cli) => {
      const minhas = porCliente.get(cli.id) || [];
      const vencidas = minhas.filter(vencida);
      const aberto = minhas.filter(emAberto);
      const pagas = minhas.filter((c) => c.status === 'pago');
      const atraso = diasAtraso(minhas);

      const situacao = vencidas.length ? 'inadimplente'
        : aberto.length ? 'aguardando'
        : pagas.length ? 'em_dia'
        : 'sem_cobranca';

      return {
        cliente: cli,
        cobrancas: minhas.sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento))),
        situacao,
        atraso,
        totalVencido: vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0),
        totalAberto: aberto.reduce((s, c) => s + (Number(c.valor) || 0), 0),
        totalPago: pagas.reduce((s, c) => s + (Number(c.valor) || 0), 0),
        ultimoPagamento: pagas
          .map((c) => c.data_pagamento)
          .filter(Boolean)
          .sort()
          .pop() || null,
      };
    });
  }, [clientes, cobrancas]);

  const SITUACAO = {
    em_dia: { rotulo: 'Em dia', tom: 'positivo' },
    aguardando: { rotulo: 'A vencer', tom: 'info' },
    inadimplente: { rotulo: 'Inadimplente', tom: 'negativo' },
    sem_cobranca: { rotulo: 'Sem cobrança', tom: 'neutro' },
  };

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      const achou = !q || (l.cliente.nome || '').toLowerCase().includes(q);
      const passa = filtro === 'todos' || l.situacao === filtro;
      return achou && passa;
    });
  }, [linhas, busca, filtro]);

  const pag = usePagination(filtradas, 15);

  const totais = useMemo(() => ({
    inadimplentes: linhas.filter((l) => l.situacao === 'inadimplente').length,
    vencido: linhas.reduce((s, l) => s + l.totalVencido, 0),
    aberto: linhas.reduce((s, l) => s + l.totalAberto, 0),
    recebido: linhas.reduce((s, l) => s + l.totalPago, 0),
  }), [linhas]);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Situação financeira de cada cliente">
        <Link to="/PainelCobrancas" className="w-full sm:w-auto">
          <Button variant="outline" className="w-full gap-2 border-gray-300 text-gray-700">
            Gerenciar cobranças <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </CabecalhoPagina>

      <GradeNumeros>
        <CardNumero rotulo="Inadimplentes" valor={totais.inadimplentes} tom={totais.inadimplentes ? 'negativo' : 'neutro'} detalhe="clientes com atraso" />
        <CardNumero rotulo="Total vencido" valor={fmtBRL(totais.vencido)} tom="negativo" />
        <CardNumero rotulo="Em aberto" valor={fmtBRL(totais.aberto)} tom="info" detalhe="inclui o que ainda vai vencer" />
        <CardNumero rotulo="Já recebido" valor={fmtBRL(totais.recebido)} tom="positivo" detalhe="soma histórica" />
      </GradeNumeros>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 h-11"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); pag.goToPage(1); }}
          />
        </div>
      </div>

      <FiltroPilulas
        valor={filtro}
        onChange={(v) => { setFiltro(v); pag.goToPage(1); }}
        opcoes={[
          ['todos', 'Todos'],
          ['inadimplente', 'Inadimplentes'],
          ['aguardando', 'A vencer'],
          ['em_dia', 'Em dia'],
          ['sem_cobranca', 'Sem cobrança'],
        ]}
      />

      <Painel semPadding>
        {carregando ? (
          <div className="p-4"><TableSkeleton rows={5} /></div>
        ) : filtradas.length === 0 ? (
          <Vazio
            icone={CreditCard}
            titulo={clientes.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente neste filtro'}
            descricao={clientes.length === 0 ? 'Cadastre clientes para acompanhar os pagamentos.' : null}
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Cliente' },
                  { titulo: 'Situação' },
                  { titulo: 'Vencido', alinhamento: 'direita' },
                  { titulo: 'Em aberto', alinhamento: 'direita' },
                  { titulo: 'Último pagamento' },
                  { titulo: '', largura: 'w-24' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {pag.paginatedItems.map((l) => {
                    const s = SITUACAO[l.situacao];
                    return (
                      <tr key={l.cliente.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{l.cliente.nome}</p>
                          <p className="text-xs text-gray-400">{l.cliente.plano} · {fmtBRL(l.cliente.valor_mensal)}/mês</p>
                        </td>
                        <td className="p-3">
                          <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                          {l.atraso > 0 && (
                            <p className="text-xs text-red-500 mt-1">{l.atraso} dia{l.atraso > 1 ? 's' : ''} de atraso</p>
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums font-medium text-red-600">
                          {l.totalVencido > 0 ? fmtBRL(l.totalVencido) : '—'}
                        </td>
                        <td className="p-3 text-right tabular-nums text-gray-700">
                          {l.totalAberto > 0 ? fmtBRL(l.totalAberto) : '—'}
                        </td>
                        <td className="p-3 text-gray-500">{fmtData(l.ultimoPagamento)}</td>
                        <td className="p-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetalhe(l)} className="text-blue-700">
                            Histórico
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {pag.paginatedItems.map((l) => {
                const s = SITUACAO[l.situacao];
                return (
                  <div key={l.cliente.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 break-words">{l.cliente.nome}</p>
                        <p className="text-xs text-gray-400">{l.cliente.plano}</p>
                      </div>
                      <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        {l.totalVencido > 0 ? `Vencido: ${fmtBRL(l.totalVencido)}` : `Em aberto: ${fmtBRL(l.totalAberto)}`}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setDetalhe(l)} className="text-blue-700">
                        Histórico
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Pagination
              currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage}
              startIndex={pag.startIndex} endIndex={pag.endIndex} totalItems={pag.totalItems}
            />
          </>
        )}
      </Painel>

      {/* Histórico do cliente */}
      <Dialog open={!!detalhe} onOpenChange={(o) => { if (!o) setDetalhe(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalhe?.cliente.nome}</DialogTitle>
          </DialogHeader>

          {detalhe && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Vencido</p>
                  <p className="text-base font-bold text-red-600">{fmtBRL(detalhe.totalVencido)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Em aberto</p>
                  <p className="text-base font-bold text-blue-700">{fmtBRL(detalhe.totalAberto)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">Já pago</p>
                  <p className="text-base font-bold text-emerald-700">{fmtBRL(detalhe.totalPago)}</p>
                </div>
              </div>

              {detalhe.cobrancas.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">
                  Nenhuma cobrança lançada para este cliente ainda.
                </p>
              ) : (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <TabelaCabecalho colunas={[
                      { titulo: 'Competência' },
                      { titulo: 'Vencimento' },
                      { titulo: 'Valor', alinhamento: 'direita' },
                      { titulo: 'Situação' },
                    ]} />
                    <tbody className="divide-y divide-gray-100">
                      {detalhe.cobrancas.map((c) => {
                        const tom = c.status === 'pago' ? 'positivo'
                          : c.status === 'cancelado' ? 'neutro'
                          : vencida(c) ? 'negativo' : 'alerta';
                        const rotulo = c.status === 'pago' ? `Pago em ${fmtData(c.data_pagamento)}`
                          : c.status === 'cancelado' ? 'Cancelado'
                          : vencida(c) ? 'Vencido' : 'Pendente';
                        return (
                          <tr key={c.id}>
                            <td className="p-3 text-gray-700">{c.competencia}</td>
                            <td className="p-3 text-gray-500">{fmtData(c.vencimento)}</td>
                            <td className="p-3 text-right tabular-nums font-medium">{fmtBRL(c.valor)}</td>
                            <td className="p-3"><Etiqueta tom={tom}>{rotulo}</Etiqueta></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
                <CircleDollarSign className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800">
                  Esta tela é somente leitura. Para lançar cobrança ou registrar pagamento, use{' '}
                  <Link to="/PainelCobrancas" className="font-semibold underline">Cobranças</Link>.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
