import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Bell, X, ChevronRight, ChevronLeft, ClipboardList, Ruler, TrendingUp, TrendingDown, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { getVistas, marcarVista, PENDENCIAS_VISTAS_EVENT } from './pendenciasLidas';

const PEND_CFG = {
  diario_nao_lancado:   { label: 'Diário',         icon: ClipboardList },
  bm_pendente:          { label: 'Medição',        icon: Ruler },
  recebimento_atrasado: { label: 'Recebimento',    icon: TrendingUp },
  custo_vencido:        { label: 'Custo',          icon: TrendingDown },
  material_em_falta:    { label: 'Material',       icon: Package },
  caixa_negativo:       { label: 'Fluxo de caixa', icon: AlertTriangle },
};
const SEV_CLS = { alta: 'bg-red-100 text-red-700', media: 'bg-amber-100 text-amber-700', baixa: 'bg-blue-100 text-blue-700' };
const SEV_DOT = { alta: 'text-red-500', media: 'text-amber-500', baixa: 'text-blue-500' };
const labelTipoNotif = (t) => String(t || 'aviso').replace(/_/g, ' ');
const POR_PAGINA = 5;

export default function BellNotifications({ tema = 'escuro' }) {
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [user, setUser] = useState(null);
  const [, setVistasV] = useState(0); // força recomputo quando "vistas" muda
  const queryClient = useQueryClient();
  const containerRef = useRef(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  // Fecha ao clicar/tocar fora do sino+popup (pointerdown cobre desktop e mobile).
  // Robusto a z-index (não depende do backdrop, que fica preso ao contexto do header).
  useEffect(() => {
    if (!aberto) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [aberto]);

  // Recomputa quando o usuário marca uma pendência como vista (aqui ou na página)
  useEffect(() => {
    const bump = () => setVistasV((v) => v + 1);
    window.addEventListener(PENDENCIAS_VISTAS_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => { window.removeEventListener(PENDENCIAS_VISTAS_EVENT, bump); window.removeEventListener('storage', bump); };
  }, []);

  const { data: pendData } = useQuery({
    queryKey: ['pendencias-bell'],
    queryFn: async () => (await base44.functions.invoke('listarPendencias', {})).data,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes-nao-lidas', user?.email],
    queryFn: async () => (await base44.entities.Notificacao?.filter({ destinatario_email: user.email, lida: false }, '-created_date', 20)) || [],
    enabled: !!user?.email,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  const vistas = getVistas();
  const pendVisiveis = (pendData?.pendencias || []).filter((p) => !vistas.has(p.id));

  // Lista unificada (pendências não-vistas + notificações não-lidas)
  const itens = [
    ...pendVisiveis.map((p) => ({ ...p, _kind: 'pend' })),
    ...notificacoes.map((n) => ({ ...n, _kind: 'notif' })),
  ];
  const totalBadge = itens.length;

  const totalPaginas = Math.max(1, Math.ceil(itens.length / POR_PAGINA));
  const pagAtual = Math.min(pagina, totalPaginas);
  const itensPagina = itens.slice((pagAtual - 1) * POR_PAGINA, pagAtual * POR_PAGINA);

  const onClickPend = (p) => { marcarVista(p.id); setAberto(false); };
  const onClickNotif = async (n) => {
    try { await base44.entities.Notificacao?.update(n.id, { lida: true }); queryClient.invalidateQueries({ queryKey: ['notificacoes-nao-lidas'] }); } catch (_) { /* noop */ }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={() => { setAberto((v) => !v); setPagina(1); }} className={`${tema === 'claro' ? 'text-gray-600 hover:bg-gray-100' : 'text-slate-100 hover:bg-white/10'} p-2 rounded-lg relative transition-colors`} aria-label="Notificações">
        <Bell className="w-5 h-5" />
        {totalBadge > 0 && (
          <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center bg-red-500 text-white text-xs border-0">
            {totalBadge > 9 ? '9+' : totalBadge}
          </Badge>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="fixed top-16 right-2 w-[calc(100vw-1rem)] max-w-sm md:absolute md:top-full md:right-0 md:mt-2 md:w-[380px] md:max-w-none bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">Notificações & Pendências</h3>
              <div className="flex items-center gap-2">
                <Link to={createPageUrl('MinhasNotificacoes')} onClick={() => setAberto(false)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Ver tudo</Link>
                <button onClick={() => setAberto(false)} className="p-1 hover:bg-gray-100 rounded text-gray-500"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="max-h-[55vh] md:max-h-[24rem] overflow-y-auto divide-y divide-gray-100">
              {itensPagina.map((it) => {
                if (it._kind === 'pend') {
                  const cfg = PEND_CFG[it.tipo] || { label: 'Pendência', icon: AlertTriangle };
                  const Icon = cfg.icon;
                  return (
                    <Link key={it.id} to={it.link || '#'} onClick={() => onClickPend(it)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${SEV_DOT[it.severidade] || 'text-gray-400'}`} />
                      <div className="flex-1 min-w-0">
                        <Badge className={`text-[10px] border-0 mb-0.5 ${SEV_CLS[it.severidade] || 'bg-gray-100 text-gray-700'}`}>{cfg.label}</Badge>
                        <p className="text-sm font-medium text-gray-900 leading-tight">{it.titulo}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{it.mensagem}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                    </Link>
                  );
                }
                // notificação salva
                const inner = (
                  <>
                    <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Badge className="bg-gray-100 text-gray-700 text-[10px] border-0 mb-0.5 capitalize">{labelTipoNotif(it.tipo)}</Badge>
                      <p className="text-sm font-medium text-gray-900 leading-tight">{it.titulo}</p>
                      {it.mensagem && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{it.mensagem}</p>}
                    </div>
                  </>
                );
                return it.link_acao ? (
                  <a key={it.id} href={it.link_acao} onClick={() => onClickNotif(it)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">{inner}</a>
                ) : (
                  <div key={it.id} onClick={() => onClickNotif(it)} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">{inner}</div>
                );
              })}

              {itens.length === 0 && (
                <div className="px-6 py-10 text-center text-gray-400 text-sm">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  Tudo em dia — sem pendências.
                </div>
              )}
            </div>

            {/* Paginação (sempre visível) */}
            {itens.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-gray-200 bg-gray-50">
                <span className="text-[11px] text-gray-500">{itens.length} no total</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-7 px-2 border-gray-300 text-gray-700" disabled={pagAtual <= 1} onClick={() => setPagina((p) => Math.max(1, p - 1))}><ChevronLeft className="w-3.5 h-3.5" /></Button>
                  <span className="text-[11px] text-gray-600">{pagAtual}/{totalPaginas}</span>
                  <Button variant="outline" size="sm" className="h-7 px-2 border-gray-300 text-gray-700" disabled={pagAtual >= totalPaginas} onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}><ChevronRight className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
