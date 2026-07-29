import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { FileBarChart, Activity, TrendingDown, Timer } from 'lucide-react';
import {
  CabecalhoPagina, CardNumero, GradeNumeros, Etiqueta, Painel, Vazio,
  TabelaCabecalho, FiltroPilulas, fmtDataHora,
} from '@/components/painel/ui';

// RELATÓRIOS DE INTEGRAÇÕES — o histórico dos testes.
//
// Enquanto "Clientes › Integrações" mostra o estado AGORA, aqui se olha o
// comportamento ao longo do tempo: quem cai com frequência, quem está lento e
// quando foi o último problema. É leitura pura sobre LogIntegracao.

const STATUS = {
  online: { rotulo: 'No ar', tom: 'positivo' },
  instavel: { rotulo: 'Instável', tom: 'alerta' },
  offline: { rotulo: 'Fora do ar', tom: 'negativo' },
};

const PERIODOS = [
  ['7', 'Últimos 7 dias'],
  ['30', 'Últimos 30 dias'],
  ['todos', 'Tudo'],
];

export default function PainelRelatoriosIntegracoes() {
  const [periodo, setPeriodo] = useState('7');
  const [instancia, setInstancia] = useState('todas');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['logs-integracao'],
    queryFn: () => base44.entities.LogIntegracao.list('-testado_em', 2000).catch(() => []),
  });
  const { data: instancias = [] } = useQuery({
    queryKey: ['instancias-cliente'],
    queryFn: () => base44.entities.InstanciaCliente.list('nome', 500).catch(() => []),
  });

  const filtrados = useMemo(() => {
    const limite = periodo === 'todos'
      ? null
      : new Date(Date.now() - Number(periodo) * 86400000).toISOString();
    return logs.filter((l) => {
      const noPeriodo = !limite || (l.testado_em || '') >= limite;
      const daInstancia = instancia === 'todas' || l.instancia_id === instancia;
      return noPeriodo && daInstancia;
    });
  }, [logs, periodo, instancia]);

  const resumo = useMemo(() => {
    const total = filtrados.length;
    const ok = filtrados.filter((l) => l.status === 'online').length;
    const falhas = total - ok;
    const tempos = filtrados.filter((l) => l.status === 'online' && l.tempo_ms != null).map((l) => l.tempo_ms);
    const media = tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null;

    // Ranking de quem mais falhou — é o que orienta onde agir primeiro.
    const porInstancia = new Map();
    for (const l of filtrados) {
      const chave = l.instancia_id || l.instancia_nome || '—';
      if (!porInstancia.has(chave)) {
        porInstancia.set(chave, { nome: l.instancia_nome || '—', cliente: l.cliente_nome || '—', total: 0, falhas: 0, soma: 0, comTempo: 0 });
      }
      const r = porInstancia.get(chave);
      r.total += 1;
      if (l.status !== 'online') r.falhas += 1;
      if (l.tempo_ms != null && l.status === 'online') { r.soma += l.tempo_ms; r.comTempo += 1; }
    }

    const ranking = [...porInstancia.values()]
      .map((r) => ({
        ...r,
        disponibilidade: r.total ? Math.round(((r.total - r.falhas) / r.total) * 100) : 0,
        tempoMedio: r.comTempo ? Math.round(r.soma / r.comTempo) : null,
      }))
      .sort((a, b) => a.disponibilidade - b.disponibilidade || b.falhas - a.falhas);

    return {
      total,
      falhas,
      disponibilidade: total ? Math.round((ok / total) * 100) : null,
      media,
      ranking,
    };
  }, [filtrados]);

  const pag = usePagination(filtrados, 20);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Histórico dos testes de conexão com as instalações" />

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <FiltroPilulas valor={periodo} onChange={(v) => { setPeriodo(v); pag.goToPage(1); }} opcoes={PERIODOS} />
        <Select value={instancia} onValueChange={(v) => { setInstancia(v); pag.goToPage(1); }}>
          <SelectTrigger className="h-11 w-full sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as instâncias</SelectItem>
            {instancias.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <GradeNumeros>
        <CardNumero rotulo="Testes no período" valor={resumo.total} icone={Activity} />
        <CardNumero
          rotulo="Disponibilidade"
          valor={resumo.disponibilidade == null ? '—' : `${resumo.disponibilidade}%`}
          tom={resumo.disponibilidade == null ? 'neutro' : resumo.disponibilidade >= 99 ? 'positivo' : resumo.disponibilidade >= 90 ? 'alerta' : 'negativo'}
          detalhe="testes que responderam"
        />
        <CardNumero rotulo="Falhas" valor={resumo.falhas} tom={resumo.falhas ? 'negativo' : 'neutro'} icone={TrendingDown} />
        <CardNumero rotulo="Tempo médio" valor={resumo.media == null ? '—' : `${resumo.media} ms`} icone={Timer} detalhe="só respostas com sucesso" />
      </GradeNumeros>

      {/* Ranking por instância */}
      <Painel titulo="Por instância">
        {resumo.ranking.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Sem testes no período selecionado.</p>
        ) : (
          <div className="space-y-2">
            {resumo.ranking.map((r) => (
              <div key={r.nome} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.nome}</p>
                  <p className="text-xs text-gray-400 truncate">{r.cliente}</p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className={`text-sm font-semibold tabular-nums ${
                      r.disponibilidade >= 99 ? 'text-emerald-700' : r.disponibilidade >= 90 ? 'text-amber-700' : 'text-red-600'
                    }`}>
                      {r.disponibilidade}%
                    </p>
                    <p className="text-xs text-gray-400">{r.total} teste(s)</p>
                  </div>
                  <div className="hidden sm:block text-right w-20">
                    <p className="text-sm tabular-nums text-gray-700">{r.tempoMedio == null ? '—' : `${r.tempoMedio} ms`}</p>
                    <p className="text-xs text-gray-400">médio</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Painel>

      {/* Histórico */}
      <Painel semPadding>
        {isLoading ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : filtrados.length === 0 ? (
          <Vazio
            icone={FileBarChart}
            titulo="Nenhum teste registrado"
            descricao="Os testes de conexão feitos em Clientes › Integrações aparecem aqui."
          />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <TabelaCabecalho colunas={[
                  { titulo: 'Quando' }, { titulo: 'Instância' }, { titulo: 'Cliente' },
                  { titulo: 'Resultado' }, { titulo: 'Tempo', alinhamento: 'direita' }, { titulo: 'Detalhe' },
                ]} />
                <tbody className="divide-y divide-gray-100">
                  {pag.paginatedItems.map((l) => {
                    const s = STATUS[l.status] || { rotulo: l.status || '—', tom: 'neutro' };
                    return (
                      <tr key={l.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-600 whitespace-nowrap">{fmtDataHora(l.testado_em)}</td>
                        <td className="p-3 font-medium text-gray-900">{l.instancia_nome || '—'}</td>
                        <td className="p-3 text-gray-600">{l.cliente_nome || '—'}</td>
                        <td className="p-3"><Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta></td>
                        <td className="p-3 text-right tabular-nums text-gray-700">
                          {l.tempo_ms != null ? `${l.tempo_ms} ms` : '—'}
                        </td>
                        <td className="p-3 text-gray-500 max-w-[240px] truncate" title={l.erro || ''}>
                          {l.erro || (l.http_status ? `HTTP ${l.http_status}` : '—')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-100">
              {pag.paginatedItems.map((l) => {
                const s = STATUS[l.status] || { rotulo: l.status || '—', tom: 'neutro' };
                return (
                  <div key={l.id} className="p-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-gray-900 break-words">{l.instancia_nome}</p>
                      <Etiqueta tom={s.tom}>{s.rotulo}</Etiqueta>
                    </div>
                    <p className="text-xs text-gray-500">
                      {fmtDataHora(l.testado_em)} · {l.tempo_ms != null ? `${l.tempo_ms} ms` : '—'}
                    </p>
                    {l.erro && <p className="text-xs text-red-500 break-words">{l.erro}</p>}
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
    </div>
  );
}
