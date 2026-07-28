import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCardsSkeleton } from '@/components/shared/Skeletons';
import {
  Truck, MapPin, Package, Navigation, Flag, CheckCircle2, ArrowUpRight, Building2,
} from 'lucide-react';

// Dashboard do MOTORISTA — a viagem de agora e o que vem depois.
//
// Usa getMinhasViagens, a mesma função da tela de Entregas: ela já resolve de quem
// é cada viagem (por colaborador ou e-mail) e dá visão total só para admin/TI.
// A versão anterior lia status 'em_andamento'/'concluida' e a entidade
// SolicitacaoVeiculo — nomenclatura e cadastro do fluxo antigo, que mostravam
// zero para sempre.

const fmtNum = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });

const STATUS = {
  PLANEJADA:  { label: 'A sair',     cls: 'bg-gray-100 text-gray-700' },
  A_CAMINHO:  { label: 'A caminho',  cls: 'bg-blue-100 text-blue-700' },
  NO_DESTINO: { label: 'No destino', cls: 'bg-emerald-100 text-emerald-700' },
  RETORNANDO: { label: 'Voltando',   cls: 'bg-amber-100 text-amber-700' },
  FINALIZADA: { label: 'Finalizada', cls: 'bg-green-100 text-green-700' },
};

export default function DashboardMotorista() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['minhas-viagens'],
    queryFn: () => base44.functions.invoke('getMinhasViagens', { incluir_finalizadas: true }).then((r) => r.data),
  });

  const abertas = data?.abertas || [];
  const encerradas = data?.encerradas || [];

  // A viagem "de agora" é a que já saiu; se nenhuma saiu, a próxima a sair.
  const emCurso = useMemo(
    () => abertas.find((v) => ['A_CAMINHO', 'NO_DESTINO', 'RETORNANDO'].includes(v.status))
      || abertas.find((v) => v.status === 'PLANEJADA') || null,
    [abertas],
  );

  const hoje = new Date().toDateString();
  const entreguesHoje = useMemo(
    () => [...abertas, ...encerradas].filter((v) => v.chegou_em && new Date(v.chegou_em).toDateString() === hoje),
    [abertas, encerradas, hoje],
  );
  const kmMes = useMemo(() => {
    const m = new Date().toISOString().slice(0, 7);
    return encerradas
      .filter((v) => String(v.finalizada_em || '').startsWith(m))
      .reduce((s, v) => s + (Number(v.km_percorrido) || 0), 0);
  }, [encerradas]);

  const Kpi = ({ titulo, valor, sub, icone: Icone, cor }) => (
    <Card className="bg-white border-gray-200 cursor-pointer transition hover:border-blue-300"
      onClick={() => navigate(createPageUrl('ViagensEntregas'))}>
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
        <Kpi titulo="Em andamento" valor={abertas.length} sub="viagens abertas"
          icone={Navigation} cor="text-blue-600" />
        <Kpi titulo="Entregues hoje" valor={entreguesHoje.length} sub="chegadas registradas"
          icone={CheckCircle2} cor="text-emerald-600" />
        <Kpi titulo="Km no mês" valor={fmtNum(kmMes)} sub="viagens finalizadas"
          icone={Truck} cor="text-purple-600" />
        <Kpi titulo="Concluídas" valor={encerradas.length} sub="histórico"
          icone={Flag} cor="text-gray-600" />
      </div>

      {/* A viagem de agora — o que ele precisa fazer neste momento. */}
      {emCurso ? (
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Viagem atual</CardTitle>
            <Badge className={(STATUS[emCurso.status] || STATUS.PLANEJADA).cls}>
              {(STATUS[emCurso.status] || STATUS.PLANEJADA).label}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-gray-900">{emCurso.destino_nome}</p>
              {emCurso.destino_endereco && (
                <p className="text-xs text-gray-500 flex items-start gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />{emCurso.destino_endereco}
                </p>
              )}
            </div>
            <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
              <span>{emCurso.numero}</span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-gray-400" />
                {emCurso.veiculo_nome}{emCurso.veiculo_placa ? ` · ${emCurso.veiculo_placa}` : ''}
              </span>
              {emCurso.origem_nome && <span>Origem: {emCurso.origem_nome}</span>}
            </div>
            {(emCurso.itens_resumo || []).length > 0 && (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-2.5">
                <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5" /> Carga
                </p>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  {emCurso.itens_resumo.slice(0, 4).map((i, n) => (
                    <li key={n}>{i.quantidade} {i.unidade} — {i.material_nome}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={() => navigate(createPageUrl('ViagensEntregas'))}>
              <Navigation className="w-4 h-4" /> Abrir minhas entregas
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border-gray-200">
          <CardContent className="text-center py-10">
            <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400">Nenhuma viagem em andamento.</p>
          </CardContent>
        </Card>
      )}

      {abertas.length > 1 && (
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Próximas entregas</CardTitle>
            <button type="button" onClick={() => navigate(createPageUrl('ViagensEntregas'))}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              ver todas <ArrowUpRight className="w-3 h-3" />
            </button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-100">
              {abertas.filter((v) => v.id !== emCurso?.id).slice(0, 5).map((v) => (
                <li key={v.id}
                  className="py-2.5 flex items-center justify-between gap-2 cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded"
                  onClick={() => navigate(createPageUrl('ViagensEntregas'))}>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-900 truncate">{v.destino_nome}</p>
                    <p className="text-xs text-gray-500">{v.numero} · {v.veiculo_nome}</p>
                  </div>
                  <Badge className={`shrink-0 ${(STATUS[v.status] || STATUS.PLANEJADA).cls}`}>
                    {(STATUS[v.status] || STATUS.PLANEJADA).label}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border-gray-200">
        <CardHeader><CardTitle className="text-base">Acesso rápido</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { page: 'ViagensEntregas', nome: 'Viagens de Entrega', icone: Truck, cor: 'text-blue-600' },
            { page: 'Obras', nome: 'Minhas Obras', icone: Building2, cor: 'text-emerald-600' },
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
