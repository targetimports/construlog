import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import { Building2, NotebookPen, CalendarCheck, ArrowUpRight, AlertTriangle } from 'lucide-react';

// Dashboard do OPERACIONAL — o perfil de campo que registra o DIÁRIO DE OBRA.
//
// Permissões dele hoje: ver obras e criar diário. Nada de estoque, compras,
// financeiro ou equipe — então o painel mostra só o que ele consegue abrir. A
// lista de obras já vem recortada pelo filtro "só as minhas obras".

const hojeISO = () => new Date().toISOString().slice(0, 10);
const dataBR = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

export default function DashboardOperacional() {
  const navigate = useNavigate();
  const hoje = hojeISO();

  const { data: obras = [], isLoading } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list('-created_date', 500).catch(() => []),
  });
  const { data: diarios = [] } = useQuery({
    queryKey: ['diarios-operacional'],
    queryFn: () => base44.entities.DiarioObra.list('-data', 300).catch(() => []),
  });

  const obraIds = useMemo(() => new Set(obras.map((o) => o.id)), [obras]);
  const doEscopo = useMemo(() => diarios.filter((d) => obraIds.has(d.obra_id)), [diarios, obraIds]);

  const deHoje = useMemo(
    () => doEscopo.filter((d) => String(d.data || '').slice(0, 10) === hoje),
    [doEscopo, hoje],
  );
  const obrasSemDiarioHoje = useMemo(
    () => obras.filter((o) => !deHoje.some((d) => d.obra_id === o.id)),
    [obras, deHoje],
  );
  const daSemana = useMemo(() => {
    const limite = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    return doEscopo.filter((d) => String(d.data || '').slice(0, 10) >= limite);
  }, [doEscopo]);

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

  if (isLoading) return <KpiCardsSkeleton count={3} />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Kpi titulo="Minhas obras" valor={obras.length} sub="onde você atua"
          icone={Building2} cor="text-blue-600" para="Obras" />
        <Kpi titulo="Diários hoje" valor={`${deHoje.length}/${obras.length}`}
          sub={obrasSemDiarioHoje.length > 0 ? `${obrasSemDiarioHoje.length} pendente(s)` : 'tudo registrado'}
          icone={NotebookPen} cor={obrasSemDiarioHoje.length > 0 ? 'text-amber-600' : 'text-emerald-600'}
          para="DiarioObra" />
        <Kpi titulo="Últimos 7 dias" valor={daSemana.length} sub="diários registrados"
          icone={CalendarCheck} cor="text-gray-600" para="DiarioObra" />
      </div>

      {obrasSemDiarioHoje.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{obrasSemDiarioHoje.length}</strong> obra(s) sem diário hoje. O diário é o registro
            do que foi executado — sem ele, o dia não fica documentado.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Obras dele, com o estado do diário de hoje em destaque. */}
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
                  const feito = deHoje.some((d) => d.obra_id === o.id);
                  return (
                    <li key={o.id}
                      className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                      onClick={() => navigate(`${createPageUrl('ObraDetalhes')}?id=${o.id}`)}>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{o.nome}</p>
                        <p className="text-xs text-gray-500">{o.cidade || '—'}{o.estado ? `/${o.estado}` : ''}</p>
                      </div>
                      {feito
                        ? <Badge className="bg-emerald-100 text-emerald-700 shrink-0">Diário feito</Badge>
                        : <Badge className="bg-amber-100 text-amber-700 shrink-0">Pendente</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Histórico curto — confere o que já foi lançado. */}
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimos diários</CardTitle>
            <button type="button" onClick={() => navigate(createPageUrl('DiarioObra'))}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              abrir diário <ArrowUpRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent>
            {doEscopo.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Nenhum diário registrado ainda.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {doEscopo.slice(0, 6).map((d) => {
                  const obra = obras.find((o) => o.id === d.obra_id);
                  return (
                    <li key={d.id} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{obra?.nome || 'Obra'}</p>
                        <p className="text-xs text-gray-500">{dataBR(d.data)}</p>
                      </div>
                      {d.clima && <span className="text-xs text-gray-500 shrink-0">{d.clima}</span>}
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
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { page: 'DiarioObra', nome: 'Diário de Obra', icone: NotebookPen, cor: 'text-emerald-600' },
            { page: 'Obras', nome: 'Minhas Obras', icone: Building2, cor: 'text-blue-600' },
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
