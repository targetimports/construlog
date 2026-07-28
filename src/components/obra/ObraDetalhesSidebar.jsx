import React from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, Calendar, DollarSign, FileText, FolderOpen, LayoutDashboard, Package, Users, ClipboardList, Truck } from 'lucide-react';

// Navegação enxuta da obra: 9 seções agrupadas por fluxo de trabalho.
// Os assuntos que viraram abas internas: Contratos (→ Orçamento & Contratos);
// Recebimentos/Custos Previstos/Centro de Custos (→ Financeiro); Compras/
// Materiais (→ Suprimentos); Equipe/Diário/Presença/Diárias (→ Equipe & Diário).
// "Saída de Estoque" é uma AÇÃO — vive dentro de Suprimentos → Estoque da Obra.
export const SECOES = [
  { id: 'visao_geral',   nome: 'Visão Geral',           icon: LayoutDashboard },
  { id: 'orcamento',     nome: 'Orçamento & Contratos', icon: FileText },
  { id: 'cronograma',    nome: 'Cronograma',            icon: Calendar },
  { id: 'medicoes',      nome: 'Medições',              icon: ClipboardList },
  { id: 'financeiro',    nome: 'Financeiro',            icon: DollarSign },
  { id: 'suprimentos',   nome: 'Suprimentos',           icon: Package },
  { id: 'ativos',        nome: 'Veículos & Ativos',     icon: Truck },
  { id: 'equipe_diario', nome: 'Equipe & Diário',       icon: Users },
  { id: 'documentos',    nome: 'Documentos',            icon: FolderOpen },
  { id: 'relatorios',    nome: 'Relatórios',            icon: BarChart3 },
];

export default function ObraDetalhesSidebar({ activeSecao, onSelectSecao, variant = 'desktop' }) {
  // Mobile: barra horizontal rolável (as seções não cabem numa sidebar no celular)
  if (variant === 'mobile') {
    return (
      <div className="md:hidden bg-white border-b border-gray-200 overflow-x-auto flex-shrink-0">
        <nav className="flex gap-1 p-2 min-w-max">
          {SECOES.map(secao => {
            const Icon = secao.icon;
            const isActive = activeSecao === secao.id;
            return (
              <button
                key={secao.id}
                onClick={() => onSelectSecao(secao.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap flex-shrink-0 transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-semibold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                )}
              >
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-gray-900' : 'text-gray-400')} />
                <span className="text-sm">{secao.nome}</span>
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop: sidebar vertical
  return (
    <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Seções</h2>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {SECOES.map(secao => {
          const Icon = secao.icon;
          const isActive = activeSecao === secao.id;
          return (
            <button
              key={secao.id}
              onClick={() => onSelectSecao(secao.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                isActive
                  ? 'bg-gray-100 text-gray-900 font-semibold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              <Icon className={cn('w-[18px] h-[18px] flex-shrink-0', isActive ? 'text-gray-900' : 'text-gray-400')} />
              <span className="text-sm">{secao.nome}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
