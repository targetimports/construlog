import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { cn } from '@/lib/utils';
import { ScrollText, Users, CalendarDays, Clock, Search, ShieldX } from 'lucide-react';

const PER_PAGE = 15;

const ACAO_CFG = {
  criar: { label: 'Criar', badge: 'bg-emerald-100 text-emerald-700' },
  create: { label: 'Criar', badge: 'bg-emerald-100 text-emerald-700' },
  atualizar: { label: 'Atualizar', badge: 'bg-blue-100 text-blue-700' },
  update: { label: 'Atualizar', badge: 'bg-blue-100 text-blue-700' },
  editar: { label: 'Editar', badge: 'bg-blue-100 text-blue-700' },
  excluir: { label: 'Excluir', badge: 'bg-red-100 text-red-700' },
  delete: { label: 'Excluir', badge: 'bg-red-100 text-red-700' },
  aprovar: { label: 'Aprovar', badge: 'bg-emerald-100 text-emerald-700' },
  approve: { label: 'Aprovar', badge: 'bg-emerald-100 text-emerald-700' },
  rejeitar: { label: 'Rejeitar', badge: 'bg-red-100 text-red-700' },
  reject: { label: 'Rejeitar', badge: 'bg-red-100 text-red-700' },
  faturar: { label: 'Faturar', badge: 'bg-purple-100 text-purple-700' },
};
const acaoCfg = (a) =>
  ACAO_CFG[String(a || '').toLowerCase()] || { label: a || '—', badge: 'bg-gray-100 text-gray-600' };

// Acessores tolerantes (registros novos usam acao/created_date/entidade_id;
// registros antigos podiam usar operacao/timestamp/registro_id).
const getAcao = (l) => l.acao || l.operacao || '';
const getData = (l) => l.created_date || l.timestamp || null;
const getRegistroId = (l) => l.entidade_id || l.registro_id || '';

const fmtDataHora = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('pt-BR');
};

function KpiCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn('p-2.5 rounded-lg', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-bold text-gray-900 leading-none truncate">{value}</div>
          <div className="text-sm text-gray-500 mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Auditoria() {
  const [filtro, setFiltro] = useState('');
  const [acao, setAcao] = useState('todas');
  const [modulo, setModulo] = useState('todos');
  const [page, setPage] = useState(1);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      try {
        return (await base44.entities.LogAuditoria?.list('-created_date', 500)) || [];
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    setPage(1);
  }, [filtro, acao, modulo]);

  const acoes = [...new Set(logs.map(getAcao).filter(Boolean))];
  const modulos = [...new Set(logs.map((l) => l.modulo).filter(Boolean))];
  const usuarios = [...new Set(logs.map((l) => l.user_email).filter(Boolean))];

  const logsFiltrados = logs.filter((log) => {
    const matchAcao = acao === 'todas' || getAcao(log) === acao;
    const matchModulo = modulo === 'todos' || log.modulo === modulo;
    const termo = filtro.trim().toLowerCase();
    const matchTexto =
      !termo ||
      [log.user_email, log.entidade, log.detalhes, getRegistroId(log)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(termo));
    return matchAcao && matchModulo && matchTexto;
  });

  const hoje = new Date().toDateString();
  const totalHoje = logs.filter((l) => {
    const d = getData(l);
    return d && new Date(d).toDateString() === hoje;
  }).length;
  const ultimaData = logs.map(getData).filter(Boolean)[0];

  const totalPages = Math.max(1, Math.ceil(logsFiltrados.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PER_PAGE;
  const endIndex = Math.min(startIndex + PER_PAGE, logsFiltrados.length);
  const logsPagina = logsFiltrados.slice(startIndex, endIndex);

  const acaoOptions = [
    { value: 'todas', label: 'Todas as ações' },
    ...acoes.map((a) => ({ value: a, label: acaoCfg(a).label })),
  ];
  const moduloOptions = [
    { value: 'todos', label: 'Todos os módulos' },
    ...modulos.map((m) => ({ value: m, label: m.charAt(0).toUpperCase() + m.slice(1) })),
  ];

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Auditoria e Logs</h1>
        <p className="text-gray-500 mt-1">Histórico de operações registradas no sistema.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={ScrollText} label="Total de Operações" value={logs.length} color="bg-blue-500/10 text-blue-600" />
        <KpiCard icon={Users} label="Usuários Ativos" value={usuarios.length} color="bg-purple-500/10 text-purple-600" />
        <KpiCard icon={CalendarDays} label="Hoje" value={totalHoje} color="bg-emerald-500/10 text-emerald-600" />
        <KpiCard
          icon={Clock}
          label="Última Operação"
          value={ultimaData ? new Date(ultimaData).toLocaleTimeString('pt-BR') : '—'}
          color="bg-amber-500/10 text-amber-600"
        />
      </div>

      <Card className="bg-white border-gray-200 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por usuário, entidade ou detalhe..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="h-11 pl-9 bg-white border-gray-300 text-gray-900"
              />
            </div>
            <ComboboxBusca
              options={acaoOptions}
              value={acao}
              onSelect={setAcao}
              placeholder="Todas as ações"
            />
            <ComboboxBusca
              options={moduloOptions}
              value={modulo}
              onSelect={setModulo}
              placeholder="Todos os módulos"
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : logsFiltrados.length === 0 ? (
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <ScrollText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Nenhum registro de auditoria encontrado</p>
            <p className="text-gray-400 text-sm mt-1">
              {logs.length === 0
                ? 'Ainda não há operações registradas.'
                : 'Ajuste os filtros para ver outros registros.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
          {/* Cards mobile */}
          <div className="md:hidden flex flex-col gap-2 p-2">
            {logsPagina.map((log, idx) => {
              const cfg = acaoCfg(getAcao(log));
              const falhou = log.sucesso === false;
              const registroId = getRegistroId(log);
              return (
                <div key={log.id || startIndex + idx} className="p-3 rounded-lg border border-gray-200 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{log.entidade || '—'}{registroId && <span className="text-gray-400 font-mono text-xs"> #{String(registroId).slice(0, 8)}</span>}</p>
                      <p className="text-xs text-gray-500">{log.user_email ? log.user_email.split('@')[0] : '—'} · <span className="capitalize">{log.modulo || '—'}</span></p>
                    </div>
                    <Badge className={cn('border-0 flex-shrink-0', falhou ? 'bg-red-100 text-red-700' : cfg.badge)}>
                      {falhou && <ShieldX className="w-3 h-3 mr-1" />}{cfg.label}
                    </Badge>
                  </div>
                  {log.detalhes && <p className="text-xs text-gray-600 line-clamp-2">{log.detalhes}</p>}
                  <p className="text-xs text-gray-400">{fmtDataHora(getData(log))}</p>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Data/Hora</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ação</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Módulo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Entidade</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsPagina.map((log, idx) => {
                  const cfg = acaoCfg(getAcao(log));
                  const falhou = log.sucesso === false;
                  const registroId = getRegistroId(log);
                  return (
                    <tr key={log.id || startIndex + idx} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{fmtDataHora(getData(log))}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-medium">
                        {log.user_email ? log.user_email.split('@')[0] : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={cn('border-0', falhou ? 'bg-red-100 text-red-700' : cfg.badge)}>
                          {falhou && <ShieldX className="w-3 h-3 mr-1" />}
                          {cfg.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 capitalize">{log.modulo || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-gray-900">{log.entidade || '—'}</div>
                        {registroId && (
                          <div className="text-xs text-gray-400 font-mono">#{String(registroId).slice(0, 8)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[280px]">
                        <span className="block truncate" title={log.detalhes || ''}>
                          {log.detalhes || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
              startIndex={startIndex}
              endIndex={endIndex}
              totalItems={logsFiltrados.length}
            />
          )}
        </Card>
      )}
    </div>
  );
}
