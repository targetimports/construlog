import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_COLORS = {
  concluido:    { bar: '#10B981', bg: 'bg-emerald-500', text: 'text-emerald-400' },
  em_andamento: { bar: '#3B82F6', bg: 'bg-blue-500',    text: 'text-blue-400' },
  nao_iniciado: { bar: '#6B7280', bg: 'bg-gray-500',    text: 'text-gray-400' },
  atrasado:     { bar: '#EF4444', bg: 'bg-red-500',     text: 'text-red-400' },
  pausado:      { bar: '#F59E0B', bg: 'bg-amber-500',   text: 'text-amber-400' },
  default:      { bar: '#6B7280', bg: 'bg-gray-500',    text: 'text-gray-400' },
};

// O mesmo status vem em duas grafias: importado grava `concluido`, e o cadastro
// manual grava `Concluído`. As chaves antigas só cobriam a segunda — resultado: as
// 56 atividades concluídas do import apareciam CINZA (caíam no default) em vez de
// verde. Normaliza tirando acento, caixa e separador.
const normStatus = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().trim().replace(/[\s-]+/g, '_');

const ehConcluido = (item) =>
  normStatus(item?.status) === 'concluido' || (Number(item?.percentualConcluido) || 0) >= 100;

// ATRASADO = prazo venceu e a atividade não fechou. É calculado, não cadastrado:
// ninguém vai entrar no sistema todo dia para marcar "atrasado" a mão, então a cor
// tem que sair da data. Vale para não iniciada e para parcial (60% e o prazo passou
// continua atraso).
function ehAtrasado(item, hoje) {
  if (ehConcluido(item)) return false;
  const fim = item?.dataFimPlanejada || item?.dataInicioPlanejada;
  if (!fim) return false;
  return String(fim).slice(0, 10) < hoje;
}

function getStatusColor(status) {
  return STATUS_COLORS[normStatus(status)] || STATUS_COLORS.default;
}

