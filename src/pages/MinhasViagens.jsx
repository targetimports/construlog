import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MapPin, Clock, AlertCircle, CheckCircle, Plus, Loader2, Route } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import MapaLocalizacao from '../components/logistica/MapaLocalizacao';
import MapaViagem from '../components/logistica/MapaViagem';
import { useRastreamentoTempoReal } from '../components/logistica/useRastreamentoTempoReal';
import BotaoIniciarViagem from '../components/logistica/BotaoIniciarViagem';
import InputAutocompletarEndereco from '../components/logistica/InputAutocompletarEndereco';
import { Link } from 'react-router-dom';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function MinhasViagens() {
  const [novaRotaOpen, setNovaRotaOpen] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    veiculo_id: '',
    endereco_origem: '',
    endereco_destino: '',
    data_planejada: new Date().toISOString().split('T')[0],
    hora_saida_prevista: '',
    motivo: '',
    frequencia: 'unica',
    latitude_origem: null,
    longitude_origem: null,
    latitude_destino: null,
    longitude_destino: null
  });
  
  const [localizacaoAtual, setLocalizacaoAtual] = useState(null);
  const [destino, setDestino] = useState(null);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Frota = Veículos + Ativos/Equipamentos cujo tipo é veículo/máquina (grandes
  // e pequenos), excluindo ferramentas. O Veiculo às vezes não tem status
  // preenchido, então não filtramos por status nele.
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-todos'],
    queryFn: () => base44.entities.Veiculo.list()
  });
  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list()
  });
  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const veiculoOptions = useMemo(() => {
    const TIPOS_VEICULO = ['veiculo', 'carro', 'caminhao', 'caminhonete', 'moto', 'van', 'onibus', 'trator', 'maquina', 'maquinaria', 'escavadeira', 'retroescavadeira', 'pa_carregadeira', 'rolo', 'patrol'];
    const ativoOk = (s) => !s || ['ativo', 'disponivel', 'em_uso', 'operacional'].includes(String(s).toLowerCase());
    const ehVeiculo = (t) => TIPOS_VEICULO.includes(String(t || '').toLowerCase());
    const normPlaca = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    const opts = [];
    const seenIds = new Set();
    const seenPlacas = new Set();
    // Adiciona evitando duplicar por id OU por placa (mesmo veículo em fontes diferentes).
    const add = (value, label, placa) => {
      const pl = normPlaca(placa);
      if (seenIds.has(value)) return;
      if (pl && seenPlacas.has(pl)) return;
      seenIds.add(value);
      if (pl) seenPlacas.add(pl);
      opts.push({ value, label });
    };

    // Veículos primeiro (fonte canônica da frota — têm prioridade na deduplicação).
    veiculos.forEach(v => add(v.id, `${v.placa || 'Sem placa'}${v.modelo ? ` — ${v.modelo}` : ''}`, v.placa));
    ativos.filter(a => ehVeiculo(a.tipo) && ativoOk(a.status)).forEach(a => add(a.id, `${a.nome || 'Ativo'}${a.placa ? ` — ${a.placa}` : ''}`, a.placa));
    equipamentos.filter(e => ehVeiculo(e.tipo) && ativoOk(e.status)).forEach(e => add(e.id, `${e.nome || 'Equipamento'}${e.placa ? ` — ${e.placa}` : ''}`, e.placa));

    return opts;
  }, [veiculos, ativos, equipamentos]);

  const veiculoLabelById = useMemo(
    () => new Map(veiculoOptions.map(o => [o.value, o.label])),
    [veiculoOptions]
  );

  const createRotaMutation = useMutation({
    mutationFn: (data) => base44.entities.RotaMotorista.create({
      ...data,
      motorista_email: user.email,
      status: 'planejada'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      queryClient.invalidateQueries({ queryKey: ['rotas-veiculos-ativos'] });
      toast.success('Rota criada! Agora inicie a viagem para rastreamento em tempo real.');
      setNovaRotaOpen(false);
      setDestino(null);
      setFormData({
        nome: '', veiculo_id: '', endereco_origem: '', endereco_destino: '',
        data_planejada: new Date().toISOString().split('T')[0],
        hora_saida_prevista: '', motivo: '', frequencia: 'unica',
        latitude_origem: null, longitude_origem: null,
        latitude_destino: null, longitude_destino: null
      });
    },
    onError: (err) => toast.error('Erro ao criar rota: ' + err.message)
  });

  const handleSubmitRota = (e) => {
    e.preventDefault();
    if (!formData.veiculo_id || !formData.endereco_destino) {
      toast.error('Preencha todos os campos obrigatórios (veículo e destino)');
      return;
    }
    createRotaMutation.mutate({
      ...formData,
      veiculo_placa: veiculoLabelById.get(formData.veiculo_id) || '',
      latitude_origem: formData.latitude_origem || localizacaoAtual?.lat || -10.97239,
      longitude_origem: formData.longitude_origem || localizacaoAtual?.lng || -38.79259,
      latitude_destino: destino?.lat || formData.latitude_destino,
      longitude_destino: destino?.lng || formData.longitude_destino,
      endereco_destino: destino?.endereco || formData.endereco_destino
    });
  };

  const { data: rotas = [], isLoading: rotasLoading } = useQuery({
    queryKey: ['rotas-motorista', user?.email],
    queryFn: () => {
      if (!user?.email) return [];
      return base44.entities.RotaMotorista.filter({ motorista_email: user.email }, '-created_date', 50);
    },
    enabled: !!user?.email
  });

  const { data: alertas } = useQuery({
    queryKey: ['alertas-viagens'],
    queryFn: () => base44.entities.AlertaViagemIA.filter({ status: 'novo' })
  });

  const rotasAtivas = useMemo(
    () => rotas.filter(v => ['planejada', 'checklist_pendente', 'em_andamento'].includes(v.status)),
    [rotas]
  );
  const rotasFinalizadas = useMemo(
    () => rotas.filter(v => ['concluida', 'cancelada'].includes(v.status)),
    [rotas]
  );

  const stats = useMemo(() => ({
    ativas: rotasAtivas.length,
    emAndamento: rotas.filter(v => v.status === 'em_andamento').length,
    concluidas: rotas.filter(v => v.status === 'concluida').length,
    total: rotas.length
  }), [rotas, rotasAtivas]);

  const histPag = usePagination(rotasFinalizadas, 10);

  if (rotasLoading) return <div className="p-6 max-w-4xl mx-auto"><PageSkeleton /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Minhas Viagens</h1>
          <p className="text-gray-600">Acompanhe suas viagens e registre fotos</p>
        </div>
        <div className="flex gap-2">
          <Link to={createPageUrl('VisualizadorRotasAvancado')}>
            <Button variant="outline" className="gap-2">
              <MapPin className="w-4 h-4" />
              Visualizar em Mapa
            </Button>
          </Link>
          <Button onClick={() => setNovaRotaOpen(true)} className="bg-blue-600 hover:bg-blue-700 gap-2">
            <Plus className="w-4 h-4" />
            Nova Rota
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Rotas Ativas</p><p className="text-2xl font-bold text-blue-600">{stats.ativas}</p></div>
              <div className="p-2.5 rounded-xl bg-blue-50"><Route className="w-6 h-6 text-blue-600" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-600">Em Andamento</p><p className="text-2xl font-bold text-amber-600">{stats.emAndamento}</p></div>
              <div className="p-2.5 rounded-xl bg-amber-50"><Clock className="w-6 h-6 text-amber-600" /></div>
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
              <div><p className="text-sm text-gray-600">Total</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></div>
              <div className="p-2.5 rounded-xl bg-gray-100"><MapPin className="w-6 h-6 text-gray-500" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Nova Rota */}
      <Dialog open={novaRotaOpen} onOpenChange={setNovaRotaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto z-50">
          <DialogHeader>
            <DialogTitle>Nova Rota</DialogTitle>
            <DialogDescription>Preencha os dados da rota para começar o rastreamento</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitRota} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Nome / Descrição da Rota</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Entrega na obra Central"
                className="h-11"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Veículo *</Label>
              <ComboboxBusca
                options={veiculoOptions}
                value={formData.veiculo_id}
                onSelect={(v) => setFormData({ ...formData, veiculo_id: v })}
                placeholder="Selecione o veículo"
                searchPlaceholder="Buscar por placa ou modelo..."
                emptyMessage="Nenhum veículo ativo."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Data *</Label>
                <Input type="date" value={formData.data_planejada}
                  onChange={(e) => setFormData({ ...formData, data_planejada: e.target.value })} className="h-11" />
              </div>
              <div>
                <Label className="mb-1.5 block">Hora de Saída</Label>
                <Input type="time" value={formData.hora_saida_prevista}
                  onChange={(e) => setFormData({ ...formData, hora_saida_prevista: e.target.value })} className="h-11" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">Endereço de Destino *</Label>
              <InputAutocompletarEndereco
                value={formData.endereco_destino}
                onChange={(endereco) => {
                  // Ao digitar, limpa o destino anterior (coords + marcador) para
                  // não sobrar um lugar errado de um clique anterior no mapa.
                  setFormData(prev => ({ ...prev, endereco_destino: endereco, latitude_destino: null, longitude_destino: null }));
                  setDestino(null);
                }}
                onSelectSugestao={(sugestao) => {
                  setFormData(prev => ({
                    ...prev,
                    endereco_destino: sugestao.description || sugestao.endereco,
                    latitude_destino: sugestao.lat,
                    longitude_destino: sugestao.lng
                  }));
                  setDestino({
                    lat: sugestao.lat,
                    lng: sugestao.lng,
                    endereco: sugestao.description || sugestao.endereco
                  });
                  toast.success('Destino selecionado: ' + (sugestao.description || sugestao.endereco));
                }}
                placeholder="Para onde vai?"
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Motivo da Viagem</Label>
              <Input value={formData.motivo}
                onChange={(e) => setFormData({ ...formData, motivo: e.target.value })}
                placeholder="Ex: Entrega de material, visita técnica..." className="h-11" />
            </div>

            {/* MAPA DE LOCALIZAÇÃO */}
            <MapaLocalizacao 
              localizacaoAtual={localizacaoAtual}
              onLocalizacaoAtualChange={setLocalizacaoAtual}
              destino={destino}
              onDestinoChange={setDestino}
              isLoading={createRotaMutation.isPending}
              onGeocodeEndereco={(endereco) => {
                // Será implementado se necessário
              }}
            />

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              <strong>Atenção:</strong> Ao iniciar a viagem, será obrigatório tirar foto do painel e da carroceria.
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setNovaRotaOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createRotaMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {createRotaMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Criando...</> : 'Criar Rota'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alertas */}
      {alertas && alertas.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6 flex gap-4">
            <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-orange-800">{alertas.length} Alerta(s) de IA</p>
              <p className="text-sm text-orange-700">Há avisos da IA sobre viagens anteriores</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rotas Ativas */}
      <div>
        <h2 className="text-xl font-bold mb-4">Rotas Ativas</h2>
        {rotasAtivas.length > 0 ? (
          <div className="grid gap-4">
            {rotasAtivas.map(rota => (
                  <RotaCard 
                    key={rota.id} 
                    rota={rota}
                    onRotaAtualizada={() => queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] })}
                  />
                ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="py-10 text-center">
              <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma rota ativa no momento</p>
              <p className="text-gray-400 text-sm mt-1">Clique em "Nova Rota" para criar uma viagem</p>
              <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setNovaRotaOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />Nova Rota
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Histórico */}
      <div>
        <h2 className="text-xl font-bold mb-4">Histórico</h2>
        {rotasFinalizadas.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4">
              {histPag.paginatedItems.map(rota => (
                <RotaCard
                  key={rota.id}
                  rota={rota}
                  onRotaAtualizada={() => queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] })}
                />
              ))}
            </div>
            {histPag.totalPages > 1 && (
              <Card className="bg-white border-gray-200 shadow-sm overflow-hidden">
                <Pagination
                  currentPage={histPag.currentPage}
                  totalPages={histPag.totalPages}
                  onPageChange={histPag.goToPage}
                  startIndex={histPag.startIndex}
                  endIndex={histPag.endIndex}
                  totalItems={histPag.totalItems}
                />
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              Nenhuma viagem finalizada
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

const statusLabel = {
  planejada: { label: 'Planejada', cls: 'bg-blue-100 text-blue-700' },
  checklist_pendente: { label: 'Checklist Pendente', cls: 'bg-orange-100 text-orange-700' },
  em_andamento: { label: 'Em Andamento', cls: 'bg-yellow-100 text-yellow-800' },
  concluida: { label: 'Concluída', cls: 'bg-green-100 text-green-700' },
  cancelada: { label: 'Cancelada', cls: 'bg-red-100 text-red-700' }
};

function RotaCard({ rota, onRotaAtualizada }) {
        const st = statusLabel[rota.status] || { label: rota.status, cls: 'bg-gray-100 text-gray-700' };
        const isAtiva = ['planejada', 'checklist_pendente', 'em_andamento'].includes(rota.status);
        const [mostraMapa, setMostraMapa] = useState(false);
        const [rotaLocal, setRotaLocal] = useState(rota);

        // Ativa rastreamento em tempo real quando a rota está em andamento
        useRastreamentoTempoReal(rotaLocal.id, rotaLocal.status === 'em_andamento');

        const handleRotaAtualizada = (rotaNova) => {
          setRotaLocal(rotaNova);
          if (onRotaAtualizada) onRotaAtualizada(rotaNova);
        };

  return (
    <Card className={isAtiva ? 'border-blue-200' : 'opacity-80'}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {rotaLocal.nome && <p className="font-semibold text-gray-900 mb-1">{rotaLocal.nome}</p>}
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
              <MapPin className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              <span className="truncate">{rotaLocal.endereco_origem || 'Origem não informada'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
              <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              <span className="truncate">{rotaLocal.endereco_destino}</span>
            </div>
            <div className="flex gap-3 mt-2 text-xs text-gray-500 flex-wrap">
              {rotaLocal.data_planejada && <span><Clock className="w-3 h-3 inline mr-0.5" />{rotaLocal.data_planejada}</span>}
              {rotaLocal.hora_saida_prevista && <span>{rotaLocal.hora_saida_prevista}</span>}
              {rotaLocal.veiculo_placa && <span>{rotaLocal.veiculo_placa}</span>}
              {rotaLocal.motivo && <span>• {rotaLocal.motivo}</span>}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${st.cls}`}>
            {st.label}
          </span>
        </div>

        {/* Botão Iniciar Viagem - se em planejada/checklist */}
        {(rotaLocal.status === 'planejada' || rotaLocal.status === 'checklist_pendente') && (
          <BotaoIniciarViagem rota={rotaLocal} onSuccess={handleRotaAtualizada} />
        )}

        {/* Botão Mapa para Rotas Ativas */}
        {rotaLocal.status === 'em_andamento' && (
          <Button
            onClick={() => setMostraMapa(!mostraMapa)}
            variant="outline"
            size="sm"
            className="w-full"
          >
            <MapPin className="w-3.5 h-3.5 mr-2" />
            {mostraMapa ? 'Ocultar' : 'Ver'} Localização em Tempo Real
          </Button>
        )}

        {/* Mapa em Tempo Real */}
        {mostraMapa && rotaLocal.status === 'em_andamento' && (
          <MapaViagem rota={rotaLocal} />
        )}
      </CardContent>
    </Card>
  );
}