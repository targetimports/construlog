import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import {
  Building2, Users, ClipboardList, PackageCheck, NotebookPen, ArrowUpRight, AlertTriangle,
} from 'lucide-react';

// Dashboard do ENCARREGADO — o que ele resolve no canteiro, hoje.
//
// A lista de obras já vem recortada pelo filtro "só as minhas obras" (obraScope):
// ele enxerga apenas onde tem vínculo, então tudo aqui é do escopo dele.
//
// Foco: ponto do dia (o que atrasa a folha), material a receber (o que trava o
// serviço) e diário de obra (o registro que o cliente cobra).

const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function DashboardEncarregado() {
  const navigate = useNavigate();
  const hoje = hojeISO();

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 500).catch(() => []),
  });
  const obraIds = useMemo(() => new Set(obras.map((o) => o.id)), [obras]);

  // Ponto de hoje nas obras dele.
  const { data: pontosHoje = [] } = useQuery({
    queryKey: ['ponto-hoje-encarregado', hoje],
    queryFn: () => base44.entities.ApontamentoMaoObra.filter({ data: hoje }).catch(() => []),
  });
  // Equipe vinculada às obras dele (quem deveria ter ponto hoje).
  const { data: vinculos = [] } = useQuery({
    queryKey: ['vinculos-encarregado'],
    queryFn: () => base44.entities.ObraColaborador.list('-created_date', 5000).catch(() => []),
  });

  const { data: requisicoes = [] } = useQuery({
    queryKey: ['requisicoes-encarregado'],
    queryFn: () => base44.entities.RequisicaoObra.list('-data_requisicao', 500).catch(() => []),
  });

  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-encarregado'],
    queryFn: () => base44.entities.DiarioObra.list('-data', 200).catch(() => []),
  });

  const doEscopo = (lista) => lista.filter((x) => !x.obra_id || obraIds.has(x.obra_id));

  const equipeAtiva = useMemo(
    () => doEscopo(vinculos).filter((v) => (v.status || 'ativo') !== 'inativo' && obraIds.has(v.obra_id)),
    [vinculos, obraIds],
  );
  const pontosDoDia = useMemo(() => doEscopo(pontosHoje), [pontosHoje, obraIds]);
  const semPonto = Math.max(0, equipeAtiva.length - pontosDoDia.length);

  // Material a caminho: já saiu do estoque e a obra precisa CONFERIR no recebimento.
  const aReceber = useMemo(
    () => doEscopo(requisicoes).filter((r) => r.status === 'EM_TRANSITO'),
    [requisicoes, obraIds],
  );
  const requisicoesAbertas = useMemo(
    () => doEscopo(requisicoes).filter((r) => ['ENVIADA', 'APROVADA'].includes(r.status)),
    [requisicoes, obraIds],
  );
  const diarioHoje = useMemo(
    () => doEscopo(diarios).filter((d) => String(d.data || '').slice(0, 10) === hoje),
    [diarios, obraIds, hoje],
  );

  // Borda igual em todos os cartões: o alerta já aparece na cor do ícone e do
  // subtítulo. Destacar a borda de um só quebrava o alinhamento visual da grade.
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
        <Kpi titulo="Minhas obras" valor={obras.length} sub="onde você atua"
          icone={Building2} cor="text-blue-600" para="Obras" />
        <Kpi titulo="Ponto de hoje" valor={`${pontosDoDia.length}/${equipeAtiva.length}`}
          sub={semPonto > 0 ? `${semPonto} sem lançar` : 'tudo lançado'}
          icone={Users} cor={semPonto > 0 ? 'text-amber-600' : 'text-emerald-600'}
          para="Obras" />
        <Kpi titulo="Material a receber" valor={aReceber.length} sub="a caminho da obra"
          icone={PackageCheck} cor="text-purple-600" para="Obras" />
        <Kpi titulo="Requisições abertas" valor={requisicoesAbertas.length} sub="aguardando a Central"
          icone={ClipboardList} cor="text-gray-600" para="SuprimentosRequisicoes" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Obras dele — porta de entrada para ponto, diário e recebimento. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Minhas obras</CardTitle>
            <button type="button" onClick={() => navigate(createPageUrl('Obras'))}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ver todas <ArrowUpRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent>
            {obras.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Você ainda não está vinculado a nenhuma obra.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {obras.slice(0, 6).map((o) => {
                  const temDiario = diarioHoje.some((d) => d.obra_id === o.id);
                  return (
                    <li key={o.id}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                      onClick={() => navigate(`${createPageUrl('ObraDetalhes')}?id=${o.id}`)}>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{o.nome}</p>
                        <p className="text-xs text-gray-500">{o.cidade || '—'}{o.estado ? `/${o.estado}` : ''}</p>
                      </div>
                      {temDiario
                        ? <Badge className="bg-emerald-100 text-emerald-700 shrink-0">Diário feito</Badge>
                        : <Badge className="bg-gray-100 text-gray-600 shrink-0">Sem diário hoje</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Material a caminho — é o que trava serviço se ninguém conferir. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Material a receber</CardTitle>
          </CardHeader>
          <CardContent>
            {aReceber.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum material a caminho.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {aReceber.slice(0, 6).map((r) => (
                  <li key={r.id}
                    className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                    onClick={() => navigate(`${createPageUrl('ObraDetalhes')}?id=${r.obra_id}&secao=materiais`)}>
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{r.obra_nome || 'Obra'}</p>
                      <p className="text-xs text-gray-500">Enviado em {dataBR(r.data_envio)}</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700 shrink-0">Conferir</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {semPonto > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{semPonto}</strong> colaborador(es) ainda sem ponto lançado hoje. O ponto é o que
            alimenta a folha e o custo da obra — lance em Equipe &amp; Diário → Presença / Ponto.
          </span>
        </div>
      )}

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
