import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// Kit de skeletons de carregamento — "preenchem" a área de conteúdo no lugar de
// spinners/"Carregando...". Padrão do sistema (fundo branco, cinza translúcido).

// Tabela: cabeçalho + linhas, com a 1ª coluna mais larga.
// bare=true: sem o card externo (use dentro de um Card/CardContent já existente).
export function TableSkeleton({ rows = 8, cols = 5, bare = false, className }) {
  const conteudo = (
    <>
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className={cn('h-3', i === 0 ? 'flex-[1.5]' : 'flex-1')} />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="px-4 py-3.5 flex gap-4 items-center">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className={cn('h-3', c === 0 ? 'flex-[1.5]' : 'flex-1')} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
  if (bare) return <div className={cn('overflow-hidden', className)}>{conteudo}</div>;
  return <div className={cn('bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden', className)}>{conteudo}</div>;
}

// Grade de KPIs (cards com rótulo, número e ícone).
export function KpiCardsSkeleton({ count = 4, className }) {
  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2.5 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-14" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Grade de cards de conteúdo (ex.: obras, itens).
export function CardGridSkeleton({ count = 6, cols = 'md:grid-cols-2 xl:grid-cols-3', className }) {
  return (
    <div className={cn('grid grid-cols-1 gap-4', cols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-2 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}

// Lista de itens (ícone + 2 linhas).
export function ListSkeleton({ rows = 6, className }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
          <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Formulário (rótulos + campos).
export function FormSkeleton({ fields = 6, className }) {
  return (
    <div className={cn('bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-5', className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Página completa: título + KPIs + tabela (genérico, "preenche" a tela toda).
export function PageSkeleton({ kpis = 4, rows = 8, cols = 5, className }) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <KpiCardsSkeleton count={kpis} />
      <TableSkeleton rows={rows} cols={cols} />
    </div>
  );
}
