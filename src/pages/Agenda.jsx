import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import RouteGuardFinalV2 from '@/components/auth/RouteGuardFinalV2';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import AgendaFiltros from '../components/agenda/AgendaFiltros';
import AgendaCalendario from '../components/agenda/AgendaCalendario';
import AgendaCalendarioMensal from '../components/agenda/AgendaCalendarioMensal';
import AgendaFormModal from '../components/agenda/AgendaFormModal';

export default function Agenda() {
  return (
    <RouteGuardFinalV2 requiredPermissionKey="CALENDARIO_VIEW">
      <AgendaContent />
    </RouteGuardFinalV2>
  );
}

function AgendaContent() {
  const [filtros, setFiltros] = useState({
    de: new Date().toISOString().split('T')[0],
    ate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tipo: '',
    status: '',
    prioridade: '',
    busca: ''
  });

  const [modalAberto, setModalAberto] = useState(false);
  const [eventoEditando, setEventoEditando] = useState(null);
  const [tabAtivo, setTabAtivo] = useState('calendario');
  const [concluindo, setConcluindo] = useState({});
  const queryClient = useQueryClient();

  const { data: resposta, isLoading, refetch } = useQuery({
    queryKey: ['listar-agenda', filtros],
    queryFn: async () => {
      try {
        return await base44.functions.invoke('listarAgenda', {
          de: filtros.de,
          ate: filtros.ate,
          tipos: filtros.tipo ? [filtros.tipo] : [],
          status: filtros.status ? [filtros.status] : [],
          prioridade: filtros.prioridade || undefined,
          pagina: 0,
          limit: 100
        });
      } catch (err) {
        // Se a função listarAgenda não existe, retorna resposta vazia
        console.warn('Função listarAgenda não disponível:', err.message);
        return { data: { eventos: [], contadores: { total: 0 } } };
      }
    },
    retry: 1,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60
  });

  const eventos = resposta?.data?.eventos || [];
  const contadores = resposta?.data?.contadores || {};

  const handleFiltroChange = (chave, valor) => {
    setFiltros(prev => ({ ...prev, [chave]: valor }));
  };

  const handleLimpar = () => {
    setFiltros({
      de: new Date().toISOString().split('T')[0],
      ate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      tipo: '',
      status: '',
      prioridade: '',
      busca: ''
    });
  };

  const handleAbrirModal = (evento = null) => {
    setEventoEditando(evento);
    setModalAberto(true);
  };

  const handleFecharModal = () => {
    setModalAberto(false);
    setEventoEditando(null);
  };

  const handleSalvar = () => {
    handleFecharModal();
    refetch();
  };

  const handleConcluir = async (evento) => {
    const id = evento.id || evento.evento_id;
    try {
      setConcluindo((prev) => ({ ...prev, [id]: true }));

      await base44.functions.invoke('concluirEventoAgenda', { evento_id: id });

      // Atualiza cache otimisticamente
      queryClient.setQueryData(['listar-agenda', filtros], (prev) => {
        if (!prev?.data?.eventos) return prev;
        const novos = prev.data.eventos.map((ev) =>
          (ev.id === id || ev.evento_id === id) ? { ...ev, status: 'concluido' } : ev
        );
        return { ...prev, data: { ...prev.data, eventos: novos } };
      });

      toast.success('Evento concluído');
      refetch();
    } catch (err) {
      toast.error('Erro ao concluir evento');
      console.error(err);
    } finally {
      setConcluindo((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Helpers para tabela
  const isConcluded = (s) => {
    const v = (s || '').toLowerCase();
    return v === 'concluido' || v === 'concluído' || v === 'finalizado' || v === 'completed';
  };

  const formatDateTime = (v) => {
    if (!v) return '-';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const statusColor = {
    pendente: 'bg-amber-100 text-amber-800',
    em_andamento: 'bg-blue-100 text-blue-800',
    confirmado: 'bg-indigo-100 text-indigo-800',
    concluido: 'bg-green-100 text-green-800',
    'concluído': 'bg-green-100 text-green-800',
    finalizado: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    cancelado: 'bg-red-100 text-red-800'
  };

  const prioridadeColor = {
    baixa: 'bg-gray-100 text-gray-800',
    normal: 'bg-sky-100 text-sky-800',
    alta: 'bg-orange-100 text-orange-800',
    urgente: 'bg-red-100 text-red-800'
  };

  // Alertas de vencimento: usa data_fim se existir, senao data_inicio
  const getDueInfo = (e) => {
    const due = e?.data_fim || e?.data_inicio;
    if (!due) return { overdue: false, dueSoon: false };
    const now = new Date();
    const end = new Date(due);
    const diffMs = end - now;
    const isDone = isConcluded(e?.status);
    const overdue = diffMs < 0 && !isDone;
    const dueSoon = diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000 && !isDone;
    return { overdue, dueSoon };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8" />
            Agenda Executiva
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Gerencie compromissos, prazos e vencimentos</p>
        </div>
        <Button
          onClick={() => handleAbrirModal()}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Evento
        </Button>
      </div>

      <AgendaFiltros
        filtros={filtros}
        onFiltroChange={handleFiltroChange}
        onLimpar={handleLimpar}
      />

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>
            Total: {contadores.total || 0} eventos
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          ) : (
            <Tabs value={tabAtivo} onValueChange={setTabAtivo} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="calendario">Calendário</TabsTrigger>
                <TabsTrigger value="lista">Lista</TabsTrigger>
                <TabsTrigger value="tabela">Tabela</TabsTrigger>
              </TabsList>

              <TabsContent value="calendario">
                <AgendaCalendarioMensal eventos={eventos} />
              </TabsContent>

              <TabsContent value="lista">
                <AgendaCalendario
                  eventos={eventos}
                  onConcluir={handleConcluir}
                  onEditar={handleAbrirModal}
                />
              </TabsContent>

              <TabsContent value="tabela">
                {/* Mobile: cards */}
                <div className="md:hidden flex flex-col gap-2">
                  {eventos.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Nenhum evento no período</div>
                  ) : (
                    eventos.map((e) => {
                      const due = getDueInfo(e);
                      return (
                        <div key={e.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex items-start justify-between gap-2 min-w-0">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium truncate">{e.titulo}</span>
                                {due.overdue && <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 shrink-0">Vencido</Badge>}
                                {!due.overdue && due.dueSoon && <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 shrink-0">24h</Badge>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{formatDateTime(e.data_inicio)}{e.data_fim ? ` – ${formatDateTime(e.data_fim)}` : ''}</p>
                            </div>
                            <Badge className={`border-0 shrink-0 text-xs ${statusColor[(e.status || '').toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>{e.status || '-'}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="text-xs bg-purple-100 text-purple-800">{e.tipo || '-'}</Badge>
                            <Badge className={`text-xs ${prioridadeColor[e.prioridade] || 'bg-gray-100 text-gray-800'}`}>{e.prioridade || '-'}</Badge>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => handleAbrirModal(e)} className="text-xs">Editar</Button>
                            {!isConcluded(e.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleConcluir(e)}
                                className="text-xs"
                                disabled={Boolean(concluindo[e.id] || concluindo[e.evento_id])}>
                                {concluindo[e.id] || concluindo[e.evento_id] ? 'Concluindo...' : 'Concluir'}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* Desktop: tabela */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 sticky top-0 bg-white z-10">
                      <tr className="text-left text-gray-600 font-semibold">
                        <th className="p-3">Título</th>
                        <th className="p-3">Início</th>
                        <th className="p-3">Fim</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Prioridade</th>
                        <th className="p-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-500">Nenhum evento no período</td>
                        </tr>
                      ) : (
                        eventos.map(e => (
                          <tr key={e.id} className="border-b border-gray-100 odd:bg-white even:bg-gray-50 hover:bg-gray-50">
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{e.titulo}</span>
                                {getDueInfo(e).overdue && (
                                  <Badge className="bg-red-600 text-white text-[10px] px-1.5 py-0.5">Vencido</Badge>
                                )}
                                {!getDueInfo(e).overdue && getDueInfo(e).dueSoon && (
                                  <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5">24h</Badge>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-xs">{formatDateTime(e.data_inicio)}</td>
                            <td className="p-3 text-xs">{formatDateTime(e.data_fim)}</td>
                            <td className="p-3">
                              <Badge className="text-xs bg-purple-100 text-purple-800">{e.tipo || '-'}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={`text-xs ${statusColor[(e.status || '').toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>{e.status || '-'}</Badge>
                            </td>
                            <td className="p-3">
                              <Badge className={`text-xs ${prioridadeColor[e.prioridade] || 'bg-gray-100 text-gray-800'}`}>{e.prioridade || '-'}</Badge>
                            </td>
                            <td className="p-3">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleAbrirModal(e)}
                                  className="text-xs"
                                >
                                  Editar
                                </Button>
                                {!isConcluded(e.status) && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleConcluir(e)}
                                    className="text-xs"
                                    disabled={Boolean(concluindo[e.id] || concluindo[e.evento_id])}
                                  >
                                    {concluindo[e.id] || concluindo[e.evento_id] ? 'Concluindo...' : 'Concluir'}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <AgendaFormModal
        open={modalAberto}
        evento={eventoEditando}
        onClose={handleFecharModal}
        onSave={handleSalvar}
      />
    </div>
  );
}