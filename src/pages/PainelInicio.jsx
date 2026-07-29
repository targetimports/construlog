import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Receipt, TrendingUp, AlertTriangle, ArrowRight } from 'lucide-react';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import {
  CabecalhoPagina, fmtBRL, fmtData, hojeISO as hoje, competenciaAtual as competencia,
} from '@/components/painel/ui';

// VISÃO GERAL DO NEGÓCIO — quanto entra por mês, quem está devendo e quem
// vence nos próximos dias. É a primeira tela de quem abre o painel.

const emDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

const vencida = (c) => c.status !== 'pago' && c.status !== 'cancelado' && (c.vencimento || '') < hoje();

export default function PainelInicio() {
  const { data: clientes = [], isLoading: carregandoClientes } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('-created_date', 500).catch(() => []),
  });
  const { data: cobrancas = [], isLoading: carregandoCobrancas } = useQuery({
    queryKey: ['cobrancas-saas'],
    queryFn: () => base44.entities.Cobranca.list('-vencimento', 1000).catch(() => []),
  });

  const carregando = carregandoClientes || carregandoCobrancas;

  const dados = useMemo(() => {
    const comp = competencia();
    const ativos = clientes.filter((c) => c.status === 'ativo');
    const doMes = cobrancas.filter((c) => c.competencia === comp);
    const vencidas = cobrancas.filter(vencida);
    const proximas = cobrancas
      .filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
      .filter((c) => (c.vencimento || '') >= hoje() && (c.vencimento || '') <= emDias(7))
      .sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));

    return {
      mrr: ativos.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
      ativos: ativos.length,
      emTeste: clientes.filter((c) => c.status === 'teste').length,
      recebidoMes: doMes.filter((c) => c.status === 'pago').reduce((s, c) => s + (Number(c.valor) || 0), 0),
      vencidas,
      totalVencido: vencidas.reduce((s, c) => s + (Number(c.valor) || 0), 0),
      proximas,
    };
  }, [clientes, cobrancas]);

  if (carregando) {
    return (
      <div className="space-y-6">
        <CabecalhoPagina subtitulo="Assinaturas do Construlog" />
        <KpiCardsSkeleton />
      </div>
    );
  }

  const semDados = clientes.length === 0;

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Assinaturas do Construlog" />

      {semDados ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-16 text-center">
            <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-900">Nenhum cliente cadastrado ainda</p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Cadastre a primeira construtora que assinou o sistema para começar a
              acompanhar receita e cobranças.
            </p>
            <Link to="/PainelClientes">
              <Button className="mt-6 gap-2 bg-blue-600 hover:bg-blue-700">
                Cadastrar cliente <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-white border-gray-200"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Receita recorrente</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{fmtBRL(dados.mrr)}</p>
              <p className="text-xs text-gray-400 mt-0.5">por mês, clientes ativos</p>
            </CardContent></Card>

            <Card className="bg-white border-gray-200"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Clientes ativos</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{dados.ativos}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dados.emTeste} em teste</p>
            </CardContent></Card>

            <Card className="bg-white border-gray-200"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Recebido no mês</span>
              </div>
              <p className="text-xl font-bold text-blue-700">{fmtBRL(dados.recebidoMes)}</p>
            </CardContent></Card>

            <Card className="bg-white border-gray-200"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">Em atraso</span>
              </div>
              <p className="text-xl font-bold text-red-600">{fmtBRL(dados.totalVencido)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{dados.vencidas.length} cobrança(s)</p>
            </CardContent></Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Em atraso */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Em atraso</h2>
                  <Link to="/PainelCobrancas" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                    Ver cobranças
                  </Link>
                </div>
                {dados.vencidas.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Ninguém em atraso. </p>
                ) : (
                  <div className="space-y-2">
                    {dados.vencidas.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.cliente_nome}</p>
                          <p className="text-xs text-gray-400">venceu em {fmtData(c.vencimento)}</p>
                        </div>
                        <span className="text-sm font-semibold text-red-600 tabular-nums shrink-0">{fmtBRL(c.valor)}</span>
                      </div>
                    ))}
                    {dados.vencidas.length > 5 && (
                      <p className="text-xs text-gray-400 pt-1">e mais {dados.vencidas.length - 5}…</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Próximos vencimentos */}
            <Card className="bg-white border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Vence nos próximos 7 dias</h2>
                </div>
                {dados.proximas.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 text-center">Nada vencendo nesta semana.</p>
                ) : (
                  <div className="space-y-2">
                    {dados.proximas.slice(0, 5).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{c.cliente_nome}</p>
                          <p className="text-xs text-gray-400">vence em {fmtData(c.vencimento)}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 tabular-nums shrink-0">{fmtBRL(c.valor)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Clientes recentes */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Clientes recentes</h2>
                <Link to="/PainelClientes" className="text-sm font-medium text-blue-600 hover:text-blue-700">
                  Ver todos
                </Link>
              </div>
              <div className="space-y-2">
                {clientes.slice(0, 5).map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.plano} · {fmtBRL(c.valor_mensal)}/mês</p>
                    </div>
                    <Badge className={`border-0 shrink-0 ${
                      c.status === 'ativo' ? 'bg-emerald-100 text-emerald-800'
                        : c.status === 'teste' ? 'bg-blue-100 text-blue-800'
                        : c.status === 'suspenso' ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.status === 'ativo' ? 'Ativo' : c.status === 'teste' ? 'Em teste' : c.status === 'suspenso' ? 'Suspenso' : 'Cancelado'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
