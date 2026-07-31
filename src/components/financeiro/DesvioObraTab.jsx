import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertTriangle, AlertCircle, Info, TrendingUp, TrendingDown, Lock, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton, KpiCardsSkeleton } from '@/components/shared/Skeletons';
import JustificativaDesvioDialog from './JustificativaDesvioDialog';
import FechamentoMesDialog from './FechamentoMesDialog';

// DESVIO DE CUSTO — onde as três metades se encontram.
//
// A leitura que a tela propõe, de cima para baixo:
//
//   1. Onde a obra vai TERMINAR (projeção). É a pergunta que importa: dá tempo
//      de reagir enquanto ainda há obra para executar.
//   2. O que exige atenção agora (alertas).
//   3. Por etapa — para achar o bolso do problema.
//   4. Por serviço — para achar a causa.
//
// O desvio do mês vem depois da projeção de propósito. Saber que se gastou 8% a
// mais em maio é menos útil que saber que a obra caminha para fechar no
// vermelho.

const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtCompact = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const num = (v) => Number(v) || 0;
const pct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(1)}%`);

const ICONE_ALERTA = { critico: AlertCircle, atencao: AlertTriangle, info: Info };
const CLASSE_ALERTA = {
  critico: 'bg-red-50 border-red-200 text-red-800',
  atencao: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

// Gastar MAIS que o previsto é ruim; gastar menos é bom — mas só até certo
// ponto, porque muito abaixo costuma ser despesa não lançada (o alerta cobre).
const corDesvio = (d) => (d == null ? 'text-gray-400' : d > 0 ? 'text-red-600' : 'text-emerald-600');

function Kpi({ rotulo, valor, sub, cor = 'text-gray-900', fundo = 'bg-white border-gray-200' }) {
  return (
    <Card className={fundo}>
      <CardContent className="p-3 sm:p-4">
        <p className="text-gray-500 text-xs sm:text-sm mb-1">{rotulo}</p>
        <p className={`text-lg sm:text-xl font-bold truncate ${cor}`}>{valor}</p>
        {sub && <p className="text-gray-400 text-[11px] mt-1 leading-tight">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DesvioObraTab({ obraId, podeEditar = true }) {
  const [busca, setBusca] = useState('');
  const [soAtencao, setSoAtencao] = useState(false);
  const [justificando, setJustificando] = useState(null);
  const [abrindoFechamento, setAbrindoFechamento] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['desvio-obra', obraId],
    queryFn: async () => {
      const r = await base44.functions.invoke('getDesvioObra', { obra_id: obraId });
      return r.data;
    },
    enabled: !!obraId,
  });

  const servicos = useMemo(() => {
    let l = data?.servicos || [];
    if (soAtencao) l = l.filter((s) => s.comparavel && (Math.abs(num(s.desvio_pct)) >= 10 || s.excesso_acima_do_limite));
    const q = busca.trim().toLowerCase();
    if (q) l = l.filter((s) => `${s.codigo} ${s.descricao} ${s.etapa}`.toLowerCase().includes(q));
    // Maior desvio em VALOR primeiro: é onde há dinheiro em jogo. Percentual
    // alto sobre base pequena chama atenção para o lugar errado.
    return [...l].sort((a, b) => Math.abs(num(b.desvio)) - Math.abs(num(a.desvio)));
  }, [data, busca, soAtencao]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } =
    usePagination(servicos, 15);

  if (isLoading) {
    return <div className="space-y-4"><KpiCardsSkeleton count={4} /><TableSkeleton rows={10} cols={7} /></div>;
  }

  if (data?.sem_contrato) {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="p-6 text-sm text-amber-800">
          <p className="font-medium mb-1">Esta obra ainda não tem contrato ativo.</p>
          <p>O desvio é medido contra o custo previsto congelado no contrato. Gere o contrato a partir do orçamento.</p>
        </CardContent>
      </Card>
    );
  }

  const t = data?.totais;
  if (!t) return null;

  const projetadoRuim = num(t.margem_projetada_pct) < num(t.margem_prevista_pct);

  return (
    <div className="space-y-4">
      {/* Competência em análise e o estado do fechamento */}
      <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded-lg bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Competência</span>
          <span className="font-semibold text-gray-900">{data.competencia}</span>
          {data.fechamento?.status === 'fechado' && (
            <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-300 text-[10px]">
              <Lock className="w-3 h-3 mr-1" /> mês fechado
            </Badge>
          )}
          {data.fechamento?.status === 'reaberto' && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">reaberto</Badge>
          )}
          {num(t.pendentes_justificativa) > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
              {t.pendentes_justificativa} sem justificativa
            </Badge>
          )}
          {num(t.exigem_justificativa) > 0 && num(t.pendentes_justificativa) === 0 && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
              <CheckCircle2 className="w-3 h-3 mr-1" /> desvios justificados
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setAbrindoFechamento(true)} disabled={!podeEditar}>
          <Lock className="w-3.5 h-3.5 mr-1.5" />
          {data.fechamento?.status === 'fechado' ? 'Ver fechamento' : 'Fechar o mês'}
        </Button>
      </div>

      {/* 1 · Onde a obra vai terminar */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Projeção de encerramento</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Kpi
            rotulo="Custo final projetado"
            valor={fmt(t.custo_final_projetado)}
            sub={`real ${fmtCompact(t.custo_real_obra)} + pendente ${fmtCompact(t.custo_pendente)}`}
          />
          <Kpi
            rotulo="Resultado projetado"
            valor={fmt(t.resultado_projetado)}
            sub={`sobre ${fmtCompact(t.venda_contrato)} de contrato`}
            cor={num(t.resultado_projetado) < 0 ? 'text-red-600' : 'text-emerald-600'}
            fundo={num(t.resultado_projetado) < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}
          />
          <Kpi
            rotulo="Margem projetada"
            valor={pct(t.margem_projetada_pct)}
            sub={`orçada ${pct(t.margem_prevista_pct)}`}
            cor={num(t.margem_projetada_pct) < 0 ? 'text-red-600' : projetadoRuim ? 'text-amber-600' : 'text-emerald-600'}
          />
          <Kpi
            rotulo="Avanço medido"
            valor={`${num(t.avanco_pct).toFixed(0)}%`}
            sub={data?.ultima_bm ? `até a BM ${data.ultima_bm.numero} · ${fmtCompact(t.receita_medida)}` : 'sem BM aprovada'}
          />
        </div>
      </div>

      {/* 2 · O que exige atenção */}
      {data?.alertas?.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => {
            const Icone = ICONE_ALERTA[a.nivel] || Info;
            return (
              <div key={i} className={`flex items-start gap-2 border rounded-lg p-2.5 text-xs ${CLASSE_ALERTA[a.nivel] || CLASSE_ALERTA.info}`}>
                <Icone className="w-4 h-4 shrink-0 mt-px" />
                <span><strong className="font-semibold">{a.titulo}.</strong> {a.texto}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Desvio do período executado */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Desvio do que já foi executado</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
          <Kpi rotulo="Deveria ter custado" valor={fmt(t.custo_previsto_executado)} sub="medido × custo previsto" />
          <Kpi
            rotulo="Custo apontado"
            valor={fmt(t.custo_real_apontado)}
            sub={
              num(t.custo_nao_apontavel) > 0
                ? `${num(t.cobertura_apontamento).toFixed(0)}% do custo real · ${fmtCompact(t.custo_nao_apontavel)} em folha/frota ainda não apontáveis`
                : `${num(t.cobertura_apontamento).toFixed(0)}% do custo real classificado`
            }
          />
          <Kpi
            rotulo="Desvio"
            valor={fmt(t.desvio)}
            sub={pct(t.desvio_pct)}
            cor={corDesvio(t.desvio)}
            fundo={num(t.desvio) > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}
          />
          <Kpi
            rotulo="Serviços comparáveis"
            valor={`${t.servicos_comparaveis} de ${t.servicos_total}`}
            sub="com medição e custo apontado"
          />
        </div>
      </div>

      {/* 3 · Por etapa */}
      {data?.etapas?.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-gray-500 text-xs">
                <th className="text-left p-3 font-medium">Etapa</th>
                <th className="text-right p-3 font-medium hidden sm:table-cell">Deveria custar</th>
                <th className="text-right p-3 font-medium hidden sm:table-cell">Custou</th>
                <th className="text-right p-3 font-medium">Desvio</th>
                <th className="text-right p-3 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {data.etapas.slice(0, 8).map((e) => (
                <tr key={e.etapa} className="border-b border-gray-100 last:border-0">
                  <td className="p-3 text-gray-900 max-w-[240px] truncate">{e.etapa}</td>
                  <td className="p-3 text-right tabular-nums text-gray-600 hidden sm:table-cell">{fmt(e.custo_previsto_executado)}</td>
                  <td className="p-3 text-right tabular-nums text-gray-600 hidden sm:table-cell">{fmt(e.custo_real)}</td>
                  <td className={`p-3 text-right tabular-nums font-semibold ${corDesvio(e.desvio)}`}>{e.comparaveis ? fmt(e.desvio) : '—'}</td>
                  <td className={`p-3 text-right tabular-nums ${corDesvio(e.desvio)}`}>{e.comparaveis ? pct(e.desvio_pct) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 4 · Por serviço */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Buscar serviço ou etapa..." value={busca} onChange={(e) => setBusca(e.target.value)} className="sm:max-w-xs" />
        <Button type="button" size="sm" variant={soAtencao ? 'default' : 'outline'} onClick={() => setSoAtencao((v) => !v)}>
          {soAtencao ? 'Mostrando só os críticos' : 'Só desvios relevantes'}
        </Button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr className="text-gray-500 text-xs">
              <th className="text-left p-3 font-medium">Serviço</th>
              <th className="text-right p-3 font-medium hidden lg:table-cell">Avanço</th>
              <th className="text-right p-3 font-medium hidden md:table-cell">Deveria custar</th>
              <th className="text-right p-3 font-medium hidden md:table-cell">Custou</th>
              <th className="text-right p-3 font-medium">Desvio</th>
              <th className="text-right p-3 font-medium hidden sm:table-cell">Falta gastar</th>
              <th className="text-center p-3 font-medium">Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((s) => (
              <tr key={s.contrato_item_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-3 max-w-[260px]">
                  <p className="truncate text-gray-900">{s.codigo ? `${s.codigo} · ` : ''}{s.descricao}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400 truncate">{s.etapa}</span>
                    {s.excesso_acima_do_limite && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                        medido {s.excesso_pct.toFixed(0)}% acima do contrato
                      </Badge>
                    )}
                    {s.sem_custo_previsto && (
                      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-[10px]">sem linha-base</Badge>
                    )}
                    {!s.comparavel && !s.sem_custo_previsto && s.qtd_medida > 0 && s.sem_apontamento && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">custo não apontado</Badge>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right tabular-nums text-gray-500 hidden lg:table-cell">{num(s.avanco_pct).toFixed(0)}%</td>
                <td className="p-3 text-right tabular-nums text-gray-600 hidden md:table-cell">{fmt(s.custo_previsto_executado)}</td>
                <td className="p-3 text-right tabular-nums text-gray-600 hidden md:table-cell">{fmt(s.custo_real)}</td>
                <td className={`p-3 text-right tabular-nums font-semibold ${corDesvio(s.comparavel ? s.desvio : null)}`}>
                  {s.comparavel ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      {s.desvio > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {pct(s.desvio_pct)}
                    </span>
                  ) : '—'}
                </td>
                <td className="p-3 text-right tabular-nums text-gray-500 hidden sm:table-cell">{fmt(s.custo_pendente)}</td>
                <td className="p-3 text-center">
                  {!s.exige_justificativa && !s.justificativa ? (
                    <span className="text-gray-300 text-xs">—</span>
                  ) : s.pendente_justificativa ? (
                    <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 h-7 text-xs"
                      onClick={() => setJustificando(s)} disabled={!podeEditar}>
                      <MessageSquarePlus className="w-3.5 h-3.5 mr-1" />
                      {s.justificativa?.defasada ? 'Rever' : 'Justificar'}
                    </Button>
                  ) : (
                    <button type="button" onClick={() => setJustificando(s)} disabled={!podeEditar}
                      className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline disabled:no-underline">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {s.justificativa?.natureza === 'recorrente' ? 'recorrente' : 'pontual'}
                      {s.justificativa?.acao === 'plano_acao' && ' · plano'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {servicos.length === 0 && (
          <p className="p-6 text-center text-sm text-gray-400">Nenhum serviço com esses filtros.</p>
        )}
      </div>
      {servicos.length > 0 && (
        <Pagination
          currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage}
          startIndex={startIndex} endIndex={endIndex} totalItems={totalItems}
        />
      )}

      {justificando && (
        <JustificativaDesvioDialog
          obraId={obraId}
          competencia={data.competencia}
          servico={justificando}
          onFechar={() => setJustificando(null)}
        />
      )}
      {abrindoFechamento && (
        <FechamentoMesDialog
          obraId={obraId}
          competencia={data.competencia}
          onFechar={() => setAbrindoFechamento(false)}
        />
      )}
    </div>
  );
}