// Retorna array de datas (dias) entre start e end
function getDaysArray(start, end) {
  const days = [];
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  while (cur <= endD) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// Gera cabeçalho de meses/semanas
function buildHeaders(days) {
  const months = [];
  days.forEach((d, i) => {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const last = months[months.length - 1];
    if (!last || last.key !== key) {
      months.push({
        key,
        label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        // Alternativa curta para faixa estreita (mês cortado nas pontas do range):
        // melhor mostrar "jan" do que dois rótulos se atropelando.
        labelCurto: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        start: i,
        span: 1,
      });
    } else {
      last.span++;
    }
  });
  return months;
}

const ROW_H = 40;
const LABEL_W = 160;        // largura inicial da coluna Atividade
const LABEL_W_MIN = 110;    // abaixo disso não cabe nem "SUPERESTRUTURA"
const LABEL_W_MAX = 460;    // acima disso sobra pouco espaço para a linha do tempo
const MIN_DAY_W = 18;

export default function GanttChart({ items, obraId, canEdit, agrupamento, onEditItem }) {
  const queryClient = useQueryClient();
  const containerRef = useRef();
  const [containerW, setContainerW] = useState(0);

  // Largura da coluna Atividade — ajustável arrastando a divisória. Nome de item de
  // cronograma é longo ("SISTEMA PROTEÇÃO D...") e 160px cortava quase tudo; quem
  // precisa ler puxa, quem quer ver mais dias encolhe. Fica guardado no navegador
  // para não ter que reajustar toda vez que abrir a obra.
  const [labelW, setLabelW] = useState(() => {
    const salvo = parseInt(localStorage.getItem('gantt:labelW') || '', 10);
    return Number.isFinite(salvo) ? Math.min(LABEL_W_MAX, Math.max(LABEL_W_MIN, salvo)) : LABEL_W;
  });
  const resizeRef = useRef(null);

  const iniciarResize = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();                    // não pode virar arraste de barra
    resizeRef.current = { x0: e.clientX, w0: labelW };
    const mover = (ev) => {
      const { x0, w0 } = resizeRef.current || {};
      if (x0 == null) return;
      const novo = Math.min(LABEL_W_MAX, Math.max(LABEL_W_MIN, w0 + (ev.clientX - x0)));
      setLabelW(novo);
    };
    const soltar = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setLabelW((w) => { localStorage.setItem('gantt:labelW', String(w)); return w; });
    };
    // Listeners no document: se o mouse sair do Gantt no meio do arraste, continua.
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [labelW]);
  const [dragging, setDragging] = useState(null);
  const [localDates, setLocalDates] = useState({});
  const [tooltip, setTooltip] = useState(null);

  // Measure container width for responsive day width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Calcular range de datas
  const { minDate, maxDate, days } = useMemo(() => {
    const validItems = items.filter(i => i.dataInicioPlanejada || i.dataFimPlanejada);
    if (validItems.length === 0) {
      const today = new Date();
      const end = new Date(today); end.setMonth(end.getMonth() + 3);
      return { minDate: today, maxDate: end, days: getDaysArray(today, end) };
    }
    const starts = validItems.map(i => new Date(i.dataInicioPlanejada || i.dataFimPlanejada));
    const ends   = validItems.map(i => new Date(i.dataFimPlanejada    || i.dataInicioPlanejada));
    let min = new Date(Math.min(...starts));
    let max = new Date(Math.max(...ends));
    // Começa EXATAMENTE no primeiro dia planejado. Antes recuava 7 dias, o que
    // inventava um pedaço de mês anterior sem nenhuma atividade — e um mês de 7
    // dias não cabe o rótulo, daí o "dez" grudado no "jan. de 26" no cabeçalho.
    // À direita mantemos folga: é onde se arrasta a barra para esticar o prazo.
    max.setDate(max.getDate() + 14);
    return { minDate: min, maxDate: max, days: getDaysArray(min, max) };
  }, [items]);

  const monthHeaders = useMemo(() => buildHeaders(days), [days]);

  const updateMutation = useMutation({
    mutationFn: ({ id, dataInicio, dataFim }) =>
      base44.entities.CronogramaItem.update(id, {
        dataInicioPlanejada: dataInicio,
        dataFimPlanejada: dataFim,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey?.[0];
          return typeof k === 'string' && (k.startsWith('cronograma') || k === 'marcos-obra' || k === 'obra-kpis' || k === 'obra' || k === 'obra-resumo' || k === 'obra-detalhes');
        },
      });
      toast.success('Datas atualizadas');
    },
    onError: (e) => toast.error('Erro ao salvar: ' + e.message),
  });

  // Posição em px de uma data relativa ao início (DAY_W calculado depois — usamos ref)
  const dayWRef = useRef(MIN_DAY_W);

  const dateToX = useCallback((d) => {
    const ms = new Date(d) - minDate;
    return Math.round(ms / (1000 * 60 * 60 * 24)) * dayWRef.current;
  }, [minDate]);

  const xToDate = useCallback((x) => {
    const daysN = Math.round(x / dayWRef.current);
    const d = new Date(minDate);
    d.setDate(d.getDate() + daysN);
    return d.toISOString().split('T')[0];
  }, [minDate]);

  // ── Drag handlers ──
  const onBarMouseDown = useCallback((e, item, field) => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    const dates = localDates[item.id] || {};
    const origInicio = dates.inicio || item.dataInicioPlanejada;
    const origFim    = dates.fim    || item.dataFimPlanejada;
    setDragging({ id: item.id, field, startX: e.clientX, origInicio, origFim });
  }, [canEdit, localDates]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.startX;
    const daysDelta = Math.round(dx / dayWRef.current);

    const shiftDate = (iso, delta) => {
      if (!iso) return iso;
      const d = new Date(iso);
      d.setDate(d.getDate() + delta);
      return d.toISOString().split('T')[0];
    };

    let newInicio = dragging.origInicio;
    let newFim    = dragging.origFim;

    if (dragging.field === 'move') {
      newInicio = shiftDate(dragging.origInicio, daysDelta);
      newFim    = shiftDate(dragging.origFim, daysDelta);
    } else if (dragging.field === 'inicio') {
      newInicio = shiftDate(dragging.origInicio, daysDelta);
      if (newInicio >= newFim) newInicio = dragging.origInicio; // clamp
    } else if (dragging.field === 'fim') {
      newFim = shiftDate(dragging.origFim, daysDelta);
      if (newFim <= newInicio) newFim = dragging.origFim; // clamp
    }

    setLocalDates(prev => ({ ...prev, [dragging.id]: { inicio: newInicio, fim: newFim } }));
  }, [dragging]);

  const onMouseUp = useCallback(() => {
    if (!dragging) return;
    const dates = localDates[dragging.id] || {};
    if (dates.inicio || dates.fim) {
      const item = items.find(i => i.id === dragging.id);
      const newInicio = dates.inicio || item?.dataInicioPlanejada;
      const newFim    = dates.fim    || item?.dataFimPlanejada;
      if (newInicio !== item?.dataInicioPlanejada || newFim !== item?.dataFimPlanejada) {
        updateMutation.mutate({ id: dragging.id, dataInicio: newInicio, dataFim: newFim });
      }
    }
    setDragging(null);
  }, [dragging, localDates, items, updateMutation]);

  // Agrupamento
  // ORDEM = DATA DA ATIVIDADE (campo "Data da atividade" do cadastro =
  // dataInicioPlanejada), da MAIS RECENTE para a mais antiga — a que começa depois
  // fica em cima. Nada a ver com created_date, que era o padrão do backend
  // (`created_date DESC`) e deixava a ordem à mercê de quem foi cadastrado por
  // último, sem relação com a linha do tempo.
  // Empate no início desempata pelo fim (mais longe primeiro) e depois pelo código
  // do item. Sem data planejada vai para o fim — não tem onde se encaixar.
  const itensOrdenados = useMemo(() => {
    const ini = (i) => i.dataInicioPlanejada || i.dataFimPlanejada || '';
    const fim = (i) => i.dataFimPlanejada || i.dataInicioPlanejada || '';
    const num = (i) => String(i.item || '').split('.').map((n) => parseInt(n, 10) || 0);
    return [...items].sort((a, b) => {
      const ia = ini(a), ib = ini(b);
      if (!ia && !ib) return 0;
      if (!ia) return 1;            // sem data planejada: por último
      if (!ib) return -1;
      if (ia !== ib) return ia > ib ? -1 : 1;   // mais recente primeiro
      const fa = fim(a), fb = fim(b);
      if (fa !== fb) return fa > fb ? -1 : 1;
      const na = num(a), nb = num(b);
      for (let k = 0; k < Math.max(na.length, nb.length); k++) {
        if ((na[k] || 0) !== (nb[k] || 0)) return (na[k] || 0) - (nb[k] || 0);
      }
      return 0;
    });
  }, [items]);

  const grouped = useMemo(() => {
    const items = itensOrdenados;
    if (!agrupamento || agrupamento === 'nenhum') {
      return [{ label: null, items }];
    }
    if (agrupamento === 'status') {
      const map = {};
      items.forEach(i => {
        const k = i.status || 'Não iniciado';
        if (!map[k]) map[k] = [];
        map[k].push(i);
      });
      return Object.entries(map).map(([label, items]) => ({ label, items }));
    }
    if (agrupamento === 'origem') {
      const manual = items.filter(i => i.origem === 'MANUAL' || i.manual);
      const importado = items.filter(i => i.origem !== 'MANUAL' && !i.manual);
      return [
        ...(importado.length ? [{ label: 'Importados', items: importado }] : []),
        ...(manual.length   ? [{ label: 'Manuais',    items: manual }]    : []),
      ];
    }
    return [{ label: null, items }];
  }, [itensOrdenados, agrupamento]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 'YYYY-MM-DD' local — comparar com as datas do cadastro (que são string) sem
  // passar por new Date(), que jogaria o dia para trás pelo fuso.
  const hojeISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Responsive: fit days into available container width; never below MIN_DAY_W
  const timelineW = containerW > labelW + 60 ? containerW - labelW : 0;
  const DAY_W = timelineW > 0 && days.length > 0
    ? Math.max(MIN_DAY_W, Math.floor(timelineW / days.length))
    : MIN_DAY_W;

  // Keep ref in sync for callbacks
  dayWRef.current = DAY_W;

  const todayX = dateToX(today);
  const totalW = days.length * DAY_W;

  // ABRIR NO DIA DE HOJE: cronograma longo abria no começo (às vezes meses atrás) e
  // a pessoa tinha que rolar até achar onde a obra está. Centraliza a linha de hoje
  // no primeiro render; depois disso não mexe mais — arrastar barra ou rolar à mão
  // não pode ser desfeito por um "reposicionamento" automático.
  const jaCentralizou = useRef(false);
  useEffect(() => {
    if (jaCentralizou.current || !containerRef.current || !DAY_W || !days.length) return;
    // Hoje fora do intervalo do cronograma (obra antiga/futura): não força nada.
    if (todayX < 0 || todayX > totalW) { jaCentralizou.current = true; return; }

    // O scroll é do wrapper externo (SecaoCronograma), não deste componente.
    let el = containerRef.current.parentElement;
    while (el && el !== document.body) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === 'auto' || ox === 'scroll') && el.scrollWidth > el.clientWidth) {
        // + labelW: a coluna fixa da esquerda ocupa espaço antes da linha do tempo.
        const alvo = todayX + labelW - el.clientWidth / 2;
        el.scrollLeft = Math.max(0, alvo);
        jaCentralizou.current = true;
        return;
      }
      el = el.parentElement;
    }
  }, [todayX, totalW, DAY_W, days.length]);

  return (
    <div
      ref={containerRef}
      // w-max (não w-full): a raiz precisa ter a largura do CONTEÚDO (label + timeline
      // inteira). Com w-full ela terminava na borda visível e as barras vazavam para
      // fora da caixa — e aí o `sticky left-0` da coluna Atividade não tinha onde
      // grudar, então ela sumia ao rolar para o lado. min-w-full mantém o fundo
      // ocupando a largura toda quando o cronograma é curto.
      className="relative bg-white select-none w-max min-w-full"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Cabeçalho sticky — fundo cinza + sombra pra destacar das linhas (senão, sendo
          branco igual ao corpo, as barras pareciam atravessar ao rolar). */}
      <div className="sticky top-0 z-20 bg-gray-100 border-b border-gray-300 shadow-sm">
        <div className="flex">
          {/* Label column */}
          <div
            style={{ minWidth: labelW, width: labelW, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}
            className="relative flex-shrink-0 border-r border-gray-300 bg-gray-100 sticky left-0 z-30 px-3 py-2"
          >
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Atividade</span>
            {/* Alça de redimensionar: fica na divisória, no cabeçalho (que está sempre
                visível ao rolar). Larga o suficiente para pegar sem mira fina. */}
            <div
              onMouseDown={iniciarResize}
              onDoubleClick={() => { setLabelW(LABEL_W); localStorage.setItem('gantt:labelW', String(LABEL_W)); }}
              title="Arraste para ajustar a largura (duplo clique volta ao padrão)"
              className="absolute top-0 right-0 h-full w-2 cursor-col-resize hover:bg-blue-400/40 active:bg-blue-500/60 transition-colors"
            />
          </div>
          {/* Timeline header — largura total (rola junto com o corpo no wrapper externo) */}
          <div className="bg-gray-100" style={{ width: totalW }}>
            {/* Row 1: Meses */}
            <div className="flex border-b border-gray-200" style={{ width: totalW }}>
              {/* O rótulo se adapta à largura da faixa: mês inteiro mostra "jan. de 26",
                  mês cortado na ponta mostra só "jan", e faixa muito estreita não mostra
                  nada — antes o texto vazava e um mês atropelava o outro. */}
              {monthHeaders.map(m => {
                const w = m.span * DAY_W;
                const texto = w >= 64 ? m.label : w >= 30 ? m.labelCurto : '';
                return (
                  <div
                    key={m.key}
                    style={{ width: w }}
                    title={m.label}
                    className="flex-shrink-0 border-r border-gray-200 px-1 py-1 text-xs text-gray-600 font-semibold whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {texto}
                  </div>
                );
              })}
            </div>
            {/* Row 2: Semanas (número do dia) a cada 7 dias */}
            <div className="flex" style={{ width: totalW }}>
              {days.map((d, i) => {
                const isMon = d.getDay() === 1;
                const isToday = d.getTime() === today.getTime();
                return (
                  <div
                    key={i}
                    style={{ width: DAY_W, flexShrink: 0 }}
                    className={`border-r border-gray-100 text-center text-xs py-0.5 ${
                      isToday ? 'bg-blue-100 text-blue-700 font-bold' :
                      isMon   ? 'text-gray-500' : 'text-transparent'
                    }`}
                  >
                    {(isMon || isToday) ? d.getDate() : ''}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Label column — sticky left */}
        {/* Sombra à direita: ao rolar, deixa claro que a coluna está FIXA e as barras
            passam por baixo dela (sem isso, parece que o conteúdo se sobrepõe). */}
        <div
          style={{ minWidth: labelW, width: labelW, boxShadow: '2px 0 4px -2px rgba(0,0,0,0.15)' }}
          className="flex-shrink-0 border-r border-gray-200 sticky left-0 z-10 bg-white"
        >
          {grouped.map(({ label, items: gItems }, gi) => (
            <React.Fragment key={gi}>
              {label && (
                <div className="px-3 py-1.5 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {label}
                </div>
              )}
              {gItems.map(item => (
                <div
                  key={item.id}
                  style={{ height: ROW_H }}
                  className="flex items-center px-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  {/* O alerta também no nome: num cronograma longo a barra atrasada
                      pode estar fora da tela, e aí a cor não avisa ninguém. */}
                  {ehAtrasado(item, hojeISO) && (
                    <AlertTriangle className="w-3 h-3 text-red-500 shrink-0 mr-1.5" title="Prazo vencido e não concluída" />
                  )}
                  {canEdit && onEditItem ? (
                    <button
                      type="button"
                      onClick={() => onEditItem(item)}
                      className={`text-xs truncate leading-tight text-left w-full hover:text-blue-600 ${ehAtrasado(item, hojeISO) ? 'text-red-700 font-medium' : 'text-gray-700'}`}
                      title={`${item.nomeAtividade || 'Atividade'} — clique para editar progresso/datas`}
                    >
                      {item.nomeAtividade || 'Atividade'}
                    </button>
                  ) : (
                    <span className={`text-xs truncate leading-tight ${ehAtrasado(item, hojeISO) ? 'text-red-700 font-medium' : 'text-gray-700'}`} title={item.nomeAtividade}>
                      {item.nomeAtividade || 'Atividade'}
                    </span>
                  )}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>

        {/* Gantt bars */}
        <div className="relative" style={{ width: totalW }}>
          {/* Today line */}
          {todayX >= 0 && todayX <= totalW && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-500/60 z-10 pointer-events-none"
              style={{ left: todayX }}
            />
          )}

          {/* Vertical grid lines (Mondays) */}
          {days.map((d, i) => d.getDay() === 1 && (
            <div
              key={i}
              className="absolute top-0 bottom-0 border-l border-gray-200 pointer-events-none"
              style={{ left: i * DAY_W }}
            />
          ))}

          {grouped.map(({ label, items: gItems }, gi) => (
            <React.Fragment key={gi}>
              {label && (
                <div style={{ height: 28 }} className="bg-gray-100 border-b border-gray-200" />
              )}
              {gItems.map(item => {
                const dates = localDates[item.id] || {};
                const inicio = dates.inicio || item.dataInicioPlanejada;
                const fim    = dates.fim    || item.dataFimPlanejada;
                if (!inicio || !fim) {
                  return (
                    <div key={item.id} style={{ height: ROW_H }}
                      className="border-b border-gray-100 relative" />
                  );
                }
                const x1 = dateToX(inicio);
                const x2 = dateToX(fim) + DAY_W;
                const w  = Math.max(x2 - x1, DAY_W);
                const pct = item.percentualConcluido || 0;
                // Atraso manda na cor: prazo vencido sem concluir vira vermelho,
                // independente do status cadastrado (que ninguém mantém em dia).
                const atrasado = ehAtrasado(item, hojeISO);
                const col = atrasado ? STATUS_COLORS.atrasado : getStatusColor(item.status);
                const isActive = dragging?.id === item.id;

                return (
                  <div
                    key={item.id}
                    style={{ height: ROW_H }}
                    className="border-b border-gray-100 relative"
                  >
                    {/* Bar background */}
                    <div
                      style={{ left: x1, width: w, top: 7, height: ROW_H - 14 }}
                      className={`absolute rounded cursor-${canEdit ? 'grab' : 'default'} group ${isActive ? 'opacity-80 ring-2 ring-blue-400' : ''}`}
                      onMouseDown={e => onBarMouseDown(e, item, 'move')}
                      onMouseEnter={e => setTooltip({ item, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* BG track */}
                      <div
                        className="absolute inset-0 rounded opacity-30"
                        style={{ backgroundColor: col.bar }}
                      />
                      {/* Progress fill */}
                      <div
                        className="absolute top-0 left-0 h-full rounded"
                        style={{ width: `${pct}%`, backgroundColor: col.bar, opacity: 0.85 }}
                      />
                      {/* Label inside bar */}
                      {w > 50 && (
                        <div className="absolute inset-0 flex items-center px-2 overflow-hidden pointer-events-none">
                          <span className="text-white text-xs font-medium truncate drop-shadow">{pct}%</span>
                        </div>
                      )}
                      {/* Resize handles */}
                      {canEdit && (
                        <>
                          <div
                            className="absolute left-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20 rounded-l"
                            onMouseDown={e => onBarMouseDown(e, item, 'inicio')}
                          />
                          <div
                            className="absolute right-0 top-0 h-full w-2 cursor-ew-resize hover:bg-white/20 rounded-r"
                            onMouseDown={e => onBarMouseDown(e, item, 'fim')}
                          />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-white border border-gray-200 rounded-lg p-3 shadow-xl pointer-events-none text-xs max-w-xs"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
        >
          <p className="font-semibold text-gray-900 mb-1">{tooltip.item.nomeAtividade}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-gray-600">
            <span>Início:</span><span>{tooltip.item.dataInicioPlanejada ? new Date(tooltip.item.dataInicioPlanejada).toLocaleDateString('pt-BR') : '-'}</span>
            <span>Fim:</span><span>{tooltip.item.dataFimPlanejada ? new Date(tooltip.item.dataFimPlanejada).toLocaleDateString('pt-BR') : '-'}</span>
            <span>Status:</span><span>{tooltip.item.status || 'N/A'}</span>
            <span>Progresso:</span><span>{tooltip.item.percentualConcluido || 0}%</span>
          </div>
          {/* Diz POR QUE a barra está vermelha e há quantos dias — sem isso o alerta
              vira só uma cor sem explicação. */}
          {ehAtrasado(tooltip.item, hojeISO) && (
            <p className="text-red-600 font-medium mt-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Prazo vencido há {Math.max(1, Math.round((today - new Date(`${String(tooltip.item.dataFimPlanejada || tooltip.item.dataInicioPlanejada).slice(0, 10)}T00:00:00`)) / 86400000))} dia(s)
            </p>
          )}
          {canEdit && <p className="text-gray-400 mt-1 text-xs">Arraste para mover · Bordas para redimensionar</p>}
        </div>
      )}
    </div>
  );
}