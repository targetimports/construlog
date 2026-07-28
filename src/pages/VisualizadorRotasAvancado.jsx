import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { MapPin, Navigation, Clock, TrendingUp, Route, CheckCircle } from 'lucide-react';
import MapaRotasAvancado from '../components/logistica/MapaRotasAvancado';
import { PageSkeleton } from '@/components/shared/Skeletons';

const statusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700' },
  checklist_pendente: { label: 'Checklist Pendente', color: 'bg-amber-100 text-amber-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' }
};
const statusBadge = (s) => statusConfig[s] || { label: s || '—', color: 'bg-gray-100 text-gray-700' };

export default function VisualizadorRotasAvancado() {
  const [rotaSelecionada, setRotaSelecionada] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('em_andamento');
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: rotas = [], isLoading: rotasLoading } = useQuery({
    queryKey: ['rotas-avancado', user?.email],
    queryFn: () => {
      if (!user?.email) return [];
      return base44.entities.RotaMotorista.filter({ motorista_email: user.email }, '-created_date', 100);
    },
    enabled: !!user?.email
  });

  const { data: rastreamento = [] } = useQuery({
    queryKey: ['rastreamento-rota', rotaSelecionada?.id],
    queryFn: async () => {
      if (!rotaSelecionada?.id) return [];
      try {
        return await base44.entities.RegistroTelemetria.filter({ rota_id: rotaSelecionada.id }, '-created_date', 1000);
      } catch {
        return [];
      }
    },
    enabled: !!rotaSelecionada?.id,
    refetchInterval: 5000
  });

  // POIs ficam em memória nesta sessão (não há entidade dedicada no backend).
  const { data: pois = [] } = useQuery({
    queryKey: ['pois-rota', rotaSelecionada?.id],
    queryFn: () => (window.base44_pois || []).filter(p => p.rota_id === rotaSelecionada?.id),
    enabled: !!rotaSelecionada?.id
  });

  const adicionarPOIMutation = useMutation({
    mutationFn: async (poi) => {
      if (!window.base44_pois) window.base44_pois = [];
      const novo = { ...poi, id: `${rotaSelecionada.id}-${window.base44_pois.length + 1}`, rota_id: rotaSelecionada.id };
      window.base44_pois.push(novo);
      return novo;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pois-rota'] })
  });

  const removerPOIMutation = useMutation({
    mutationFn: async (poiId) => {
      if (window.base44_pois) window.base44_pois = window.base44_pois.filter(p => p.id !== poiId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pois-rota'] })
  });

  const historicoRastreamento = useMemo(
    () => rastreamento.filter(r => r.latitude && r.longitude).map(r => [r.latitude, r.longitude]),
    [rastreamento]
  );

  const rotasFiltradas = useMemo(
    () => rotas.filter(r => filtroStatus === 'todas' || r.status === filtroStatus),
    [rotas, filtroStatus]
  );

  const stats = useMemo(() => ({
    total: rotas.length,
    emAndamento: rotas.filter(r => r.status === 'em_andamento').length,
    concluidas: rotas.filter(r => r.status === 'concluida').length,
    planejadas: rotas.filter(r => ['planejada', 'checklist_pendente'].includes(r.status)).length
  }), [rotas]);

  if (rotasLoading) {
    return <PageSkeleton kpis={4} rows={6} cols={4} />;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Visualizador de Rotas Avançado</h1>
        <p className="text-gray-500 mt-1">Acompanhe suas viagens em tempo real, com histórico e pontos de interesse</p>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Total de Rotas</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
              <div className="p-2.5 rounded-xl bg-gray-100"><Route className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Em Andamento</p><p className="text-2xl font-bold text-amber-600">{stats.emAndamento}</p></div>
              <div className="p-2.5 rounded-xl bg-amber-50"><Navigation className="w-6 h-6 text-amber-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Concluídas</p><p className="text-2xl font-bold text-emerald-600">{stats.concluidas}</p></div>
              <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle className="w-6 h-6 text-emerald-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Planejadas</p><p className="text-2xl font-bold text-blue-600">{stats.planejadas}</p></div>
              <div className="p-2.5 rounded-xl bg-blue-50"><Clock className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtro */}
      <div className="w-full sm:w-[220px]">
        <ComboboxBusca
          options={[
            { value: 'todas', label: 'Todas as rotas' },
            { value: 'em_andamento', label: 'Em Andamento' },
            { value: 'planejada', label: 'Planejadas' },
            { value: 'concluida', label: 'Concluídas' },
            { value: 'cancelada', label: 'Canceladas' }
          ]}
          value={filtroStatus}
          onSelect={setFiltroStatus}
          placeholder="Filtrar por status"
          searchPlaceholder="Buscar status..."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Rotas */}
        <div className="lg:col-span-1">
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-gray-900">Rotas ({rotasFiltradas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[28rem] overflow-y-auto">
                {rotasFiltradas.length === 0 ? (
                  <p className="text-xs text-gray-500 py-6 text-center">Nenhuma rota encontrada</p>
                ) : (
                  rotasFiltradas.map(rota => {
                    const st = statusBadge(rota.status);
                    const ativa = rotaSelecionada?.id === rota.id;
                    return (
                      <button
                        key={rota.id}
                        onClick={() => setRotaSelecionada(rota)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                          ativa ? 'bg-blue-50 border-blue-300' : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <p className="font-medium text-sm text-gray-900 truncate">{rota.nome || 'Sem nome'}</p>
                        <p className="text-gray-500 text-xs truncate">{rota.endereco_destino || '—'}</p>
                        <Badge className={`border-0 mt-1.5 ${st.color}`}>{st.label}</Badge>
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Mapa e Detalhes */}
        <div className="lg:col-span-3 space-y-4">
          {rotaSelecionada ? (
            <>
              {/* Detalhes da Rota */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
                  <CardTitle className="text-lg text-gray-900">{rotaSelecionada.nome || 'Rota Selecionada'}</CardTitle>
                  <Badge className={`border-0 ${statusBadge(rotaSelecionada.status).color}`}>{statusBadge(rotaSelecionada.status).label}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div><p className="text-gray-500 text-xs">Origem</p><p className="font-medium text-gray-900">{rotaSelecionada.endereco_origem || '—'}</p></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                      <div><p className="text-gray-500 text-xs">Destino</p><p className="font-medium text-gray-900">{rotaSelecionada.endereco_destino || '—'}</p></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div><p className="text-gray-500 text-xs">Data / Hora</p><p className="font-medium text-gray-900">{[rotaSelecionada.data_planejada, rotaSelecionada.hora_saida_prevista].filter(Boolean).join(' ') || '—'}</p></div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                      <div><p className="text-gray-500 text-xs">Veículo</p><p className="font-medium text-gray-900">{rotaSelecionada.veiculo_placa || '—'}</p></div>
                    </div>
                  </div>
                  {rotaSelecionada.motivo && (
                    <div className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-sm">
                      <p className="text-xs text-gray-500 mb-1">Motivo</p>
                      <p className="font-medium text-gray-800">{rotaSelecionada.motivo}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mapa Interativo */}
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-gray-900">
                    <MapPin className="w-4 h-4" /> Mapa com Histórico e POIs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MapaRotasAvancado
                    rota={rotaSelecionada}
                    localizacaoAtual={rastreamento[0] ? { lat: rastreamento[0].latitude, lng: rastreamento[0].longitude } : null}
                    historicoRastreamento={historicoRastreamento}
                    pois={pois}
                    onAdicionarPOI={(poi) => adicionarPOIMutation.mutate(poi)}
                    onRemoverPOI={(poiId) => removerPOIMutation.mutate(poiId)}
                  />
                </CardContent>
              </Card>

              {/* Estatísticas do rastreamento */}
              {rastreamento.length > 0 && (
                <Card className="bg-white border-gray-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-gray-900">
                      <TrendingUp className="w-4 h-4" /> Estatísticas do Rastreamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div><p className="text-gray-500 text-xs">Pontos Rastreados</p><p className="font-bold text-lg text-blue-600">{rastreamento.length}</p></div>
                      <div><p className="text-gray-500 text-xs">POIs Marcados</p><p className="font-bold text-lg text-purple-600">{pois.length}</p></div>
                      <div><p className="text-gray-500 text-xs">Última Atualização</p><p className="font-mono text-xs text-gray-700">{rastreamento[0]?.created_date ? new Date(rastreamento[0].created_date).toLocaleTimeString('pt-BR') : '—'}</p></div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="bg-white border-gray-200 shadow-sm h-96 flex items-center justify-center text-center">
              <div className="space-y-2">
                <MapPin className="w-12 h-12 text-gray-300 mx-auto" />
                <p className="text-gray-500 font-medium">Selecione uma rota para visualizar no mapa</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
