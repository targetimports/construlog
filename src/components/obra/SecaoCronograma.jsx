import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, AlertCircle, Plus, LayoutList, GanttChartSquare, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Área de scroll do Gantt com SHIFT + roda = rolar na horizontal.
// Precisa de listener NATIVO com passive:false: o onWheel do React 18 é passivo,
// então preventDefault ali não segura o scroll vertical e a página inteira mexia.
function ScrollGantt({ className, style, children }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!e.shiftKey) return;                       // sem shift: scroll normal
      if (el.scrollWidth <= el.clientWidth) return;  // nada para rolar na horizontal
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return <div ref={ref} className={className} style={style}>{children}</div>;
}
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import MarcoStatusActions from '../cronograma/MarcoStatusActions';
import AtividadeManualModal from '../cronograma/AtividadeManualModal';
import AtividadeManualActions from '../cronograma/AtividadeManualActions';
import GanttChart from '../cronograma/GanttChart';

export default function SecaoCronograma({ obraId, obra, user, podeEditar = true }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [filtro, setFiltro] = useState('todos');
  const [pagLista, setPagLista] = useState(1);
  const POR_PAGINA_LISTA = 15;
  // Default to 'lista' on mobile for better UX
  const [viewMode, setViewMode] = useState(() => window.innerWidth < 640 ? 'lista' : 'gantt');
  const [agrupamento, setAgrupamento] = useState('nenhum'); // 'nenhum' | 'status' | 'origem'
  const [ganttExpanded, setGanttExpanded] = useState(false);

  // O Gantt é o mesmo nos dois lugares (seção e modal) — uma função só evita que
  // as duas cópias saiam do ar uma da outra com o tempo.
  const renderGantt = () => (
    <GanttChart
      items={marcosFiltrados.map(m => cronogramaItems.find(ci => ci.id === m.id) || m)}
      obraId={obraId}
      canEdit={canEdit}
      agrupamento={agrupamento}
      onEditItem={(item) => setEditItem(item)}
    />
  );
  // Buscar CronogramaItem — tenta pelos dois campos (obras importadas vs manuais)
  const { data: cronogramaItemsByObraId = [], isLoading: cronLoading1 } = useQuery({
    queryKey: ['cronograma-items-obra_id', obraId],
    queryFn: () => base44.entities.CronogramaItem.filter({ obra_id: obraId }),
    enabled: !!obraId,
    staleTime: 30000,
  });
  const { data: cronogramaItemsByObraIdLegacy = [], isLoading: cronLoading2 } = useQuery({
    queryKey: ['cronograma-items-obraId', obraId],
    queryFn: () => base44.entities.CronogramaItem.filter({ obraId }),
    enabled: !!obraId,
    staleTime: 30000,
  });

  // Unificar sem duplicatas
  const cronogramaItems = React.useMemo(() => {
    const all = [...cronogramaItemsByObraId, ...cronogramaItemsByObraIdLegacy];
    const seen = new Set();
    return all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });
  }, [cronogramaItemsByObraId, cronogramaItemsByObraIdLegacy]);

  // Buscar MarcoObra (entidade legada) — campo obra_id
  const { data: marcosLegados = [], isLoading: marcosLoading } = useQuery({
    queryKey: ['marcos-obra', obraId],
    queryFn: async () => {
      // Tentar MarcoObra primeiro, fallback para Marco
      const byMarcoObra = await base44.entities.MarcoObra.filter({ obra_id: obraId }) || [];
      if (byMarcoObra.length > 0) return byMarcoObra;
      return await base44.entities.Marco.filter({ obra_id: obraId }) || [];
    },
    enabled: !!obraId,
    staleTime: 30000,
  });

  const cronLoading = cronLoading1 || cronLoading2;

  const isLoading = cronLoading || marcosLoading;

  // Normalizar: preferir CronogramaItem se houver, senão usar Marcos
  const marcos = React.useMemo(() => {
    if (cronogramaItems.length > 0) {
      return cronogramaItems.map(item => ({
        id: item.id,
        nome: item.nomeAtividade || 'Sem nome',
        data_inicio: item.dataInicioPlanejada,
        status: item.status === 'Concluído' ? 'concluido'
              : item.status === 'Em andamento' ? 'em_andamento'
              : 'pendente',
        percentual_concluido: item.percentualConcluido || 0,
      }));
    }
    return marcosLegados.map(m => ({
      id: m.id,
      nome: m.nome,
      data_inicio: m.data_prevista,
      status: m.status || 'pendente',
      percentual_concluido: m.status === 'concluido' ? 100 : 0,
    }));
  }, [cronogramaItems, marcosLegados]);

  const PERFIS_EDIT = ['admin', 'programador', 'engenharia', 'engenheiro', 'supervisor', 'encarregado', 'gestor', 'mestre', 'mestre_obra', 'mestre_de_obra', 'owner', 'superadmin'];
  const canEdit = !user || PERFIS_EDIT.includes(user?.role) || PERFIS_EDIT.includes(user?.perfil_acesso);

  const marcosFiltrados = React.useMemo(() => {
    if (filtro === 'importados') return marcos.filter((_, idx) => {
      const orig = cronogramaItems[idx];
      return !orig || (orig.origem !== 'MANUAL' && !orig.manual);
    });
    if (filtro === 'manuais') return marcos.filter((_, idx) => {
      const orig = cronogramaItems[idx];
      return orig && (orig.origem === 'MANUAL' || orig.manual === true);
    });
    return marcos;
  }, [marcos, filtro, cronogramaItems]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Skeleton className="h-24 bg-gray-100 rounded-xl" />
          <Skeleton className="h-24 bg-gray-100 rounded-xl" />
          <Skeleton className="h-24 bg-gray-100 rounded-xl" />
          <Skeleton className="h-24 bg-gray-100 rounded-xl" />
        </div>
        <Skeleton className="h-64 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  const semDados = marcos.length === 0;

  // Dados para gráfico de barras
  const marcosCompletos = marcos.filter(m => m.status === 'concluido').length;
  const marcosEmAndamento = marcos.filter(m => m.status === 'em_andamento').length;

  const chartData = marcos.slice(0, 8).map(marco => ({
    nome: (marco.nome || 'Marco').substring(0, 14),
    progresso: marco.percentual_concluido || 0,
  }));

  const progressoGeral = marcos.length > 0
    ? Math.round(marcos.reduce((sum, m) => sum + (m.percentual_concluido || 0), 0) / marcos.length)
    : 0;

  if (semDados) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[['Total', '0', 'text-blue-600'], ['Concluídos', '0', 'text-emerald-600'], ['Em Andamento', '0', 'text-amber-600'], ['Progresso', '0%', 'text-blue-600']].map(([label, val, color]) => (
            <Card key={label} className="bg-white border-gray-200">
              <CardContent className="pt-4 pb-3 px-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{val}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="bg-white border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-14">
            <Calendar className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-600 text-sm font-medium mb-1">Nenhuma atividade no cronograma</p>
            <p className="text-gray-400 text-xs mb-4">Adicione atividades manualmente ou importe um cronograma</p>
            {canEdit && podeEditar && (
              <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Adicionar Atividade
              </Button>
            )}
          </CardContent>
        </Card>
        {canEdit && (
          <AtividadeManualModal open={showAddModal} onClose={() => setShowAddModal(false)} obraId={obraId} existingItems={cronogramaItems} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-x-hidden w-full max-w-full">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-gray-500">Total de Marcos</CardTitle>
            <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-gray-900">{marcos.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-emerald-600">Concluídos</CardTitle>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-emerald-600">{marcosCompletos}</div>
            <p className="text-xs text-emerald-500 mt-0.5">{marcos.length > 0 ? Math.round((marcosCompletos / marcos.length) * 100) : 0}%</p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-amber-600">Em Andamento</CardTitle>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-amber-600">{marcosEmAndamento}</div>
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-3">
            <CardTitle className="text-xs font-medium text-gray-500">Progresso Geral</CardTitle>
            <Calendar className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-xl font-bold text-gray-900">{progressoGeral}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar de controles da visualização */}
      <Card className="bg-white border-gray-200">
        <CardContent className="py-2 px-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle view */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => setViewMode('gantt')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] ${
                  viewMode === 'gantt' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <GanttChartSquare className="w-3 h-3" /> Gantt
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors min-h-[36px] ${
                  viewMode === 'lista' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutList className="w-3 h-3" /> Lista
              </button>
            </div>

            {/* Filtro origem — scroll horizontal em mobile */}
            <div className="flex gap-1 tabs-scroll flex-shrink-0 max-w-[calc(100vw-200px)]">
              {[['todos','Todos'], ['importados','Importados'], ['manuais','Manuais']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setFiltro(val); setPagLista(1); }}
                  className={`px-2.5 py-1.5 text-xs rounded-full border whitespace-nowrap transition-colors min-h-[36px] ${
                    filtro === val
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'text-gray-600 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Agrupamento */}
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <span className="hidden sm:inline text-xs text-gray-500">Agrupar:</span>
              <select
                value={agrupamento}
                onChange={e => setAgrupamento(e.target.value)}
                className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1.5 min-h-[36px]"
              >
                <option value="nenhum">Nenhum</option>
                <option value="status">Por Status</option>
                <option value="origem">Por Origem</option>
              </select>
              {canEdit && podeEditar && (
                <Button size="sm" onClick={() => setShowAddModal(true)} className="h-9 gap-1 text-xs bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Adicionar</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gantt View — na seção (compacto) e, ao Expandir, num modal em cima da tela.
          Antes o Expandir só esticava a altura da div: continuava espremido na coluna
          da seção, que é o que travava a leitura de um cronograma largo. */}
      {viewMode === 'gantt' && (
        <div className="w-full rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
            <span className="text-xs text-gray-500 font-medium">Cronograma Gantt</span>
            <button
              onClick={() => setGanttExpanded(true)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors"
              title="Abrir em tela cheia"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Expandir
            </button>
          </div>
          <ScrollGantt
            className="overflow-x-auto overflow-y-auto overscroll-contain"
            style={{ maxHeight: '260px', WebkitOverflowScrolling: 'touch' }}
          >
            {/* Sem minWidth fixo: o Gantt já tem a largura do próprio conteúdo (w-max),
                e um wrapper com largura menor cortaria a caixa onde a coluna Atividade
                precisa grudar (sticky). */}
            <div className="min-w-max">{renderGantt()}</div>
          </ScrollGantt>
        </div>
      )}

      {/* Gantt expandido — modal centralizado ocupando ~70% da tela */}
      <Dialog open={ganttExpanded} onOpenChange={setGanttExpanded}>
        <DialogContent
          className="max-w-none w-[92vw] sm:w-[85vw] p-0 gap-0 overflow-hidden"
          style={{ height: '80vh' }}
        >
          {/* bg + z-50: o cabeçalho do Gantt é sticky (z-20/z-30) e passava POR CIMA
              do título ao rolar — o texto do modal aparecia atrás das datas. */}
          <DialogHeader className="px-4 py-3 border-b border-gray-200 shrink-0 bg-white relative z-50">
            <div className="flex items-center justify-between gap-3 pr-8">
              <DialogTitle className="text-base flex items-center gap-2 min-w-0">
                <GanttChartSquare className="w-4 h-4 text-blue-600 shrink-0" />
                Cronograma Gantt
                <span className="hidden sm:inline text-xs font-normal text-gray-400 truncate">
                  {marcosFiltrados.length} atividade(s) — arraste as barras para ajustar datas
                </span>
              </DialogTitle>
              {/* Mesmo agrupamento da visão compacta (estado compartilhado) — some
                  fica disponível também na tela cheia. */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:inline text-xs text-gray-500">Agrupar:</span>
                <select
                  value={agrupamento}
                  onChange={e => setAgrupamento(e.target.value)}
                  className="text-xs bg-white border border-gray-300 text-gray-700 rounded px-2 py-1.5 min-h-[36px]"
                >
                  <option value="nenhum">Nenhum</option>
                  <option value="status">Por Status</option>
                  <option value="origem">Por Origem</option>
                </select>
              </div>
            </div>
          </DialogHeader>
          {/* h-full - header: o scroll é DAQUI, e é este container que o Gantt procura
              para centralizar no dia de hoje ao abrir. */}
          <ScrollGantt
            className="overflow-auto overscroll-contain"
            style={{ height: 'calc(80vh - 57px)', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="min-w-max">{ganttExpanded && renderGantt()}</div>
          </ScrollGantt>
        </DialogContent>
      </Dialog>

      {/* Lista View */}
      {viewMode === 'lista' && (() => {
        const totalLista = marcosFiltrados.length;
        const totalPaginasLista = Math.max(1, Math.ceil(totalLista / POR_PAGINA_LISTA));
        const pagAtualLista = Math.min(pagLista, totalPaginasLista);
        const marcosPagina = marcosFiltrados.slice((pagAtualLista - 1) * POR_PAGINA_LISTA, pagAtualLista * POR_PAGINA_LISTA);
        return (
        <Card className="bg-white border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900 text-sm">Lista de Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {marcosPagina.map((marco) => {
                const originalItem = cronogramaItems.find(ci => ci.id === marco.id) || null;
                const isManual = originalItem && (originalItem.origem === 'MANUAL' || originalItem.manual === true);
                return (
                  <div key={marco.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-0 sm:mr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 truncate">{marco.nome}</p>
                        {isManual && (
                          <Badge variant="outline" className="text-xs text-purple-600 border-purple-300 bg-purple-50">Manual</Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {marco.data_inicio && new Date(marco.data_inicio).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2 w-28 justify-end">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${marco.percentual_concluido || 0}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-900 w-9 text-right tabular-nums">{marco.percentual_concluido || 0}%</span>
                      </div>
                      <div className="flex items-center justify-start sm:justify-end gap-1 w-auto sm:w-[160px]">
                        {originalItem && <MarcoStatusActions item={originalItem} obraId={obraId} canEdit={canEdit} />}
                      </div>
                      <div className="w-7 flex justify-end">
                        {isManual && canEdit && <AtividadeManualActions item={originalItem} obraId={obraId} existingItems={cronogramaItems} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              {marcosFiltrados.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">Nenhuma atividade nesta categoria</p>
              )}
            </div>

            {/* Paginação */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 mt-2 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                {totalLista === 0 ? 'Nenhum registro' : `Mostrando ${(pagAtualLista - 1) * POR_PAGINA_LISTA + 1}–${Math.min(pagAtualLista * POR_PAGINA_LISTA, totalLista)} de ${totalLista}`}
              </span>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setPagLista(p => Math.max(1, p - 1))} disabled={pagAtualLista <= 1} className="h-8 gap-1 border-gray-300 text-gray-700">
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </Button>
                <span className="text-xs text-gray-600">Página {pagAtualLista} de {totalPaginasLista}</span>
                <Button variant="outline" size="sm" onClick={() => setPagLista(p => Math.min(totalPaginasLista, p + 1))} disabled={pagAtualLista >= totalPaginasLista} className="h-8 gap-1 border-gray-300 text-gray-700">
                  Próxima <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        );
      })()}

      {/* Gráfico de progresso */}
      {chartData.length > 0 && (
        <Card className="bg-white border-gray-200">
          <CardHeader><CardTitle className="text-gray-900 text-sm">Progresso por Atividade</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="nome" stroke="#6B7280" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis stroke="#6B7280" tick={{ fontSize: 11 }} width={32} />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: 8 }} formatter={v => `${v}%`} />
                <Bar dataKey="progresso" fill="#10B981" name="Progresso (%)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {canEdit && (
        <AtividadeManualModal
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
          obraId={obraId}
          existingItems={cronogramaItems}
        />
      )}

      {/* Edição de atividade (aberta ao clicar no nome no Gantt ou no lápis na Lista) */}
      {canEdit && editItem && (
        <AtividadeManualModal
          open={!!editItem}
          onClose={() => setEditItem(null)}
          obraId={obraId}
          editItem={editItem}
          existingItems={cronogramaItems}
        />
      )}
    </div>
  );
}