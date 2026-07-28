import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { ScrollText, RefreshCw, Search, AlertTriangle } from 'lucide-react';

const fmtBytes = (n) => {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(2)} MB`;
};
const fmtData = (ts) => (ts ? new Date(ts).toLocaleString('pt-BR') : '—');

const statusCor = (s) => {
  if (s >= 500) return 'bg-red-100 text-red-700';
  if (s >= 400) return 'bg-amber-100 text-amber-700';
  if (s >= 200 && s < 300) return 'bg-emerald-100 text-emerald-700';
  return 'bg-gray-100 text-gray-600';
};

function LogsSistemaContent() {
  const [nivel, setNivel] = useState('todos');
  const [busca, setBusca] = useState('');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['log-sistema'],
    queryFn: () => base44.functions.invoke('lerLogSistema', { limite: 1000 }).then((r) => r.data),
    staleTime: 10000,
  });

  const linhas = data?.linhas || [];

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (nivel !== 'todos' && (l.level || 'info') !== nivel) return false;
      if (!q) return true;
      return [l.path, l.user, l.method, l.error, String(l.status), l.raw]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [linhas, nivel, busca]);

  const erros = linhas.filter((l) => l.level === 'error').length;

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtradas, 25);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gray-900 rounded-lg"><ScrollText className="h-5 w-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log do Sistema</h1>
            <p className="text-gray-500 text-sm mt-0.5">Mutações (create/update/delete) e erros registrados no arquivo <code className="text-xs">app.log</code></p>
          </div>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2 w-full sm:w-auto" disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase">Linhas no arquivo</p><p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums mt-1">{data?.total ?? 0}</p></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase">Carregadas</p><p className="text-2xl sm:text-3xl font-bold text-blue-600 tabular-nums mt-1">{linhas.length}</p></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase">Erros (carregados)</p><p className="text-2xl sm:text-3xl font-bold text-red-600 tabular-nums mt-1">{erros}</p></CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-3 sm:p-4"><p className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase">Tamanho / 5 MB</p><p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums mt-1">{fmtBytes(data?.tamanho)}</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="w-full sm:w-52">
          <ComboboxBusca
            options={[{ value: 'todos', label: 'Todos os níveis' }, { value: 'error', label: 'Somente erros' }, { value: 'info', label: 'Somente mutações' }]}
            value={nivel}
            onSelect={(v) => setNivel(v || 'todos')}
            placeholder="Nível"
          />
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9 h-11" placeholder="Buscar por rota, usuário, método, erro..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-500">Carregando log…</div>
      ) : filtradas.length === 0 ? (
        <Card className="bg-white border-gray-200"><CardContent className="py-16 text-center text-gray-500">
          <ScrollText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          Nenhum registro {linhas.length ? 'para esse filtro' : 'ainda'}.
        </CardContent></Card>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data / hora</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Nível</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Método</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Rota</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Usuário</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">ms</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedItems.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtData(l.ts)}</td>
                    <td className="px-3 py-2.5">
                      {l.level === 'error'
                        ? <Badge className="bg-red-100 text-red-700 border-0 gap-1"><AlertTriangle className="w-3 h-3" />erro</Badge>
                        : <Badge className="bg-gray-100 text-gray-600 border-0">info</Badge>}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{l.method || '—'}</td>
                    <td className="px-3 py-2.5 text-gray-800 break-all">
                      {l.path || l.raw || '—'}
                      {l.error && <div className="text-xs text-red-500 mt-0.5 break-words">{l.error}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-center">{l.status ? <Badge className={`border-0 ${statusCor(l.status)}`}>{l.status}</Badge> : '—'}</td>
                    <td className="px-3 py-2.5 text-gray-600 break-all">{l.user || '—'}</td>
                    <td className="px-3 py-2.5 text-right text-gray-400 tabular-nums">{l.ms ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile */}
          <div className="md:hidden flex flex-col gap-y-2 p-2">
            {paginatedItems.map((l, i) => (
              <div key={i} className="p-3 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {l.level === 'error'
                      ? <Badge className="bg-red-100 text-red-700 border-0">erro</Badge>
                      : <Badge className="bg-gray-100 text-gray-600 border-0">info</Badge>}
                    <span className="font-mono text-xs text-gray-700">{l.method}</span>
                  </div>
                  {l.status ? <Badge className={`border-0 ${statusCor(l.status)}`}>{l.status}</Badge> : null}
                </div>
                <p className="text-sm text-gray-800 break-all mt-1.5">{l.path || l.raw || '—'}</p>
                {l.error && <p className="text-xs text-red-500 break-words mt-0.5">{l.error}</p>}
                <div className="flex items-center justify-between gap-2 mt-1.5 text-xs text-gray-500">
                  <span className="break-all">{l.user || '—'}</span>
                  <span className="whitespace-nowrap">{fmtData(l.ts)}</span>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
          )}
        </div>
      )}
      <p className="text-xs text-gray-400">Mostra as últimas 1000 linhas do arquivo. Ao passar de 5 MB, o log é reiniciado automaticamente.</p>
    </div>
  );
}

export default function LogsSistema() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="ADMIN_CONFIG">
      <LogsSistemaContent />
    </RouteGuardFinalV2>
  );
}
