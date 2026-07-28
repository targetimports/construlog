import React from 'react';
import { cn } from '@/lib/utils';

/**
 * StatCard - Componente de exibição de estatísticas
 * - Renderiza conteúdo da stat (valor, título, subtítulo, etc)
 * - NUNCA navega ou interage (apenas exibição)
 * - Deve ser envolvido por SafeCardNavigator para ter clique com permissão
 */
export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendUp,
  className,
  iconBg = "bg-blue-50",
  iconColor = "text-blue-500",
  clickable = false,
  // bare = sem moldura própria (borda/fundo/sombra/padding). Usado quando o
  // StatCard já está dentro de outro card (ex.: SafeStatCard) — evita borda dupla.
  bare = false
}) {
  return (
    <div className={cn(
      bare
        ? "w-full"
        : cn(
            "bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-200 hover:shadow-sm transition-all duration-300",
            clickable && "cursor-pointer hover:border-blue-300 hover:shadow-md"
          ),
      className
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-gray-600 text-xs font-medium truncate">{title}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 tracking-tight truncate tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              trendUp ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            )}>
              {trendUp ? "↑" : "↓"} {trend}
            </div>
          )}
        </div>
        <div className={cn("p-2 rounded-lg flex-shrink-0", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
      </div>
    </div>
  );
}