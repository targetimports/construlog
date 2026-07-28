import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Plus, Wrench, Clock, CheckCircle2, PlayCircle, AlertTriangle, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { formatBRL } from '@/components/shared/moneyBR';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  agendada:     { label: 'Agendada',     cls: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em andamento', cls: 'bg-amber-100 text-amber-700' },
  concluida:    { label: 'Concluída',    cls: 'bg-green-100 text-green-700' },
  cancelada:    { label: 'Cancelada',    cls: 'bg-gray-100 text-gray-400' },
};

const TIPO_LABEL = { preventiva: 'Preventiva', corretiva: 'Corretiva' };

const hojeISO = () => new Date().toISOString().slice(0, 10);

// dd/MM/yy a partir de "YYYY-MM-DD" (sem depender de timezone)
function fmtData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return '—';
  return `${d}/${m}/${y.slice(2)}`;
}

const FORM_INICIAL = {
  ativo_id: '',
  tipo: 'preventiva',
  categoria: '',
  descricao: '',
  data_prevista: '',
  custo_estimado: '',
};

const CONCLUIR_INICIAL = {
  custo_pecas: '',
  custo_mao_obra: '',
  medidor_realizado: '',
  oficina: '',
  data_realizada: hojeISO(),
  observacoes: '',
};

