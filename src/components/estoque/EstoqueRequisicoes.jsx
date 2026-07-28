import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const statusConfig = {
  RASCUNHO: { label: 'Rascunho', cls: 'bg-gray-100 text-gray-600' },
  ENVIADA: { label: 'Enviada', cls: 'bg-blue-100 text-blue-700' },
  APROVADA: { label: 'Aprovada', cls: 'bg-green-100 text-green-700' },
  RESERVADA: { label: 'Reservada', cls: 'bg-orange-100 text-orange-700' },
  SEPARANDO: { label: 'Separando', cls: 'bg-yellow-100 text-yellow-700' },
  TRANSFERIDA: { label: 'Transferida', cls: 'bg-indigo-100 text-indigo-700' },
  RECEBIDA: { label: 'Recebida', cls: 'bg-emerald-100 text-emerald-700' },
  CANCELADA: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' },
  BAIXADA: { label: 'Baixada', cls: 'bg-gray-100 text-gray-600' },
};

const prioConfig = {
  BAIXA: { label: 'Baixa', cls: 'bg-gray-100 text-gray-600' },
  NORMAL: { label: 'Normal', cls: 'bg-blue-100 text-blue-600' },
  ALTA: { label: 'Alta', cls: 'bg-orange-100 text-orange-700' },
  URGENTE: { label: 'Urgente', cls: 'bg-red-100 text-red-700' },
};

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const PER_PAGE = 15;

export default function EstoqueRequisicoes() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [page, setPage] = useState(1);

  const { data: requisicoes = [], isLoading } = useQuery({
    queryKey: ['requisicoes-obra-estoque'],
    queryFn: () => base44.entities.RequisicaoObra.list('-created_date', 500),
    staleTime: 30000
  });

  const filtradas = useMemo(() => {
    return requisicoes.filter(r => {
      if (busca && !(r.obra_nome || '').toLowerCase().includes(busca.toLowerCase()) &&
          !(r.solicitante_nome || '').toLowerCase().includes(busca.toLowerCase())) return false;
      if (filtroStatus !== 'todos' && r.status !== filtroStatus) return false;
      return true;
    });
  }, [requisicoes, busca, filtroStatus]);

  React.useEffect(() => { setPage(1); }, [busca, filtroStatus]);
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PER_PAGE));
  const pageItens = filtradas.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const temFiltro = busca || filtroStatus !== 'todos';
  const limparFiltros = () => { setBusca(''); setFiltroStatus('todos'); };

  const resumo = useMemo(() => {
    const r = { pendentes: 0, reservadas: 0, emAndamento: 0, concluidas: 0 };
    for (const req of requisicoes) {
      if (['ENVIADA', 'APROVADA'].includes(req.status)) r.pendentes++;
      else if (req.status === 'RESERVADA') r.reservadas++;
      else if (['SEPARANDO', 'TRANSFERIDA'].includes(req.status)) r.emAndamento++;
      else if (['RECEBIDA', 'BAIXADA'].includes(req.status)) r.concluidas++;
    }
    return r;
  }, [requisicoes]);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-600" /></div>;
  }

  const kpis = [
    { label: 'Pendentes', valor: resumo.pendentes },
    { label: 'Reservadas', valor: resumo.reservadas },
    { label: 'Em Andamento', valor: resumo.emAndamento },
    { label: 'Concluídas', valor: resumo.concluidas },
  ];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Card key={i} className="bg-white border-gray-200">
            <CardContent className="pt-4 pb-3">
              <p className="text-sm text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{k.valor}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros e Lista */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600" />
            Requisições de Material ({filtradas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 mb-4 sm:items-center">
            <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Buscar obra/solicitante..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full sm:w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                {Object.entries(statusConfig).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {temFiltro && (
              <button onClick={limparFiltros} className="text-sm text-gray-500 hover:text-gray-700 underline px-2 h-9">
                Limpar filtros
              </button>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500">Obra</th>
                    <th className="p-3 text-left text-xs font-semibold text-gray-500">Solicitante</th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-500">Itens</th>
                    <th className="p-3 text-right text-xs font-semibold text-gray-500">Valor Est.</th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-500">Prioridade</th>
                    <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageItens.map(r => {
                    const st = statusConfig[r.status] || statusConfig.RASCUNHO;
                    const prio = prioConfig[r.prioridade] || prioConfig.NORMAL;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="p-3 text-xs text-gray-500">
                          {r.data_requisicao ? format(new Date(r.data_requisicao + 'T12:00'), 'dd/MM/yy') : r.created_date ? format(new Date(r.created_date), 'dd/MM/yy') : '—'}
                        </td>
                        <td className="p-3 font-medium text-gray-900">{r.obra_nome || '—'}</td>
                        <td className="p-3 text-gray-600">{r.solicitante_nome || r.solicitante_user_id || '—'}</td>
                        <td className="p-3 text-center">{r.qtd_itens || '—'}</td>
                        <td className="p-3 text-right">{r.valor_total_estimado ? fmt(r.valor_total_estimado) : '—'}</td>
                        <td className="p-3 text-center">
                          <Badge className={`${prio.cls} border-0 text-xs`}>{prio.label}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${st.cls} border-0 text-xs`}>{st.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {filtradas.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhuma requisição encontrada</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Cards mobile (mesmos itens/handlers da tabela) */}
            <div className="md:hidden flex flex-col gap-y-2 p-2">
              {pageItens.map(r => {
                const st = statusConfig[r.status] || statusConfig.RASCUNHO;
                const prio = prioConfig[r.prioridade] || prioConfig.NORMAL;
                return (
                  <div key={r.id} className="p-3 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 break-words">{r.obra_nome || '—'}</p>
                        <p className="text-xs text-gray-600 break-words mt-0.5">{r.solicitante_nome || r.solicitante_user_id || '—'}</p>
                      </div>
                      <Badge className={`${st.cls} border-0 text-xs shrink-0`}>{st.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2 text-xs text-gray-500">
                      <span>{r.data_requisicao ? format(new Date(r.data_requisicao + 'T12:00'), 'dd/MM/yy') : r.created_date ? format(new Date(r.created_date), 'dd/MM/yy') : '—'}</span>
                      <Badge className={`${prio.cls} border-0 text-xs`}>{prio.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="text-xs text-gray-500">Itens: {r.qtd_itens || '—'}</span>
                      <span className="text-sm font-semibold text-gray-900 break-words text-right">{r.valor_total_estimado ? fmt(r.valor_total_estimado) : '—'}</span>
                    </div>
                  </div>
                );
              })}
              {filtradas.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">Nenhuma requisição encontrada</div>
              )}
            </div>

            {filtradas.length > PER_PAGE && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 p-3 border-t border-gray-200">
                <span className="text-xs text-gray-500">Mostrando {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtradas.length)} de {filtradas.length}</span>
                <div className="flex items-center justify-between sm:justify-end gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                  <span className="text-xs text-gray-600 whitespace-nowrap">Página {page} de {totalPaginas}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPaginas} onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
