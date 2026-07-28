import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useGlobalContext } from '@/components/shared/GlobalContextProvider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { ListSkeleton } from '@/components/shared/Skeletons';
import Pagination from '@/components/shared/Pagination';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Download, Loader2, CalendarClock, User as UserIcon } from 'lucide-react';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

const PER_PAGE = 15;

const MODULO_CFG = {
  compras: { label: 'Compras', border: 'border-l-blue-500', badge: 'bg-blue-100 text-blue-700' },
  estoque: { label: 'Estoque', border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700' },
  financeiro: { label: 'Financeiro', border: 'border-l-amber-500', badge: 'bg-amber-100 text-amber-700' },
  medicoes: { label: 'Medições', border: 'border-l-purple-500', badge: 'bg-purple-100 text-purple-700' },
  campo: { label: 'Campo', border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700' },
};
const moduloCfg = (m) =>
  MODULO_CFG[m] || { label: m || '—', border: 'border-l-gray-400', badge: 'bg-gray-100 text-gray-600' };

const fmtData = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
};
const fmtMoeda = (v) =>
  v || v === 0
    ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

export default function TimelineObra() {
  const { obraAtual } = useGlobalContext();
  const [obraId, setObraId] = useState(obraAtual?.id || '');
  const [filtroModulo, setFiltroModulo] = useState('todos');
  const [page, setPage] = useState(1);

  // Acompanha o contexto global enquanto o usuário não escolheu uma obra aqui.
  useEffect(() => {
    if (obraAtual?.id && !obraId) setObraId(obraAtual.id);
  }, [obraAtual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ao trocar de obra, volta o filtro para "todos".
  useEffect(() => {
    setFiltroModulo('todos');
  }, [obraId]);

  // Volta para a 1ª página ao trocar de obra ou de filtro.
  useEffect(() => {
    setPage(1);
  }, [obraId, filtroModulo]);

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list(),
  });

  const { data: eventos = [], isLoading, isFetching } = useQuery({
    queryKey: ['timeline-obra', obraId],
    enabled: !!obraId,
    queryFn: async () => {
      const res = await base44.functions.invoke('getTimelineObra', { obra_id: obraId });
      return res?.data?.eventos || [];
    },
  });

  const obraSel = obras.find((o) => o.id === obraId) || null;

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra selecionada).
  const { empresa, branding } = useEmpresaBranding(obraSel?.empresa_id);

  const obraOptions = obras.map((o) => ({
    value: o.id,
    label: o.codigo ? `${o.codigo} — ${o.nome}` : o.nome,
  }));

  const modulosPresentes = [...new Set(eventos.map((e) => e.modulo))];
  const moduloOptions = [
    { value: 'todos', label: 'Todos os módulos' },
    ...modulosPresentes.map((m) => ({ value: m, label: moduloCfg(m).label })),
  ];

  const eventosFiltrados =
    filtroModulo === 'todos' ? eventos : eventos.filter((e) => e.modulo === filtroModulo);

  // Paginação (a página é sempre clampada ao total atual de páginas).
  const totalPages = Math.max(1, Math.ceil(eventosFiltrados.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = Math.min(startIndex + PER_PAGE, eventosFiltrados.length);
  const eventosPagina = eventosFiltrados.slice(startIndex, endIndex);

  // Exporta EXCEL branded com exatamente o que está filtrado na tela.
  const exportarExcel = () => {
    if (!eventosFiltrados.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      exportarXLSXBranded(
        `timeline_${obraSel?.codigo || obraSel?.nome || 'obra'}_${new Date().toISOString().split('T')[0]}`,
        [{
          nome: 'Timeline',
          titulo: 'Timeline da Obra',
          subtitulo: obraSel?.nome || '',
          headers: ['Data', 'Módulo', 'Tipo', 'Ação', 'Número', 'Status', 'Usuário', 'Valor'],
          rows: eventosFiltrados.map((e) => [
            fmtData(e.data),
            moduloCfg(e.modulo).label,
            e.tipo || '',
            e.acao || '',
            e.numero || '',
            e.status || '',
            e.usuario || 'Sistema',
            e.valor || e.valor === 0 ? Number(e.valor) : '',
          ]),
          moeda: [7],
        }],
        { empresa, branding },
      );
      toast.success(`Excel exportado (${eventosFiltrados.length} evento(s)).`);
    } catch (err) {
      toast.error('Erro ao exportar: ' + (err?.message || 'tente novamente'));
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Timeline da Obra</h1>
        <p className="text-gray-500 mt-1">
          Linha do tempo unificada de compras, estoque, financeiro e medições.
        </p>
      </div>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Obra</label>
              <ComboboxBusca
                options={obraOptions}
                value={obraId}
                onSelect={setObraId}
                placeholder="Selecione a obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra encontrada."
                buscarParaListar
                dicaBusca="Digite para buscar a obra..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Módulo</label>
              <ComboboxBusca
                options={moduloOptions}
                value={filtroModulo}
                onSelect={setFiltroModulo}
                placeholder="Todos os módulos"
                disabled={!obraId || eventos.length === 0}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {!obraId ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Selecione uma obra para ver a timeline</p>
            <p className="text-gray-400 text-sm mt-1">Use o seletor acima para escolher a obra.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <ListSkeleton rows={6} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              {obraSel && <span className="font-medium text-gray-700">{obraSel.nome}</span>}
              {obraSel ? ' · ' : ''}
              {eventosFiltrados.length} evento(s)
              {isFetching && <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin text-gray-400" />}
            </p>
            <Button
              onClick={exportarExcel}
              disabled={!eventosFiltrados.length}
              variant="outline"
              className="gap-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </Button>
          </div>

          {eventosFiltrados.length === 0 ? (
            <Card className="bg-white border-gray-200 shadow-sm">
              <CardContent className="py-16 text-center">
                <CalendarClock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">Nenhum evento registrado para esta obra</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {eventosPagina.map((evento, idx) => {
                const cfg = moduloCfg(evento.modulo);
                const valor = fmtMoeda(evento.valor);
                return (
                  <Card
                    key={startIndex + idx}
                    className={cn('bg-white border-gray-200 border-l-4 shadow-sm', cfg.border)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <Badge className={cn('border-0', cfg.badge)}>{cfg.label}</Badge>
                            <span className="font-semibold text-gray-900 text-sm">{evento.acao}</span>
                            {evento.status && (
                              <Badge variant="outline" className="border-gray-200 text-gray-500 capitalize">
                                {evento.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                            {evento.numero && (
                              <span className="truncate max-w-[260px]" title={evento.numero}>
                                #{evento.numero}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <CalendarClock className="w-3.5 h-3.5" />
                              {fmtData(evento.data)}
                            </span>
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3.5 h-3.5" />
                              {evento.usuario || 'Sistema'}
                            </span>
                          </div>
                        </div>
                        {valor && (
                          <div className="text-sm font-semibold text-gray-900 whitespace-nowrap shrink-0">
                            {valor}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={eventosFiltrados.length}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
