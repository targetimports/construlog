import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Truck, CheckCircle2, AlertCircle, Eye } from 'lucide-react';
import ViagemDetalhesModal from '@/components/logistica/ViagemDetalhesModal';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

const statusConfig = {
  aguardando_saida: { label: 'Aguardando Saída', color: 'bg-amber-100 text-amber-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700' },
  finalizada: { label: 'Finalizada', color: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' }
};
const statusBadge = (s) => statusConfig[s] || { label: s || '—', color: 'bg-gray-100 text-gray-700' };

function formatarDataHora(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleString('pt-BR');
}

export default function ViagensAbastecimentos() {
  const [selectedViagemId, setSelectedViagemId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const queryClient = useQueryClient();

  const { data: viagens = [], isLoading } = useQuery({
    queryKey: ['viagens-lista'],
    queryFn: () => base44.entities.Viagem.list('-created_date', 100)
  });

  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list()
  });

  const veiculoLabel = useMemo(() => {
    const m = new Map(veiculos.map(v => [v.id, v.placa || v.modelo || v.id]));
    return (id) => m.get(id) || (id ? `#${String(id).substring(0, 6)}` : '—');
  }, [veiculos]);

  const filtradas = useMemo(
    () => viagens.filter(v => filtroStatus === 'todos' || v.status === filtroStatus),
    [viagens, filtroStatus]
  );

  const {
    currentPage, totalPages, paginatedItems, goToPage,
    startIndex, endIndex, totalItems
  } = usePagination(filtradas, ITENS_POR_PAGINA);

  useEffect(() => { goToPage(1); }, [filtroStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => ({
    aguardando: viagens.filter(v => v.status === 'aguardando_saida').length,
    emAndamento: viagens.filter(v => v.status === 'em_andamento').length,
    finalizadas: viagens.filter(v => v.status === 'finalizada').length,
    total: viagens.length
  }), [viagens]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Truck className="w-7 h-7 text-blue-600" />
          Viagens &amp; Abastecimentos
        </h1>
        <p className="text-gray-500 mt-1">Acompanhe as viagens da frota e seus abastecimentos</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Aguardando Saída</p><p className="text-2xl font-bold text-amber-600">{stats.aguardando}</p></div>
              <div className="p-2.5 rounded-xl bg-amber-50"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Em Andamento</p><p className="text-2xl font-bold text-blue-600">{stats.emAndamento}</p></div>
              <div className="p-2.5 rounded-xl bg-blue-50"><Truck className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Finalizadas</p><p className="text-2xl font-bold text-emerald-600">{stats.finalizadas}</p></div>
              <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
              <div className="p-2.5 rounded-xl bg-gray-100"><Truck className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="bg-white border-gray-200 shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-gray-900">Viagens</CardTitle>
          <div className="w-full sm:w-[200px]">
            <ComboboxBusca
              options={[{ value: 'todos', label: 'Todos status' }, ...Object.entries(statusConfig).map(([v, c]) => ({ value: v, label: c.label }))]}
              value={filtroStatus}
              onSelect={setFiltroStatus}
              placeholder="Status"
              searchPlaceholder="Buscar..."
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={7} />
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <Truck className="w-10 h-10" />
              <p className="text-sm text-gray-500">Nenhuma viagem encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Viagem</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Motorista</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Veículo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Saída Real</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">KM Percorrido</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedItems.map(viagem => {
                      const st = statusBadge(viagem.status);
                      const km = (viagem.km_final != null && viagem.km_inicial != null)
                        ? `${viagem.km_final - viagem.km_inicial} km` : '—';
                      return (
                        <tr key={viagem.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">#{String(viagem.id).substring(0, 8).toUpperCase()}</td>
                          <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={viagem.motorista_user_id || ''}>{viagem.motorista_user_id?.split('@')[0] || '—'}</td>
                          <td className="px-4 py-3 text-gray-600">{veiculoLabel(viagem.veiculo_id)}</td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{viagem.saida_real ? formatarDataHora(viagem.saida_real) : 'Não iniciada'}</td>
                          <td className="px-4 py-3 text-right text-gray-700">{km}</td>
                          <td className="px-4 py-3 text-center"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                          <td className="px-4 py-3">
                            <TooltipProvider delayDuration={200}>
                              <div className="flex items-center justify-end">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setSelectedViagemId(viagem.id)}>
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver detalhes</TooltipContent>
                                </Tooltip>
                              </div>
                            </TooltipProvider>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalhes */}
      {selectedViagemId && (
        <ViagemDetalhesModal
          id={selectedViagemId}
          onClose={() => setSelectedViagemId(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['viagens-lista'] });
            setSelectedViagemId(null);
          }}
        />
      )}
    </div>
  );
}
