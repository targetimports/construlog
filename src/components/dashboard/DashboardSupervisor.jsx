import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import {
  Building2, Ruler, NotebookPen, ClipboardList, ArrowUpRight, AlertTriangle, TrendingUp,
} from 'lucide-react';

// Dashboard do SUPERVISOR — quem responde pelo ANDAMENTO das obras.
//
// Foco em execução e medição: avanço físico por obra, medições paradas em rascunho
// (dinheiro que não foi faturado) e diário do dia. Sem RH e sem relatórios, que
// saíram do escopo dele.
//
// A lista de obras já vem recortada pelo filtro "só as minhas obras".

const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');
const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function DashboardSupervisor() {
  const navigate = useNavigate();
  const hoje = hojeISO();

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 500).catch(() => []),
  });
  const { data: bms = [] } = useQuery({
    queryKey: ['bms-supervisor'],
    queryFn: () => base44.entities.BM.list('-created_date', 500).catch(() => []),
  });
  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-supervisor'],
    queryFn: () => base44.entities.DiarioObra.list('-data', 300).catch(() => []),
  });
  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-supervisor'],
    queryFn: () => base44.entities.RequisicaoObra.list('-data_requisicao', 500).catch(() => []),
  });

  const obraIds = useMemo(() => new Set(obras.map((o) => o.id)), [obras]);
  const noEscopo = (lista) => lista.filter((x) => obraIds.has(x.obra_id));

  const emAndamento = useMemo(() => obras.filter((o) => o.status === 'em_andamento'), [obras]);

  // Medição em RASCUNHO = serviço executado que ainda não virou faturamento.
  const bmsRascunho = useMemo(
    () => noEscopo(bms).filter((b) => String(b.status).toUpperCase() === 'RASCUNHO'),
    [bms, obraIds],
  );
  const diariosHoje = useMemo(
    () => noEscopo(diarios).filter((d) => String(d.data || '').slice(0, 10) === hoje),
    [diarios, obraIds, hoje],
  );
  const semDiarioHoje = Math.max(0, emAndamento.length - diariosHoje.length);
  const requisicoesAbertas = useMemo(
    () => noEscopo(requisicoes).filter((r) => ['ENVIADA', 'APROVADA', 'EM_TRANSITO'].includes(r.status)),
    [requisicoes, obraIds],
  );

  // Avanço = medido acumulado (BM aprovada) ÷ valor de contrato.
  const avancoPorObra = useMemo(() => obras.map((o) => {
    const doObra = bms.filter((b) => b.obra_id === o.id && String(b.status).toUpperCase() === 'APROVADA');
    const medido = doObra.reduce((mx, b) => Math.max(mx, Number(b.total_acumulado) || 0), 0);
    const contrato = Number(o.valor_contrato) || Number(o.valor_orcado) || 0;
    return { obra: o, medido, contrato, pct: contrato > 0 ? Math.min(100, (medido / contrato) * 100) : 0 };
  }).sort((a, b) => b.pct - a.pct), [obras, bms]);

  const Kpi = ({ titulo, valor, sub, icone: Icone, cor, para }) => (
    <Card className="bg-white border-gray-200 cursor-pointer transition hover:border-blue-300"
      onClick={() => navigate(createPageUrl(para))}>
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

  if (isLoading) return <KpiCardsSkeleton count={4} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi titulo="Obras em andamento" valor={emAndamento.length} sub={`${obras.length} no total`}
          icone={Building2} cor="text-blue-600" para="Obras" />
        <Kpi titulo="Medições em rascunho" valor={bmsRascunho.length} sub="ainda não faturadas"
          icone={Ruler} cor={bmsRascunho.length > 0 ? 'text-amber-600' : 'text-emerald-600'} para="Obras" />
        <Kpi titulo="Diários de hoje" valor={`${diariosHoje.length}/${emAndamento.length}`}
          sub={semDiarioHoje > 0 ? `${semDiarioHoje} pendente(s)` : 'tudo registrado'}
          icone={NotebookPen} cor={semDiarioHoje > 0 ? 'text-amber-600' : 'text-emerald-600'} para="DiarioObra" />
        <Kpi titulo="Requisições abertas" valor={requisicoesAbertas.length} sub="material das obras"
          icone={ClipboardList} cor="text-purple-600" para="SuprimentosRequisicoes" />
      </div>

      {bmsRascunho.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{bmsRascunho.length}</strong> medição(ões) em rascunho — serviço executado que ainda
            não virou faturamento. Revise e aprove para liberar o recebimento.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Avanço físico — a leitura principal de quem supervisiona. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Avanço das obras</CardTitle>
            <button type="button" onClick={() => navigate(createPageUrl('Obras'))}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ver todas <ArrowUpRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent>
            {obras.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhuma obra no seu escopo.</p>
            ) : (
              <ul className="space-y-3">
                {avancoPorObra.slice(0, 6).map(({ obra, medido, contrato, pct }) => (
                  <li key={obra.id} className="cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-1 rounded"
                    onClick={() => navigate(`${createPageUrl('ObraDetalhes')}?id=${obra.id}`)}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm text-gray-900 truncate">{obra.nome}</p>
                      <span className="text-xs font-medium text-gray-700 tabular-nums shrink-0">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {brl(medido)} medido {contrato > 0 ? `de ${brl(contrato)}` : '(sem contrato)'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Medições paradas — o que trava o faturamento. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Medições a revisar</CardTitle>
          </CardHeader>
          <CardContent>
            {bmsRascunho.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhuma medição pendente.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {bmsRascunho.slice(0, 6).map((b) => {
                  const obra = obras.find((o) => o.id === b.obra_id);
                  return (
                    <li key={b.id}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                      onClick={() => navigate(`${createPageUrl('ObraDetalhes')}?id=${b.obra_id}`)}>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{obra?.nome || 'Obra'}</p>
                        <p className="text-xs text-gray-500">
                          BM #{b.numero || '—'} · {dataBR(b.data_medicao || b.created_date)}
                        </p>
                      </div>
                      <Badge className="bg-amber-100 text-amber-700 shrink-0">Rascunho</Badge>
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
            { page: 'Obras', nome: 'Minhas Obras', icone: Building2, cor: 'text-blue-600' },
            { page: 'DiarioObra', nome: 'Diário de Obra', icone: NotebookPen, cor: 'text-emerald-600' },
            { page: 'SuprimentosRequisicoes', nome: 'Requisições de Material', icone: ClipboardList, cor: 'text-amber-600' },
          ].map((a) => (
            <button key={a.page} type="button" onClick={() => navigate(createPageUrl(a.page))}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-left">
              <a.icone className={`h-5 w-5 ${a.cor}`} />
              <span className="font-medium text-sm text-gray-800">{a.nome}</span>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
