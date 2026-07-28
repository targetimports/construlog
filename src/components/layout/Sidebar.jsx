import React, { useState, useEffect, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import { Settings, ChevronDown, PanelLeftClose, PanelLeftOpen, Search, X } from 'lucide-react';
import { useRBAC } from '@/components/shared/RBACContext';
import { isCompanyAdmin } from '@/components/auth/rbacHelpers';
import { useBranding } from '@/components/shared/useBranding';

export default function Sidebar({ items = [], isMobile = false, user = null, onNavigate }) {
  const location = useLocation();
  const branding = useBranding();
  const currentPageName = location.pathname.split('/').filter(Boolean).pop() || 'Dashboard';

  const {
    // RBACContext expõe o mapa como `effectivePermissionsV2`; aliasamos para o
    // nome local `effectivePermissions` usado abaixo (bug: antes lia campo inexistente).
    effectivePermissionsV2: effectivePermissions = {},
    isSuperAdmin,
    rbacReady,
    bypassMode,
    isCompanyAdmin: isCompanyAdminRbac,
  } = useRBAC();

  // ───────── Recolher (somente desktop) ─────────
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const effCollapsed = collapsed && !isMobile;

  // Preferência MANUAL do usuário (persistida). A auto-recolha ao abrir os
  // detalhes da obra é transitória e não deve sobrescrever esta preferência.
  const prefManualRef = useRef(collapsed);
  const setCollapsedManual = (val) => {
    prefManualRef.current = val;
    try { localStorage.setItem('sidebar-collapsed', String(val)); } catch {}
    setCollapsed(val);
  };

  // A largura CSS acompanha o estado efetivo (a animação fica no <aside>).
  useEffect(() => {
    if (isMobile) return;
    document.documentElement.style.setProperty('--sidebar-width', collapsed ? '68px' : '240px');
  }, [collapsed, isMobile]);

  // Ao ENTRAR em ObraDetalhes, recolhe a navbar (libera espaço pra tela de
  // detalhes); ao SAIR, restaura a preferência manual. Não persiste a recolha
  // automática, então a escolha manual do usuário é preservada.
  // Páginas que mantêm a navbar recolhida (mais espaço para a tela da obra).
  // Navegar ENTRE elas mantém recolhido; só restaura ao sair do grupo.
  const PAGINAS_RECOLHER = ['ObraDetalhes', 'ObraForm', 'BMDetalhes', 'ContratoVersao'];
  const prevPageRef = useRef(null);
  useEffect(() => {
    if (isMobile) return;
    const isObra = PAGINAS_RECOLHER.includes(currentPageName);
    const wasObra = PAGINAS_RECOLHER.includes(prevPageRef.current);
    if (isObra && !wasObra) {
      setCollapsed(true);
    } else if (!isObra && wasObra) {
      setCollapsed(prefManualRef.current);
    }
    prevPageRef.current = currentPageName;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageName, isMobile]);

  // ───────── Permissões ─────────
  const canSee = (permKey) => {
    if (isSuperAdmin) return true;
    if (bypassMode && (isSuperAdmin || isCompanyAdminRbac)) return true;
    if (!rbacReady) return false;
    if (!permKey) return true;
    return effectivePermissions[String(permKey).trim()] === true;
  };

  // Alguns itens/páginas exigem uma LISTA de roles (RequireRole na página). Se a página
  // restringe por role, o item da sidebar só aparece para essas roles — assim o menu não
  // mostra algo que a página vai barrar. Super admin sempre vê.
  // Espelha o RequireRole das páginas: super, admin, programador e diretor sempre passam;
  // usa cargo||role como o guard. Assim o menu não mostra o que a página vai barrar.
  const userRole = String(user?.cargo || user?.role || '').toLowerCase().trim();
  const roleOk = (node) => {
    if (isSuperAdmin || userRole === 'diretor') return true;
    if (!Array.isArray(node?.allowedRoles) || node.allowedRoles.length === 0) return true;
    return node.allowedRoles.map((r) => String(r).toLowerCase()).includes(userRole);
  };

  const shouldRenderItem = (item) => {
    if ((isCompanyAdmin(user) || (bypassMode && isCompanyAdminRbac)) && item.id === 'ti') return false;
    return canSee(item.requiredPermissionKey) && roleOk(item);
  };

  const childrenOf = (item) => {
    if (!item.groups) return [];
    return item.groups
      .map((g) => ({ ...g, items: (g.items || []).filter((s) => canSee(s.requiredPermissionKey) && roleOk(s)) }))
      .filter((g) => g.items.length > 0);
  };

  const isChildActive = (item) =>
    (item.groups || []).some((g) => (g.items || []).some((s) => s.page === currentPageName));
  const isItemActive = (item) => currentPageName === item.page || isChildActive(item);

  const navItems = items.filter(
    (i) => i.name !== 'Ajustes' && i.id !== 'atalhos' && i.name !== 'Atalhos' && shouldRenderItem(i)
  );
  const ajustesItem = items.find((i) => i.name === 'Ajustes' && shouldRenderItem(i));

  // ───────── Expansão (acordeão) ─────────
  const [open, setOpen] = useState({});
  useEffect(() => {
    const activeParent = items.find((i) => isChildActive(i));
    if (activeParent) setOpen((prev) => ({ ...prev, [activeParent.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageName]);
  const toggle = (id) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }));

  // Ao RECOLHER a sidebar (desktop), fecha todos os submenus — assim, ao
  // reabrir, os itens ficam sempre nas mesmas posições. (Clicar num ícone-pai
  // recolhido continua abrindo aquele submenu, pois isso acontece ao EXPANDIR.)
  useEffect(() => {
    if (effCollapsed) setOpen({});
  }, [effCollapsed]);

  // ───────── Busca ─────────
  const [busca, setBusca] = useState('');
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const q = norm(busca);
  const resultados = q
    ? (() => {
        const out = [];
        for (const item of navItems) {
          const kids = childrenOf(item);
          if (kids.length === 0) {
            if (norm(item.name).includes(q)) out.push({ key: item.id, page: item.page, label: item.name, parent: null });
          } else {
            const paiMatch = norm(item.name).includes(q);
            for (const g of kids) {
              for (const sub of g.items) {
                if (paiMatch || norm(sub.name).includes(q)) {
                  out.push({ key: sub.id, page: sub.page, label: sub.name, parent: item.name, badge: sub.badge });
                }
              }
            }
          }
        }
        return out;
      })()
    : null;

  const rowBase =
    'group flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-sm transition-colors focus:outline-none';

  // Destaque do item ativo: pílula translúcida sutil (igual no mobile e desktop).
  const ativoCls = 'bg-white/10 text-white';

  const Badge = ({ children }) => (
    <span className="ml-auto px-1.5 py-0.5 min-w-[18px] text-center text-[10px] font-semibold rounded-full bg-white/10 text-zinc-300 flex-shrink-0">
      {children}
    </span>
  );

  // ───────── Item recolhido (só ícone) ─────────
  const renderCollapsedItem = (item) => {
    const Icon = item.icon;
    const kids = childrenOf(item);
    const active = isItemActive(item);
    const base = cn(
      'flex items-center justify-center w-11 h-10 mx-auto rounded-lg transition-colors',
      active ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
    );

    if (kids.length === 0) {
      return (
        <Link
          key={item.id}
          to={createPageUrl(item.page)}
          onClick={() => { setCollapsedManual(false); onNavigate?.(); }}
          title={item.name}
          className={base}
        >
          {Icon && <Icon className="w-5 h-5" />}
        </Link>
      );
    }
    return (
      <button
        key={item.id}
        type="button"
        title={item.name}
        onClick={() => { setCollapsedManual(false); setOpen({ [item.id]: true }); }}
        className={base}
      >
        {Icon && <Icon className="w-5 h-5" />}
      </button>
    );
  };

  // ───────── Item expandido (com filhos) ─────────
  const renderExpandedItem = (item) => {
    const Icon = item.icon;
    const kids = childrenOf(item);
    const active = isItemActive(item);
    const expanded = !!open[item.id];

    if (kids.length === 0) {
      return (
        <Link
          key={item.id}
          to={createPageUrl(item.page)}
          onClick={onNavigate}
          title={item.name}
          className={cn(rowBase, active ? `${ativoCls} font-medium` : 'text-gray-300 hover:bg-white/5 hover:text-white')}
        >
          {Icon && <Icon className="w-[18px] h-[18px] flex-shrink-0" />}
          <span className="truncate">{item.name}</span>
        </Link>
      );
    }

    return (
      <div key={item.id}>
        <button
          type="button"
          onClick={() => toggle(item.id)}
          aria-expanded={expanded}
          className={cn(rowBase, active && !expanded ? 'text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white')}
        >
          {Icon && <Icon className="w-[18px] h-[18px] flex-shrink-0" />}
          <span className="truncate">{item.name}</span>
          <ChevronDown className={cn('ml-auto w-4 h-4 flex-shrink-0 text-gray-500 transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="mt-0.5 mb-1 ml-[19px] pl-3 border-l border-white/10 space-y-2">
            {kids.map((group) => (
              <div key={group.id} className="space-y-0.5">
                {group.title && (
                  <p className="px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    {group.title}
                  </p>
                )}
                {group.items.map((sub) => {
                  const subActive = currentPageName === sub.page;
                  return (
                    <Link
                      key={sub.id}
                      to={createPageUrl(sub.page)}
                      onClick={onNavigate}
                      title={sub.name}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                        subActive ? `${ativoCls} font-medium` : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      )}
                    >
                      <span className="truncate">{sub.name}</span>
                      {sub.badge && <Badge>{sub.badge}</Badge>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'bg-[#18181B] text-zinc-300 flex flex-col z-50',
        !isMobile && 'transition-[width] duration-300 ease-in-out',
        isMobile ? 'relative w-full h-full' : effCollapsed ? 'fixed top-0 left-0 h-screen w-[68px]' : 'fixed top-0 left-0 h-screen w-60'
      )}
      style={{
        borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.06)',
        // No mobile, reserva a área da barra de gestos do sistema para o rodapé
        // (Ajustes) não ficar escondido atrás dela.
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : undefined,
      }}
    >
      {/* Header — mobile: logo + botão fechar; desktop: logo + recolher */}
      <div className={cn('flex items-center h-14 md:h-16 flex-shrink-0 overflow-hidden', isMobile ? 'gap-2 px-4' : effCollapsed ? 'justify-center px-2' : 'gap-2 px-4')}>
        {isMobile ? (
          <>
            <img src={branding.logo_url} alt={branding.nome} className="h-9 w-auto max-w-[150px] object-contain object-left shrink-0" />
            <button
              type="button"
              onClick={onNavigate}
              aria-label="Fechar menu"
              className="ml-auto w-10 h-10 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </>
        ) : effCollapsed ? (
          <button
            type="button"
            onClick={() => setCollapsedManual(false)}
            title="Expandir menu"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/5"
          >
            <PanelLeftOpen className="w-5 h-5" />
          </button>
        ) : (
          <>
            <img src={branding.logo_url} alt={branding.nome} className="h-9 w-auto max-w-[160px] object-contain object-left shrink-0" />
            <button
              type="button"
              onClick={() => setCollapsedManual(true)}
              title="Recolher menu"
              className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Busca — recolhida vira um ícone no mesmo lugar, p/ os ícones não subirem */}
      {(rbacReady || isSuperAdmin) && (
        <div className={cn('px-3 flex-shrink-0', effCollapsed ? 'pb-0.5' : 'pb-2')}>
          {effCollapsed ? (
            <button
              type="button"
              onClick={() => setCollapsedManual(false)}
              title="Buscar no menu"
              className="flex items-center justify-center w-11 h-10 mx-auto rounded-lg text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
          ) : (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar no menu..."
                className="w-full rounded-lg bg-white/5 border border-white/10 pl-8 pr-8 py-2 text-sm text-slate-100 placeholder:text-gray-500 outline-none focus:border-white/25 focus:bg-white/10"
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  title="Limpar"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navegação */}
      {!rbacReady && !isSuperAdmin ? (
        <div
          className="flex-1 overflow-hidden py-3 px-2 space-y-1 animate-pulse"
          aria-label="Carregando menu"
          aria-busy="true"
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className={cn('flex items-center rounded-lg', effCollapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-2.5 py-2.5')}
            >
              <div className="w-5 h-5 rounded-md bg-white/10 flex-shrink-0" />
              {!effCollapsed && (
                <div
                  className="h-3 rounded bg-white/10"
                  style={{ width: `${52 + ((i * 13) % 38)}%` }}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden px-2 space-y-0.5 sidebar-scroll', effCollapsed ? 'pt-0 pb-3' : 'py-3')}>
          {resultados && !effCollapsed ? (
            resultados.length > 0 ? (
              resultados.map((r) => (
                <Link
                  key={r.key}
                  to={createPageUrl(r.page)}
                  onClick={onNavigate}
                  title={r.label}
                  className={cn(
                    'flex flex-col rounded-lg px-2.5 py-2 text-sm transition-colors',
                    currentPageName === r.page ? ativoCls : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span className="truncate flex items-center gap-2">
                    {r.label}
                    {r.badge && <Badge>{r.badge}</Badge>}
                  </span>
                  {r.parent && <span className="text-[11px] text-gray-500 truncate">{r.parent}</span>}
                </Link>
              ))
            ) : (
              <p className="px-2.5 py-4 text-sm text-gray-500 text-center">Nenhum item encontrado.</p>
            )
          ) : (
            navItems.map((item) => (effCollapsed ? renderCollapsedItem(item) : renderExpandedItem(item)))
          )}
        </nav>
      )}

      {/* Ajustes (rodapé) */}
      {ajustesItem && ajustesItem.page && (
        <div className="p-2 flex-shrink-0">
          {effCollapsed ? (
            <Link
              to={createPageUrl(ajustesItem.page)}
              onClick={onNavigate}
              title={ajustesItem.name}
              className={cn('flex items-center justify-center w-11 h-10 mx-auto rounded-lg', isItemActive(ajustesItem) ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white')}
            >
              {React.createElement(ajustesItem.icon || Settings, { className: 'w-5 h-5' })}
            </Link>
          ) : (
            <Link
              to={createPageUrl(ajustesItem.page)}
              onClick={onNavigate}
              className={cn(rowBase, isItemActive(ajustesItem) ? `${ativoCls} font-medium` : 'text-gray-300 hover:bg-white/5 hover:text-white')}
            >
              {React.createElement(ajustesItem.icon || Settings, { className: 'w-[18px] h-[18px] flex-shrink-0' })}
              <span className="truncate">{ajustesItem.name}</span>
            </Link>
          )}
        </div>
      )}

    </aside>
  );
}
