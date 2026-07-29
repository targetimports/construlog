import React from 'react';
import { LogOut, User, Bell, ChevronDown, Building2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import UserAvatar from '../shared/UserAvatar';
import BellNotifications from '../shared/BellNotifications';
import { useEmpresa } from '../shared/useEmpresaContext';
import { menuItems } from './navigation';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';


// Mapa de rótulos amigáveis (com acento) montado a partir do próprio menu —
// page -> name. Cobre todas as páginas que aparecem na navegação.
const MENU_TITULOS = (() => {
  const map = {};
  const add = (it) => { if (it?.page && it?.name) map[it.page] = it.name; };
  for (const item of (menuItems || [])) {
    add(item);
    for (const g of (item.groups || [])) for (const sub of (g.items || [])) add(sub);
  }
  return map;
})();

// Overrides para páginas que NÃO estão no menu (detalhes/formulários) ou cujo
// rótulo do menu não é o ideal no cabeçalho. Têm prioridade sobre o menu.
const TITULOS_PAGINA = {
  Tesouraria: 'Caixa e Bancos',
  Frota: 'Frota de Veículos',
  ImportarOrcaFacil: 'Importar OrçaFascio',
  ObraDetalhes: 'Detalhes da Obra',
  ObraForm: 'Cadastro de Obra',
  OrcamentoDetalhes: 'Detalhes do Orçamento',
  OrcamentoForm: 'Cadastro de Orçamento',
  ContratoDetalhes: 'Detalhes do Contrato',
  ContratoForm: 'Cadastro de Contrato',
  MedicaoForm: 'Nova Medição',
  ComposicaoDetalhes: 'Detalhes da Composição',
  LicitacaoDetalhes: 'Detalhes da Licitação',
  LicitacaoForm: 'Cadastro de Licitação',
  ColaboradorDetalhes: 'Detalhes do Colaborador',
  InsumoForm: 'Cadastro de Insumo',
  OCForm: 'Nova Ordem de Compra',
  ComprasForm: 'Nova Compra',
  ConfiguracoesEmpresa: 'Configurações da Empresa',
  TimelineObra: 'Timeline da Obra',
  EmissaoNFe: 'Emissão de NF-e',
  NovaNotaFiscal: 'Nova Nota Fiscal',
  RevisarNotaFiscal: 'Revisar Nota Fiscal',
  CurvaSFluxoCaixa: 'Curva S e Fluxo de Caixa',
  ConsolidadoFinanceiroV2: 'Consolidado Financeiro',
};

// Fallback: "de-camelCasa" o nome da rota (ex.: EstoqueProfissional ->
// "Estoque Profissional", SuprimentosPedidos -> "Suprimentos Pedidos").
function humanizarRota(nome) {
  if (!nome) return 'Painel de Controle';
  return String(nome)
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d+)/g, '$1 $2')
    .trim();
}

// Título amigável da página, reutilizado também pelo header mobile (Layout).
export function getTituloPagina(currentPageName) {
  return (
    TITULOS_PAGINA[currentPageName] ||
    MENU_TITULOS[currentPageName] ||
    humanizarRota(currentPageName)
  );
}

export default function TopHeader({ currentPageName }) {
  const navigate = useNavigate();
  const tituloPagina = getTituloPagina(currentPageName);
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { empresa, matriz, acessoGlobal } = useEmpresa();
  const empresaLabel = acessoGlobal ? `${matriz?.nome || 'Grupo Construlog'} · Matriz` : (empresa?.nome || '');

  const cargoLabel = user?.cargo || (user?.role === 'admin' ? 'Administrador' : 'Usuário');

  const handleLogout = async () => {
    try { await base44.auth.logout(); } catch {}
    window.location.reload();
  };

  return (
    <div className="flex flex-col">
      {/* Header Principal */}
      <div className="bg-white/85 backdrop-blur-md border-b border-gray-200/70 text-gray-900 px-3 h-14 md:h-16 md:px-6 flex items-center justify-between gap-3 md:gap-4">
        {/* Left side - Title and subtitle */}
        <div className="min-w-0 flex-1">
          <h1 className="text-gray-900 text-base font-bold md:text-lg truncate">{tituloPagina}</h1>
          <p className="text-gray-500 text-xs hidden sm:block md:text-sm truncate">
            Bem-vindo(a), <span className="text-gray-700 font-semibold">{user?.full_name || 'Usuário'}</span>
          </p>
        </div>

        {/* Right side - Notifications and User */}
        <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
          {empresaLabel && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700" title="Empresa em contexto">
              <Building2 className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
              <span className="truncate max-w-[200px]">{empresaLabel}</span>
            </div>
          )}
          {/* Bell Notifications */}
          <BellNotifications tema="claro" />

          {/* Separador discreto entre notificações e o menu do usuário */}
          <div className="hidden sm:block w-px h-7 bg-gray-200" aria-hidden="true" />

          {/* User menu (avatar dropdown) — modal=false: não trava o scroll do body
              (mantém a scrollbar e evita qualquer deslocamento de layout) */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 md:gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="Conta"
              >
                <div className="text-right hidden md:block">
                  <p className="text-gray-900 text-sm font-semibold leading-tight">
                    {user?.full_name || 'Usuário'}
                  </p>
                  <p className="text-gray-500 text-xs leading-tight uppercase">{cargoLabel}</p>
                </div>
                <UserAvatar user={user} size="sm" />
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" alignOffset={-8} sideOffset={8} className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold truncate">{user?.full_name || 'Usuário'}</span>
                  <span className="text-xs font-normal text-gray-500 truncate">{user?.email || ''}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(createPageUrl('AjustesPessoais'))}>
                <User className="w-4 h-4 mr-2" />
                Editar perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(createPageUrl('MinhasNotificacoes'))}>
                <Bell className="w-4 h-4 mr-2" />
                Minhas notificações
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
