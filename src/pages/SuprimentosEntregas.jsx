import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { CardGridSkeleton } from '@/components/shared/Skeletons';
import { Search, Eye, Truck, Calendar, Filter, ChevronDown, ChevronUp, X } from 'lucide-react';
import ViagemDetalhes from '@/components/logistica/ViagemDetalhes';
import BotaoAnexarNFGasto from '@/components/documentos-fiscais/BotaoAnexarNFGasto';

const STATUS_CLS = {
  PLANEJADA: 'bg-yellow-100 text-yellow-800',
  EM_ROTA: 'bg-blue-100 text-blue-800',
  FINALIZADA: 'bg-green-100 text-green-800',
  CANCELADA: 'bg-red-100 text-red-800',
};
const fmtData = (d) => (d ? new Date(d).toLocaleString('pt-BR') : '—');

function ViagemCard({ viagem, onView }) {
  const qc = useQueryClient();
  return (
    <Card className="bg-white border-gray-200 hover:border-gray-300 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2 gap-2">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{viagem.numero}</h3>
            <p className="text-sm text-gray-500 truncate">{viagem.veiculo_descricao || '—'} • {viagem.motorista_nome || '—'}</p>
          </div>
          <Badge className={`border-0 flex-shrink-0 ${STATUS_CLS[viagem.status] || 'bg-gray-100 text-gray-800'}`}>{viagem.status}</Badge>
        </div>
        <p className="text-xs text-gray-600 mb-3 flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {fmtData(viagem.data_saida)}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => onView(viagem)} className="flex-1 border-gray-300 text-gray-700">
            <Eye className="w-3 h-3 mr-1" /> Ver Detalhes
          </Button>
          <BotaoAnexarNFGasto
            referencia_tipo="VIAGEM_ENTREGA"
            referencia_id={viagem.id}
            referencia_nome={viagem.numero}
            podeEditar={viagem.status !== 'FINALIZADA' && viagem.status !== 'CANCELADA'}
            onSuccess={() => qc.invalidateQueries({ queryKey: ['viagens-entregas'] })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function SuprimentosEntregas() {
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroData, setFiltroData] = useState('');
  const [selectedViagem, setSelectedViagem] = useState(null);
  const [showFiltros, setShowFiltros] = useState(false);

  const { data: viagens = [], isLoading } = useQuery({
    queryKey: ['viagens-entregas'],
    queryFn: () => base44.entities.Viagem.list('-data_saida', 1000),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-filtro-entregas'],
    queryFn: () => base44.entities.Obra.list('nome', 1000).catch(() => []),
  });
  const { data: paradas = [] } = useQuery({
    queryKey: ['paradas-todas'],
    queryFn: () => base44.entities.ParadaViagem.list('-created_date', 5000).catch(() => []),
  });
  // viagem_id -> set de obra_id (a partir das paradas)
  const viagemObras = useMemo(() => {
    const map = {};
    for (const p of paradas) {
      if (!p.viagem_id || !p.obra_id) continue;
      (map[p.viagem_id] = map[p.viagem_id] || new Set()).add(p.obra_id);
    }
    return map;
  }, [paradas]);

  const filtradas = useMemo(() => viagens.filter((v) => {
    const q = busca.toLowerCase();
    const matchBusca = !q || v.numero?.toLowerCase().includes(q) || v.motorista_nome?.toLowerCase().includes(q) || v.veiculo_descricao?.toLowerCase().includes(q) || v.fornecedor_nome?.toLowerCase().includes(q);
    const matchStatus = !filtroStatus || v.status === filtroStatus;
    const matchObra = !filtroObra || (viagemObras[v.id] && viagemObras[v.id].has(filtroObra));
    let matchData = true;
    if (filtroData && v.data_saida) matchData = new Date(v.data_saida).toISOString().split('T')[0] === filtroData;
    return matchBusca && matchStatus && matchObra && matchData;
  }), [viagens, busca, filtroStatus, filtroObra, filtroData, viagemObras]);

  const { paginatedItems, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtradas, 20);
  const resetPagina = () => goToPage(1);

  const stats = {
    total: viagens.length,
    planejadas: viagens.filter((v) => v.status === 'PLANEJADA').length,
    emRota: viagens.filter((v) => v.status === 'EM_ROTA').length,
    finalizadas: viagens.filter((v) => v.status === 'FINALIZADA').length,
  };

  const obraOptions = obras.map((o) => ({ value: o.id, label: o.nome }));
  const temFiltro = busca || filtroStatus || filtroObra || filtroData;
  const qtdFiltros = [busca, filtroStatus, filtroObra, filtroData].filter(Boolean).length;
  const limpar = () => { setBusca(''); setFiltroStatus(''); setFiltroObra(''); setFiltroData(''); resetPagina(); };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Entregas (Romaneio)</h1>
        <p className="text-sm text-gray-500 mt-1">Viagens e paradas de entrega de materiais (geradas a partir de pedidos consolidados)</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{stats.total}</p><p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase leading-tight mt-1">Total</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-yellow-600 tabular-nums">{stats.planejadas}</p><p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase leading-tight mt-1">Planejadas</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{stats.emRota}</p><p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase leading-tight mt-1">Em Rota</p></Card>
        <Card className="bg-white border-gray-200 p-3 sm:p-4 flex flex-col"><p className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{stats.finalizadas}</p><p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase leading-tight mt-1">Finalizadas</p></Card>
      </div>

      {/* Filtros (colapsáveis) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowFiltros((v) => !v)} className="gap-2 h-10 border-gray-300 text-gray-700">
              <Filter className="w-4 h-4" /> Filtros
              {qtdFiltros > 0 && <Badge className="bg-blue-100 text-blue-700 border-0 px-1.5">{qtdFiltros}</Badge>}
              {showFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <span className="text-xs text-gray-500">{filtradas.length} viagem(ns)</span>
          </div>
          {temFiltro && (
            <Button variant="ghost" size="sm" onClick={limpar} className="gap-1 text-gray-500 hover:text-gray-700">
              <X className="w-4 h-4" /> Limpar filtros
            </Button>
          )}
        </div>

        {showFiltros && (
          <Card className="bg-white border-gray-200">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input className="pl-9 h-11" placeholder="Número, motorista, veículo..." value={busca} onChange={(e) => { setBusca(e.target.value); resetPagina(); }} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca options={obraOptions} value={filtroObra} onSelect={(v) => { setFiltroObra(v); resetPagina(); }} placeholder="Todas as obras" searchPlaceholder="Buscar obra..." />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <ComboboxBusca
                    options={[
                      { value: '', label: 'Todos os status' },
                      { value: 'PLANEJADA', label: 'Planejada' },
                      { value: 'EM_ROTA', label: 'Em Rota' },
                      { value: 'FINALIZADA', label: 'Finalizada' },
                      { value: 'CANCELADA', label: 'Cancelada' },
                    ]}
                    value={filtroStatus}
                    onSelect={(v) => { setFiltroStatus(v || ''); resetPagina(); }}
                    placeholder="Status"
                    searchPlaceholder="Buscar..."
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Data de saída</Label>
                  <Input type="date" value={filtroData} onChange={(e) => { setFiltroData(e.target.value); resetPagina(); }} className="h-11" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lista */}
      {isLoading ? (
        <CardGridSkeleton count={6} cols="md:grid-cols-2 lg:grid-cols-3" />
      ) : filtradas.length === 0 ? (
        <Card className="bg-white border-gray-200">
          <CardContent className="py-16 text-center text-gray-500">
            <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-medium text-gray-600">Nenhuma viagem encontrada</p>
            <p className="text-xs text-gray-400 mt-1">Romaneios são gerados a partir de pedidos de compra consolidados (multi-obra).</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedItems.map((v) => <ViagemCard key={v.id} viagem={v} onView={setSelectedViagem} />)}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
        </div>
      )}

      {selectedViagem && (
        <ViagemDetalhes viagem={selectedViagem} onClose={() => setSelectedViagem(null)} onUpdate={() => {}} />
      )}
    </div>
  );
}