export default function ManutencaoAtivos() {
  const qc = useQueryClient();
  const [modalAgendar, setModalAgendar] = useState(false);
  const [errAgendar, setErrAgendar] = useState({});
  const [errConcluir, setErrConcluir] = useState({});
  const [form, setForm] = useState(FORM_INICIAL);
  const [concluirAlvo, setConcluirAlvo] = useState(null); // manutenção em conclusão
  const [concluirForm, setConcluirForm] = useState(CONCLUIR_INICIAL);

  const { data: manutencoes = [], isLoading } = useQuery({
    queryKey: ['manutencao-ativos'],
    queryFn: () => base44.entities.ManutencaoAtivo.list('-created_date', 500),
  });

  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500).catch(() => []),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['manutencao-ativos'] });
    qc.invalidateQueries({ queryKey: ['ativos'] });
  };

  const criarMutation = useMutation({
    mutationFn: (payload) => base44.entities.ManutencaoAtivo.create(payload),
    onSuccess: () => {
      invalidar();
      toast.success('Manutenção agendada.');
      setModalAgendar(false);
      setForm(FORM_INICIAL);
    },
    onError: (e) => toast.error('Erro ao agendar: ' + (e?.message || e)),
  });

  const iniciarMutation = useMutation({
    mutationFn: (manutencao_id) => base44.functions.invoke('iniciarManutencaoAtivo', { manutencao_id }),
    onSuccess: (res) => {
      if (res.data?.success === false) { toast.error(res.data.error || 'Não foi possível iniciar.'); return; }
      invalidar();
      toast.success('Manutenção iniciada.');
    },
    onError: (e) => toast.error('Erro ao iniciar: ' + (e?.message || e)),
  });

  const concluirMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('concluirManutencaoAtivo', payload),
    onSuccess: (res) => {
      if (res.data?.success === false) { toast.error(res.data.error || 'Não foi possível concluir.'); return; }
      invalidar();
      toast.success('Concluída — custo ' + formatBRL(res.data?.custo_real));
      setConcluirAlvo(null);
      setConcluirForm(CONCLUIR_INICIAL);
    },
    onError: (e) => toast.error('Erro ao concluir: ' + (e?.message || e)),
  });

  const ativoOptions = useMemo(
    () => ativos.map((a) => ({ value: a.id, label: a.codigo ? `${a.codigo} — ${a.nome}` : (a.nome || a.id) })),
    [ativos]
  );

  // KPIs
  const totalAgendadas = manutencoes.filter((m) => m.status === 'agendada').length;
  const totalEmAndamento = manutencoes.filter((m) => m.status === 'em_andamento').length;
  const totalConcluidas = manutencoes.filter((m) => m.status === 'concluida').length;

  // Alertas: agendadas com data prevista vencida (lê a MESMA entidade que é escrita)
  const hoje = hojeISO();
  const vencidas = useMemo(
    () => manutencoes.filter((m) => m.status === 'agendada' && m.data_prevista && String(m.data_prevista).slice(0, 10) < hoje),
    [manutencoes, hoje]
  );

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(manutencoes, 20);

  const abrirAgendar = () => { setForm(FORM_INICIAL); setErrAgendar({}); setModalAgendar(true); };

  const setAgendar = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrAgendar((e) => (e[k] ? { ...e, [k]: null } : e));
  };
  const setConcluir = (k, v) => {
    setConcluirForm((f) => ({ ...f, [k]: v }));
    setErrConcluir((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const salvarAgendamento = () => {
    const e = {};
    if (!form.ativo_id) e.ativo_id = 'Selecione o ativo.';
    if (!form.data_prevista) e.data_prevista = 'Informe a data prevista.';
    if (form.custo_estimado !== '' && Number(form.custo_estimado) < 0) e.custo_estimado = 'Valor não pode ser negativo.';
    setErrAgendar(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }

    const ativo = ativos.find((a) => a.id === form.ativo_id);
    criarMutation.mutate({
      ativo_id: form.ativo_id,
      ativo_nome: ativo?.nome || '',
      tipo: form.tipo,
      categoria: form.categoria || '',
      descricao: form.descricao || '',
      data_prevista: form.data_prevista,
      custo_estimado: Number(form.custo_estimado) || 0,
      status: 'agendada',
    });
  };

  const abrirConcluir = (m) => {
    setConcluirForm({ ...CONCLUIR_INICIAL, data_realizada: hojeISO() });
    setErrConcluir({});
    setConcluirAlvo(m);
  };

  const salvarConclusao = () => {
    if (!concluirAlvo) return;

    const e = {};
    // Custos da manutenção entram no custo do ativo — negativo abateria custo indevidamente.
    if (concluirForm.custo_pecas !== '' && Number(concluirForm.custo_pecas) < 0) e.custo_pecas = 'Valor não pode ser negativo.';
    if (concluirForm.custo_mao_obra !== '' && Number(concluirForm.custo_mao_obra) < 0) e.custo_mao_obra = 'Valor não pode ser negativo.';
    if (concluirForm.medidor_realizado !== '' && Number(concluirForm.medidor_realizado) < 0) e.medidor_realizado = 'Leitura inválida.';

    if (!concluirForm.data_realizada) e.data_realizada = 'Informe a data realizada.';
    else if (concluirForm.data_realizada > hojeISO()) e.data_realizada = 'A data não pode ser futura.';

    setErrConcluir(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }

    concluirMutation.mutate({
      manutencao_id: concluirAlvo.id,
      custo_pecas: Number(concluirForm.custo_pecas) || 0,
      custo_mao_obra: Number(concluirForm.custo_mao_obra) || 0,
      medidor_realizado: concluirForm.medidor_realizado === '' ? null : Number(concluirForm.medidor_realizado),
      oficina: concluirForm.oficina || '',
      data_realizada: concluirForm.data_realizada || hojeISO(),
      observacoes: concluirForm.observacoes || '',
    });
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manutenção de Ativos</h1>
          <p className="text-sm text-gray-500 mt-1">{manutencoes.length} manutenção(ões) no total</p>
        </div>
        <Button onClick={abrirAgendar} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Agendar Manutenção
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <CalendarClock className="w-4 h-4" />
            <p className="text-xs font-medium">Agendadas</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{totalAgendadas}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-4 h-4" />
            <p className="text-xs font-medium">Em andamento</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">{totalEmAndamento}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500">
            <CheckCircle2 className="w-4 h-4" />
            <p className="text-xs font-medium">Concluídas</p>
          </div>
          <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 tabular-nums">{totalConcluidas}</p>
        </Card>
      </div>

      {/* Alertas: manutenções vencidas */}
      {vencidas.length > 0 && (
        <Card className="bg-red-50 border-red-200">
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <p className="text-sm font-semibold text-red-700">
                {vencidas.length} manutenção(ões) agendada(s) com data vencida
              </p>
            </div>
            <div className="space-y-2">
              {vencidas.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white border border-red-100 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.ativo_nome || '—'}</p>
                    <p className="text-xs text-gray-500">
                      {TIPO_LABEL[m.tipo] || m.tipo || '—'}
                      {m.categoria ? ` · ${m.categoria}` : ''}
                      {' · Prevista '}{fmtData(m.data_prevista)}
                    </p>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1"
                    disabled={iniciarMutation.isPending}
                    onClick={() => iniciarMutation.mutate(m.id)}
                  >
                    <PlayCircle className="w-3.5 h-3.5" /> Iniciar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : manutencoes.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhuma manutenção cadastrada.</p>
              <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={abrirAgendar}>
                Agendar primeira manutenção
              </Button>
            </div>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((m) => {
                  const stCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.agendada;
                  const concluida = m.status === 'concluida';
                  const dataExibida = concluida ? m.data_realizada : m.data_prevista;
                  const custoExibido = concluida ? m.custo_real : m.custo_estimado;
                  return (
                    <div key={m.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{m.ativo_nome || '—'}</p>
                          <p className="text-xs text-gray-500">{TIPO_LABEL[m.tipo] || m.tipo || '—'}{m.categoria ? ` · ${m.categoria}` : ''}</p>
                        </div>
                        <Badge className={`border-0 flex-shrink-0 ${stCfg.cls}`}>{stCfg.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{fmtData(dataExibida)}</span>
                        <span className="text-gray-700">{formatBRL(custoExibido)}</span>
                      </div>
                      {(m.status === 'agendada' || m.status === 'em_andamento') && (
                        <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                          {m.status === 'agendada' && (
                            <Button variant="outline" size="sm" className="h-8 text-amber-700 border-amber-300 hover:bg-amber-50 gap-1" disabled={iniciarMutation.isPending} onClick={() => iniciarMutation.mutate(m.id)}>
                              <PlayCircle className="w-3.5 h-3.5" /> Iniciar
                            </Button>
                          )}
                          {m.status === 'em_andamento' && (
                            <Button variant="outline" size="sm" className="h-8 text-green-700 border-green-300 hover:bg-green-50 gap-1" onClick={() => abrirConcluir(m)}>
                              <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Ativo</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Tipo</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Categoria</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                      <th className="text-right p-3 text-xs font-semibold text-gray-500">Custo</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((m) => {
                      const stCfg = STATUS_CONFIG[m.status] || STATUS_CONFIG.agendada;
                      const concluida = m.status === 'concluida';
                      const dataExibida = concluida ? m.data_realizada : m.data_prevista;
                      const custoExibido = concluida ? m.custo_real : m.custo_estimado;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{m.ativo_nome || '—'}</td>
                          <td className="p-3 text-gray-600">{TIPO_LABEL[m.tipo] || m.tipo || '—'}</td>
                          <td className="p-3 text-gray-600">{m.categoria || '—'}</td>
                          <td className="p-3"><Badge className={`border-0 ${stCfg.cls}`}>{stCfg.label}</Badge></td>
                          <td className="p-3 text-gray-500 text-xs">{fmtData(dataExibida)}</td>
                          <td className="p-3 text-right text-gray-700">{formatBRL(custoExibido)}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {m.status === 'agendada' && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1"
                                  disabled={iniciarMutation.isPending}
                                  onClick={() => iniciarMutation.mutate(m.id)}
                                >
                                  <PlayCircle className="w-3.5 h-3.5" /> Iniciar
                                </Button>
                              )}
                              {m.status === 'em_andamento' && (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-green-700 border-green-300 hover:bg-green-50 gap-1"
                                  onClick={() => abrirConcluir(m)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Concluir
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal Agendar Manutenção */}
      <Dialog open={modalAgendar} onOpenChange={(o) => { if (!o) setModalAgendar(false); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agendar Manutenção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Ativo *</Label>
              <ComboboxBusca
                options={ativoOptions}
                value={form.ativo_id}
                onSelect={(v) => setAgendar('ativo_id', v)}
                placeholder="Selecionar ativo"
                searchPlaceholder="Buscar ativo..."
                emptyMessage="Nenhum ativo encontrado."
                className={errAgendar.ativo_id ? 'border-red-400' : ''}
              />
              {errAgendar.ativo_id && <p className="text-xs text-red-500 mt-1">{errAgendar.ativo_id}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Tipo</Label>
                <ComboboxBusca
                  options={[
                    { value: 'preventiva', label: 'Preventiva' },
                    { value: 'corretiva', label: 'Corretiva' },
                  ]}
                  value={form.tipo}
                  onSelect={(v) => setAgendar('tipo', v || 'preventiva')}
                  placeholder="Selecione o tipo"
                  searchPlaceholder="Buscar tipo..."
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Categoria</Label>
                <Input className="h-11" placeholder="Ex.: Troca de óleo" value={form.categoria} onChange={(e) => setAgendar('categoria', e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Descrição</Label>
              <Textarea rows={3} placeholder="Detalhes da manutenção..." value={form.descricao} onChange={(e) => setAgendar('descricao', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data prevista *</Label>
                <Input type="date" className={`h-11 ${errAgendar.data_prevista ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.data_prevista} onChange={(e) => setAgendar('data_prevista', e.target.value)} />
                {errAgendar.data_prevista && <p className="text-xs text-red-500 mt-1">{errAgendar.data_prevista}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo estimado (R$)</Label>
                <Input type="number" min="0" step="0.01" className={`h-11 ${errAgendar.custo_estimado ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0,00" value={form.custo_estimado} onChange={(e) => setAgendar('custo_estimado', e.target.value)} />
                {errAgendar.custo_estimado && <p className="text-xs text-red-500 mt-1">{errAgendar.custo_estimado}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300 text-gray-700" onClick={() => setModalAgendar(false)}>Cancelar</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled={criarMutation.isPending} onClick={salvarAgendamento}>
              {criarMutation.isPending ? 'Salvando...' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Concluir Manutenção */}
      <Dialog open={!!concluirAlvo} onOpenChange={(o) => { if (!o) setConcluirAlvo(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Concluir Manutenção{concluirAlvo?.ativo_nome ? ` — ${concluirAlvo.ativo_nome}` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo peças (R$)</Label>
                <Input type="number" min="0" step="0.01" className={`h-11 ${errConcluir.custo_pecas ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0,00" value={concluirForm.custo_pecas} onChange={(e) => setConcluir('custo_pecas', e.target.value)} />
                {errConcluir.custo_pecas && <p className="text-xs text-red-500 mt-1">{errConcluir.custo_pecas}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Custo mão de obra (R$)</Label>
                <Input type="number" min="0" step="0.01" className={`h-11 ${errConcluir.custo_mao_obra ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="0,00" value={concluirForm.custo_mao_obra} onChange={(e) => setConcluir('custo_mao_obra', e.target.value)} />
                {errConcluir.custo_mao_obra && <p className="text-xs text-red-500 mt-1">{errConcluir.custo_mao_obra}</p>}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Medidor realizado (opcional)</Label>
                <Input type="number" min="0" step="0.01" className={`h-11 ${errConcluir.medidor_realizado ? 'border-red-400 focus-visible:ring-red-400' : ''}`} placeholder="km / horímetro" value={concluirForm.medidor_realizado} onChange={(e) => setConcluir('medidor_realizado', e.target.value)} />
                {errConcluir.medidor_realizado && <p className="text-xs text-red-500 mt-1">{errConcluir.medidor_realizado}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data realizada *</Label>
                <Input type="date" className={`h-11 ${errConcluir.data_realizada ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={concluirForm.data_realizada} onChange={(e) => setConcluir('data_realizada', e.target.value)} />
                {errConcluir.data_realizada && <p className="text-xs text-red-500 mt-1">{errConcluir.data_realizada}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Oficina</Label>
              <Input className="h-11" placeholder="Nome da oficina" value={concluirForm.oficina} onChange={(e) => setConcluir('oficina', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Observações</Label>
              <Textarea rows={3} placeholder="Observações da execução..." value={concluirForm.observacoes} onChange={(e) => setConcluir('observacoes', e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-gray-300 text-gray-700" onClick={() => setConcluirAlvo(null)}>Cancelar</Button>
            <Button className="bg-green-600 hover:bg-green-700" disabled={concluirMutation.isPending} onClick={salvarConclusao}>
              {concluirMutation.isPending ? 'Concluindo...' : 'Concluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
