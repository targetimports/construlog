import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Trash2, Bell, ChevronRight, RotateCcw, ClipboardList, Ruler, TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import { marcarVista, desmarcarVista, getVistas, PENDENCIAS_VISTAS_EVENT } from '@/components/shared/pendenciasLidas';
import { ListSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';

const POR_PAGINA = 10;

const PEND_CFG = {
  diario_nao_lancado:   { label: 'Diário',         icon: ClipboardList },
  bm_pendente:          { label: 'Medição',        icon: Ruler },
  recebimento_atrasado: { label: 'Recebimento',    icon: TrendingUp },
  custo_vencido:        { label: 'Custo',          icon: TrendingDown },
  material_em_falta:    { label: 'Material',       icon: Package },
  caixa_negativo:       { label: 'Fluxo de caixa', icon: AlertTriangle },
};
const SEV_CLS = { alta: 'bg-red-100 text-red-700', media: 'bg-amber-100 text-amber-700', baixa: 'bg-blue-100 text-blue-700' };
const labelTipoNotif = (t) => String(t || 'aviso').replace(/_/g, ' ');

export default function MinhasNotificacoes() {
  const [user, setUser] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const [, setVistasV] = useState(0);
  const queryClient = useQueryClient();

  React.useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  React.useEffect(() => {
    const bump = () => setVistasV((v) => v + 1);
    window.addEventListener(PENDENCIAS_VISTAS_EVENT, bump);
    window.addEventListener('storage', bump);
    window.addEventListener('focus', bump);
    document.addEventListener('visibilitychange', bump);
    return () => {
      window.removeEventListener(PENDENCIAS_VISTAS_EVENT, bump);
      window.removeEventListener('storage', bump);
      window.removeEventListener('focus', bump);
      document.removeEventListener('visibilitychange', bump);
    };
  }, []);

  const trocarAba = (v) => { setAbaAtiva(v); setPagina(1); };

  const { data: pendData, isLoading: loadingPend } = useQuery({
    queryKey: ['pendencias-pagina'],
    queryFn: async () => (await base44.functions.invoke('listarPendencias', {})).data,
    staleTime: 60 * 1000,
  });

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['minhas-notificacoes', user?.email],
    queryFn: async () => (await base44.entities.Notificacao?.filter({ destinatario_email: user.email }, '-created_date', 100)) || [],
    enabled: !!user?.email,
    staleTime: 60 * 1000,
  });

  // ── Unifica pendências (calculadas) + notificações salvas em "itens" ──
  const vistas = getVistas();
  const itens = [
    ...(pendData?.pendencias || []).map((p) => ({
      kind: 'pend', id: p.id, tipo: p.tipo, severidade: p.severidade || 'media',
      titulo: p.titulo, mensagem: p.mensagem, obra_nome: p.obra_nome, link: p.link,
      lida: vistas.has(p.id),
    })),
    ...notificacoes.map((n) => ({
      kind: 'notif', id: n.id, tipo: n.tipo, severidade: 'baixa',
      titulo: n.titulo, mensagem: n.mensagem, link_acao: n.link_acao, created_date: n.created_date,
      lida: !!n.lida,
    })),
  ];
  const naoLidas = itens.filter((i) => !i.lida);
  const lidas = itens.filter((i) => i.lida);
  const todas = [...naoLidas, ...lidas]; // não lidas primeiro, depois lidas

  // ── Mutations de notificações salvas ──
  const setLidaMutation = useMutation({
    mutationFn: ({ id, lida }) => base44.entities.Notificacao?.update(id, { lida }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['minhas-notificacoes'] }),
  });
  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao?.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['minhas-notificacoes'] }); toast.success('Notificação removida'); },
  });

  // ── Marcar lido / reabrir (funciona para pendência e notificação) ──
  const marcarLido = (item) => {
    if (item.lida) return;
    if (item.kind === 'pend') marcarVista(item.id);
    else setLidaMutation.mutate({ id: item.id, lida: true });
  };
  const reabrir = (item) => {
    if (item.kind === 'pend') desmarcarVista(item.id);
    else setLidaMutation.mutate({ id: item.id, lida: false });
  };
  const marcarTodas = () => {
    naoLidas.forEach((i) => marcarLido(i));
    toast.success('Todas marcadas como lidas');
  };

  const slice = (arr) => {
    const totalPaginas = Math.max(1, Math.ceil(arr.length / POR_PAGINA));
    const atual = Math.min(pagina, totalPaginas);
    return arr.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  };
  const Paginacao = ({ total }) => {
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    const atual = Math.min(pagina, totalPaginas);
    return (
      <Pagination
        currentPage={atual}
        totalPages={totalPaginas}
        onPageChange={setPagina}
        startIndex={(atual - 1) * POR_PAGINA}
        endIndex={Math.min(atual * POR_PAGINA, total)}
        totalItems={total}
      />
    );
  };

  const IconeItem = (item) => {
    if (item.kind === 'pend') return (PEND_CFG[item.tipo]?.icon) || AlertTriangle;
    return Bell;
  };
  const badgeItem = (item) => {
    if (item.kind === 'pend') return PEND_CFG[item.tipo]?.label || 'Pendência';
    return labelTipoNotif(item.tipo);
  };

  const renderItens = (lista, vazioMsg = 'Nenhum item.') => {
    if ((loadingPend || isLoading) && lista.length === 0) {
      return <ListSkeleton rows={6} />;
    }
    if (lista.length === 0) {
      return (
        <Card className="bg-white border-gray-200">
          <CardContent className="pt-6 text-center text-gray-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p>{vazioMsg}</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <div className="grid gap-3">
        {slice(lista).map((item) => {
          const lida = item.lida; // estiliza cada item pelo próprio estado
          const Icon = IconeItem(item);
          const sevCls = lida ? 'bg-gray-100 text-gray-500' : (SEV_CLS[item.severidade] || 'bg-gray-100 text-gray-700');
          return (
            <Card
              key={`${item.kind}_${item.id}`}
              onClick={lida ? undefined : () => marcarLido(item)}
              className={lida
                ? 'bg-gray-50/60 border-l-4 border-gray-200 transition-colors'
                : 'bg-white border-l-4 border-blue-500 cursor-pointer hover:bg-gray-50 transition-colors'}
            >
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${lida ? 'text-gray-300' : 'text-gray-400'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={`text-[10px] border-0 capitalize ${sevCls}`}>{badgeItem(item)}</Badge>
                        {item.obra_nome && <span className="text-xs text-gray-400 truncate">{item.obra_nome}</span>}
                        {!lida && <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" title="Não lida" />}
                      </div>
                      <h3 className={`text-sm ${lida ? 'font-medium text-gray-500' : 'font-bold text-gray-900'}`}>{item.titulo}</h3>
                      {item.mensagem && <p className={`text-sm mt-0.5 ${lida ? 'text-gray-400' : 'text-gray-600'}`}>{item.mensagem}</p>}
                      {item.created_date && <p className="text-xs text-gray-400 mt-2">{new Date(item.created_date).toLocaleString('pt-BR')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 justify-end pl-8 sm:pl-0">
                    {lida ? (
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); reabrir(item); }} className="h-8 gap-1 text-xs border-gray-300 text-gray-600">
                        <RotateCcw className="w-3 h-3" /> Reabrir
                      </Button>
                    ) : (
                      <>
                        {(item.link || item.link_acao) && (
                          item.kind === 'pend'
                            ? <Link to={item.link} onClick={(e) => { e.stopPropagation(); marcarLido(item); }} className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100 transition-colors">Resolver <ChevronRight className="w-3 h-3" /></Link>
                            : <a href={item.link_acao} onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs rounded-lg hover:bg-blue-100 transition-colors">Abrir</a>
                        )}
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); marcarLido(item); }} className="h-8 text-xs border-gray-300" title="Marcar como lida">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {item.kind === 'notif' && (
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deletarMutation.mutate(item.id); }} className="h-8 text-red-600 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Paginacao total={lista.length} />
      </div>
    );
  };

  return (
    <ErrorBoundary>
      <div className="max-w-4xl mx-auto space-y-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificações & Pendências</h1>
            <p className="text-gray-500 mt-1">{naoLidas.length} não lida(s) · {lidas.length} lida(s)</p>
          </div>
          {naoLidas.length > 0 && (
            <Button onClick={marcarTodas} variant="outline" className="w-full sm:w-auto gap-2 border-gray-300 text-gray-700">
              <CheckCircle2 className="w-4 h-4" /> Marcar todas como lidas
            </Button>
          )}
        </div>

        <Tabs value={abaAtiva} onValueChange={trocarAba}>
          <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
            <TabsTrigger value="todas" className="whitespace-nowrap">Todas ({todas.length})</TabsTrigger>
            <TabsTrigger value="nao-lidas" className="whitespace-nowrap">Não Lidas ({naoLidas.length})</TabsTrigger>
            <TabsTrigger value="lidas" className="whitespace-nowrap">Lidas ({lidas.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="todas" className="mt-6">{renderItens(todas, 'Nenhuma notificação ou pendência.')}</TabsContent>
          <TabsContent value="nao-lidas" className="mt-6">{renderItens(naoLidas, 'Tudo em dia — nenhuma não lida.')}</TabsContent>
          <TabsContent value="lidas" className="mt-6">{renderItens(lidas, 'Nada marcado como lido ainda.')}</TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  );
}
