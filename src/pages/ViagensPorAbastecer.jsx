import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Route, Truck, Fuel, Eye, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ViagemDetalhesModal from '@/components/logistica/ViagemDetalhesModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import { TableSkeleton } from '@/components/shared/Skeletons';

const ITENS_POR_PAGINA = 15;

const statusConfig = {
  planejada: { label: 'Planejada', color: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-100 text-amber-700' },
  concluida: { label: 'Concluída', color: 'bg-emerald-100 text-emerald-700' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' }
};
const statusBadge = (s) => statusConfig[s] || { label: s || '—', color: 'bg-gray-100 text-gray-700' };

const combustivelConfig = {
  diesel: { label: 'Diesel', color: 'bg-amber-100 text-amber-700' },
  diesel_s10: { label: 'Diesel S10', color: 'bg-emerald-100 text-emerald-700' },
  gasolina: { label: 'Gasolina', color: 'bg-red-100 text-red-700' },
  etanol: { label: 'Etanol', color: 'bg-blue-100 text-blue-700' }
};

const TIPO_VIAGEM_OPCOES = [
  { value: 'transporte_material', label: 'Transporte de Material' },
  { value: 'transporte_equipamento', label: 'Transporte de Equipamento' },
  { value: 'transporte_pessoal', label: 'Transporte de Pessoal' },
  { value: 'servico', label: 'Serviço' }
];
const STATUS_OPCOES = [
  { value: 'planejada', label: 'Planejada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'cancelada', label: 'Cancelada' }
];
const COMBUSTIVEL_OPCOES = [
  { value: 'diesel', label: 'Diesel' },
  { value: 'diesel_s10', label: 'Diesel S10' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' }
];

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const moeda = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function Kpi({ titulo, valor, Icon, bg, text }) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0"><p className="text-sm text-gray-600">{titulo}</p><p className={`text-2xl font-bold truncate ${text}`}>{valor}</p></div>
          <div className={`p-2.5 rounded-xl ${bg}`}><Icon className={`w-6 h-6 ${text}`} /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ViagensPorAbastecer() {
  const [activeTab, setActiveTab] = useState('viagens');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState('viagem');
  const [selectedViagemId, setSelectedViagemId] = useState(null);
  const [excluirAbast, setExcluirAbast] = useState(null);
  const queryClient = useQueryClient();

  const [viagemForm, setViagemForm] = useState({
    veiculo_id: '', motorista_id: '', obra_origem_id: '', obra_destino_id: '',
    tipo: 'transporte_material', descricao_carga: '', data_saida: '',
    km_inicial: '', km_final: '', combustivel_gasto: '', pedagios: '',
    outras_despesas: '', status: 'planejada', observacoes: ''
  });
  const [abastecimentoForm, setAbastecimentoForm] = useState({
    veiculo_id: '', data: new Date().toISOString().split('T')[0],
    km_atual: '', litros: '', valor_litro: '', valor_total: '',
    combustivel: 'diesel', posto: '', motorista: ''
  });

  const { data: viagens = [], isLoading: loadingViagens } = useQuery({ queryKey: ['viagens'], queryFn: () => base44.entities.Viagem.list('-data_saida', 100) });
  const { data: abastecimentos = [], isLoading: loadingAbastecimentos } = useQuery({ queryKey: ['abastecimentos'], queryFn: () => base44.entities.Abastecimento.list('-data', 200) });
  const { data: veiculos = [] } = useQuery({ queryKey: ['veiculos'], queryFn: () => base44.entities.Veiculo.list() });
  const { data: motoristasEnt = [] } = useQuery({ queryKey: ['motoristas'], queryFn: () => base44.entities.Motorista.list() });
  const { data: users = [] } = useQuery({ queryKey: ['users-all'], queryFn: () => base44.entities.User.list() });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });

  // Veículos (combobox + lookup) — sem filtro de status (placa pode vir sem status).
  const veiculoOptions = useMemo(() => veiculos.map(v => ({ value: v.id, label: `${v.placa || 'Sem placa'}${v.modelo || v.marca ? ` - ${[v.marca, v.modelo].filter(Boolean).join(' ')}` : ''}` })), [veiculos]);
  const veiculoLabel = useMemo(() => { const m = new Map(veiculoOptions.map(o => [o.value, o.label])); return (id) => m.get(id) || (id ? `#${String(id).substring(0, 6)}` : '—'); }, [veiculoOptions]);

  // Motoristas = entidade Motorista + Usuários com cargo/perfil "motorista".
  const motoristaOptions = useMemo(() => {
    const opts = []; const seen = new Set();
    motoristasEnt.forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); opts.push({ value: m.id, label: m.nome || m.id }); } });
    users.filter(u => ['motorista'].includes(String(u.cargo || '').toLowerCase()) || ['motorista'].includes(String(u.perfil_acesso || '').toLowerCase()))
      .forEach(u => { const id = u.email || u.id; if (!seen.has(id)) { seen.add(id); opts.push({ value: id, label: u.full_name || u.email }); } });
    return opts;
  }, [motoristasEnt, users]);
  const motoristaLabel = useMemo(() => { const m = new Map(motoristaOptions.map(o => [o.value, o.label])); return (id) => m.get(id) || id || '—'; }, [motoristaOptions]);
  const motoristaPorNome = useMemo(() => motoristaOptions.map(o => ({ value: o.label, label: o.label })), [motoristaOptions]);
  const obraOptions = useMemo(() => obras.map(o => ({ value: o.id, label: o.nome || o.nome_obra || o.id })), [obras]);

  const viagemMutation = useMutation({
    mutationFn: (data) => {
      const kmPercorrido = data.km_final && data.km_inicial ? num(data.km_final) - num(data.km_inicial) : 0;
      const custoTotal = num(data.pedagios) + num(data.outras_despesas);
      return base44.entities.Viagem.create({
        ...data,
        km_inicial: num(data.km_inicial), km_final: data.km_final ? num(data.km_final) : null,
        km_percorrido: kmPercorrido, combustivel_gasto: data.combustivel_gasto ? num(data.combustivel_gasto) : null,
        pedagios: num(data.pedagios), outras_despesas: num(data.outras_despesas), custo_total: custoTotal
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['viagens'] }); toast.success('Viagem registrada!'); setDialogOpen(false); resetViagemForm(); },
    onError: (e) => toast.error('Erro ao registrar: ' + e.message)
  });

  const abastecimentoMutation = useMutation({
    mutationFn: (data) => base44.entities.Abastecimento.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['abastecimentos'] }); toast.success('Abastecimento registrado!'); setDialogOpen(false); resetAbastecimentoForm(); },
    onError: (e) => toast.error('Erro ao registrar: ' + e.message)
  });

  const excluirAbastMutation = useMutation({
    mutationFn: (aId) => base44.entities.Abastecimento.delete(aId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['abastecimentos'] }); toast.success('Abastecimento removido'); setExcluirAbast(null); },
    onError: (e) => toast.error('Erro ao excluir: ' + e.message)
  });

  const resetViagemForm = () => setViagemForm({ veiculo_id: '', motorista_id: '', obra_origem_id: '', obra_destino_id: '', tipo: 'transporte_material', descricao_carga: '', data_saida: '', km_inicial: '', km_final: '', combustivel_gasto: '', pedagios: '', outras_despesas: '', status: 'planejada', observacoes: '' });
  const resetAbastecimentoForm = () => setAbastecimentoForm({ veiculo_id: '', data: new Date().toISOString().split('T')[0], km_atual: '', litros: '', valor_litro: '', valor_total: '', combustivel: 'diesel', posto: '', motorista: '' });

  const handleViagemSubmit = (e) => {
    e.preventDefault();
    if (!viagemForm.veiculo_id) { toast.error('Selecione o veículo'); return; }
    viagemMutation.mutate(viagemForm);
  };
  const handleAbastecimentoSubmit = (e) => {
    e.preventDefault();
    if (!abastecimentoForm.veiculo_id) { toast.error('Selecione o veículo'); return; }
    const litros = num(abastecimentoForm.litros); const valorLitro = num(abastecimentoForm.valor_litro);
    abastecimentoMutation.mutate({ ...abastecimentoForm, km_atual: num(abastecimentoForm.km_atual), litros, valor_litro: valorLitro, valor_total: abastecimentoForm.valor_total ? num(abastecimentoForm.valor_total) : litros * valorLitro });
  };

  const setV = (campo, valor) => setViagemForm(f => ({ ...f, [campo]: valor }));
  const setA = (campo, valor) => setAbastecimentoForm(f => ({ ...f, [campo]: valor }));
  const openDialog = (type) => { setDialogType(type); setDialogOpen(true); };

  // Filtros
  const filteredViagens = useMemo(() => viagens.filter(v => {
    const veiculo = veiculos.find(ve => ve.id === v.veiculo_id);
    const matchSearch = !searchTerm
      || veiculo?.placa?.toLowerCase().includes(searchTerm.toLowerCase())
      || v.descricao_carga?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'todos' || v.status === statusFilter;
    return matchSearch && matchStatus;
  }), [viagens, veiculos, searchTerm, statusFilter]);

  const filteredAbastecimentos = useMemo(() => abastecimentos.filter(a => {
    if (!searchTerm) return true;
    const veiculo = veiculos.find(v => v.id === a.veiculo_id);
    const q = searchTerm.toLowerCase();
    return veiculo?.placa?.toLowerCase().includes(q) || a.posto?.toLowerCase().includes(q) || a.motorista?.toLowerCase().includes(q);
  }), [abastecimentos, veiculos, searchTerm]);

  const viagensPag = usePagination(filteredViagens, ITENS_POR_PAGINA);
  const abastPag = usePagination(filteredAbastecimentos, ITENS_POR_PAGINA);
  useEffect(() => { viagensPag.goToPage(1); abastPag.goToPage(1); }, [searchTerm, statusFilter, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats
  const totalKm = viagens.reduce((acc, v) => acc + (v.km_percorrido || 0), 0);
  const totalLitros = abastecimentos.reduce((acc, a) => acc + (a.litros || 0), 0);
  const totalGasto = abastecimentos.reduce((acc, a) => acc + (a.valor_total || 0), 0);
  const mediaPreco = totalLitros > 0 ? totalGasto / totalLitros : 0;
  const mediaCombustivel = totalLitros > 0 && totalKm > 0 ? totalKm / totalLitros : 0;
  const stats = {
    total: viagens.length,
    emAndamento: viagens.filter(v => v.status === 'em_andamento').length,
    concluidas: viagens.filter(v => v.status === 'concluida').length
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registro de Viagens & Abastecimentos"
        subtitle="Lançamento manual de viagens e abastecimentos da frota"
        action={() => openDialog(activeTab === 'viagens' ? 'viagem' : 'abastecimento')}
        actionLabel={activeTab === 'viagens' ? 'Nova Viagem' : 'Novo Abastecimento'}
      />

      {/* Abas */}
      <div className="flex gap-2 border-b border-gray-200">
        {[{ k: 'viagens', label: 'Viagens', Icon: Route }, { k: 'abastecimentos', label: 'Abastecimentos', Icon: Fuel }].map(t => (
          <button
            key={t.k}
            onClick={() => { setActiveTab(t.k); setSearchTerm(''); setStatusFilter('todos'); }}
            className={cn('px-6 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2',
              activeTab === t.k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900')}
          >
            <t.Icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'viagens' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi titulo="Total de Viagens" valor={stats.total} Icon={Route} bg="bg-gray-100" text="text-gray-900" />
            <Kpi titulo="Em Andamento" valor={stats.emAndamento} Icon={Truck} bg="bg-amber-50" text="text-amber-600" />
            <Kpi titulo="Concluídas" valor={stats.concluidas} Icon={Route} bg="bg-emerald-50" text="text-emerald-600" />
            <Kpi titulo="KM Percorridos" valor={`${totalKm.toLocaleString('pt-BR')} km`} Icon={Route} bg="bg-purple-50" text="text-purple-600" />
          </div>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-gray-900">Viagens</CardTitle>
              <div className="flex flex-wrap gap-2 sm:w-auto w-full">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <Input placeholder="Buscar por placa ou carga..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 pl-9" />
                </div>
                <div className="w-full sm:w-44">
                  <ComboboxBusca options={[{ value: 'todos', label: 'Todos status' }, ...STATUS_OPCOES]} value={statusFilter} onSelect={setStatusFilter} placeholder="Status" searchPlaceholder="Buscar..." />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingViagens ? (
                <TableSkeleton bare rows={6} cols={8} />
              ) : filteredViagens.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                  <Route className="w-10 h-10" /><p className="text-sm text-gray-500">Nenhuma viagem encontrada</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Veículo</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Motorista</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data Saída</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">KM</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Custo</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {viagensPag.paginatedItems.map(v => {
                          const st = statusBadge(v.status);
                          return (
                            <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-900 font-medium capitalize">{(v.tipo || '').replace(/_/g, ' ') || '—'}</td>
                              <td className="px-4 py-3 text-gray-600">{veiculoLabel(v.veiculo_id)}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{motoristaLabel(v.motorista_id)}</td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.data_saida ? new Date(v.data_saida).toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{v.km_percorrido > 0 ? `${v.km_percorrido} km` : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{moeda(v.custo_total)}</td>
                              <td className="px-4 py-3 text-center"><Badge className={`border-0 ${st.color}`}>{st.label}</Badge></td>
                              <td className="px-4 py-3">
                                <TooltipProvider delayDuration={200}>
                                  <div className="flex items-center justify-end">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setSelectedViagemId(v.id)}>
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
                  <Pagination currentPage={viagensPag.currentPage} totalPages={viagensPag.totalPages} onPageChange={viagensPag.goToPage} startIndex={viagensPag.startIndex} endIndex={viagensPag.endIndex} totalItems={viagensPag.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            <Kpi titulo="Total de Litros" valor={`${totalLitros.toFixed(0)} L`} Icon={Fuel} bg="bg-blue-50" text="text-blue-600" />
            <Kpi titulo="Total Gasto" valor={moeda(totalGasto)} Icon={Fuel} bg="bg-red-50" text="text-red-600" />
            <Kpi titulo="Preço Médio/Litro" valor={moeda(mediaPreco)} Icon={Fuel} bg="bg-amber-50" text="text-amber-600" />
            <Kpi titulo="Média (km/L)" valor={mediaCombustivel > 0 ? `${mediaCombustivel.toFixed(1)}` : '—'} Icon={Route} bg="bg-emerald-50" text="text-emerald-600" />
          </div>

          <Card className="bg-white border-gray-200 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-gray-900">Abastecimentos</CardTitle>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <Input placeholder="Buscar por placa, posto ou motorista..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-9 pl-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingAbastecimentos ? (
                <TableSkeleton bare rows={6} cols={9} />
              ) : filteredAbastecimentos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
                  <Fuel className="w-10 h-10" /><p className="text-sm text-gray-500">Nenhum abastecimento encontrado</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Veículo</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">Combustível</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Data</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">KM</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Litros</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">R$/L</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Posto</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {abastPag.paginatedItems.map(a => {
                          const comb = combustivelConfig[a.combustivel] || combustivelConfig.diesel;
                          return (
                            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-900 font-medium">{veiculoLabel(a.veiculo_id)}</td>
                              <td className="px-4 py-3 text-center"><Badge className={`border-0 ${comb.color}`}>{comb.label}</Badge></td>
                              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{a.data ? new Date(a.data).toLocaleDateString('pt-BR') : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{a.km_atual != null ? Number(a.km_atual).toLocaleString('pt-BR') : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{a.litros != null ? `${Number(a.litros).toFixed(2)} L` : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{a.valor_litro != null ? a.valor_litro.toFixed(2) : '—'}</td>
                              <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap">{moeda(a.valor_total)}</td>
                              <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">{a.posto || '—'}</td>
                              <td className="px-4 py-3">
                                <TooltipProvider delayDuration={200}>
                                  <div className="flex items-center justify-end">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluirAbast(a)}>
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir</TooltipContent>
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
                  <Pagination currentPage={abastPag.currentPage} totalPages={abastPag.totalPages} onPageChange={abastPag.goToPage} startIndex={abastPag.startIndex} endIndex={abastPag.endIndex} totalItems={abastPag.totalItems} />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialog Viagem */}
      <Dialog open={dialogOpen && dialogType === 'viagem'} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Viagem</DialogTitle></DialogHeader>
          <form onSubmit={handleViagemSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-1 block">Veículo *</Label>
                <ComboboxBusca options={veiculoOptions} value={viagemForm.veiculo_id} onSelect={(v) => setV('veiculo_id', v)} placeholder="Selecione" searchPlaceholder="Buscar veículo..." />
              </div>
              <div>
                <Label className="mb-1 block">Motorista</Label>
                <ComboboxBusca options={motoristaOptions} value={viagemForm.motorista_id} onSelect={(v) => setV('motorista_id', v)} placeholder="Selecione" searchPlaceholder="Buscar motorista..." />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Tipo de Viagem</Label>
                <ComboboxBusca options={TIPO_VIAGEM_OPCOES} value={viagemForm.tipo} onSelect={(v) => setV('tipo', v)} placeholder="Selecione" searchPlaceholder="Buscar..." />
              </div>
              <div>
                <Label className="mb-1 block">Origem</Label>
                <ComboboxBusca options={obraOptions} value={viagemForm.obra_origem_id} onSelect={(v) => setV('obra_origem_id', v)} placeholder="Selecione" searchPlaceholder="Buscar obra..." />
              </div>
              <div>
                <Label className="mb-1 block">Destino</Label>
                <ComboboxBusca options={obraOptions} value={viagemForm.obra_destino_id} onSelect={(v) => setV('obra_destino_id', v)} placeholder="Selecione" searchPlaceholder="Buscar obra..." />
              </div>
              <div className="md:col-span-2">
                <Label className="mb-1 block">Descrição da Carga</Label>
                <Textarea value={viagemForm.descricao_carga} onChange={(e) => setV('descricao_carga', e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="mb-1 block">Data/Hora Saída</Label>
                <Input type="datetime-local" className="h-11" value={viagemForm.data_saida} onChange={(e) => setV('data_saida', e.target.value)} />
              </div>
              <div>
                <Label className="mb-1 block">Status</Label>
                <ComboboxBusca options={STATUS_OPCOES} value={viagemForm.status} onSelect={(v) => setV('status', v)} placeholder="Selecione" searchPlaceholder="Buscar..." />
              </div>
              <div><Label className="mb-1 block">KM Inicial</Label><Input type="number" className="h-11" value={viagemForm.km_inicial} onChange={(e) => setV('km_inicial', e.target.value)} /></div>
              <div><Label className="mb-1 block">KM Final</Label><Input type="number" className="h-11" value={viagemForm.km_final} onChange={(e) => setV('km_final', e.target.value)} /></div>
              <div><Label className="mb-1 block">Pedágios (R$)</Label><Input type="number" step="0.01" className="h-11" value={viagemForm.pedagios} onChange={(e) => setV('pedagios', e.target.value)} /></div>
              <div><Label className="mb-1 block">Outras Despesas (R$)</Label><Input type="number" step="0.01" className="h-11" value={viagemForm.outras_despesas} onChange={(e) => setV('outras_despesas', e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={viagemMutation.isPending}>{viagemMutation.isPending ? 'Registrando...' : 'Registrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Abastecimento */}
      <Dialog open={dialogOpen && dialogType === 'abastecimento'} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Abastecimento</DialogTitle></DialogHeader>
          <form onSubmit={handleAbastecimentoSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label className="mb-1 block">Veículo *</Label>
                <ComboboxBusca options={veiculoOptions} value={abastecimentoForm.veiculo_id} onSelect={(v) => setA('veiculo_id', v)} placeholder="Selecione o veículo" searchPlaceholder="Buscar veículo..." />
              </div>
              <div><Label className="mb-1 block">Data *</Label><Input type="date" className="h-11" value={abastecimentoForm.data} onChange={(e) => setA('data', e.target.value)} required /></div>
              <div><Label className="mb-1 block">KM Atual *</Label><Input type="number" className="h-11" value={abastecimentoForm.km_atual} onChange={(e) => setA('km_atual', e.target.value)} required /></div>
              <div>
                <Label className="mb-1 block">Combustível</Label>
                <ComboboxBusca options={COMBUSTIVEL_OPCOES} value={abastecimentoForm.combustivel} onSelect={(v) => setA('combustivel', v)} placeholder="Selecione" searchPlaceholder="Buscar..." />
              </div>
              <div><Label className="mb-1 block">Litros *</Label><Input type="number" step="0.01" className="h-11" value={abastecimentoForm.litros} onChange={(e) => setA('litros', e.target.value)} required /></div>
              <div><Label className="mb-1 block">Valor/Litro (R$) *</Label><Input type="number" step="0.01" className="h-11" value={abastecimentoForm.valor_litro} onChange={(e) => setA('valor_litro', e.target.value)} required /></div>
              <div><Label className="mb-1 block">Valor Total (R$)</Label><Input type="number" step="0.01" className="h-11" value={abastecimentoForm.valor_total || (num(abastecimentoForm.litros) * num(abastecimentoForm.valor_litro)).toFixed(2)} onChange={(e) => setA('valor_total', e.target.value)} /></div>
              <div><Label className="mb-1 block">Posto</Label><Input className="h-11" value={abastecimentoForm.posto} onChange={(e) => setA('posto', e.target.value)} /></div>
              <div>
                <Label className="mb-1 block">Motorista</Label>
                <ComboboxBusca options={motoristaPorNome} value={abastecimentoForm.motorista} onSelect={(v) => setA('motorista', v)} placeholder="Selecione" searchPlaceholder="Buscar motorista..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={abastecimentoMutation.isPending}>{abastecimentoMutation.isPending ? 'Registrando...' : 'Registrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes da Viagem */}
      {selectedViagemId && (
        <ViagemDetalhesModal
          id={selectedViagemId}
          onClose={() => setSelectedViagemId(null)}
          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['viagens'] }); setSelectedViagemId(null); }}
        />
      )}

      {/* Confirmar exclusão de abastecimento */}
      <AlertDialog open={!!excluirAbast} onOpenChange={(open) => !open && setExcluirAbast(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir abastecimento?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir este abastecimento{excluirAbast?.valor_total ? ` de ${moeda(excluirAbast.valor_total)}` : ''}? Esta ação é irreversível.
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluirAbastMutation.mutate(excluirAbast.id)} disabled={excluirAbastMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {excluirAbastMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
