import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, Clock, ArrowRight, CheckCircle, XCircle, Truck, FileText, ClipboardCheck, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { useEmpresa } from '@/components/shared/useEmpresaContext';
import VistoriaAtivoModal from '@/components/ativos/VistoriaAtivoModal';
import OrdemServicoModal from '@/components/ativos/OrdemServicoModal';
import AbastecimentoModal from '@/components/ativos/AbastecimentoModal';
import TransporteAtivoModal from '@/components/ativos/TransporteAtivoModal';
import { toast } from 'sonner';

const fmtBRL = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const hojeISO = () => new Date().toISOString().slice(0, 10);

const STATUS_CONFIG = {
  solicitado: { label: 'Solicitado', icon: Clock, cls: 'bg-amber-100 text-amber-700' },
  em_uso: { label: 'Em uso', icon: ArrowRight, cls: 'bg-blue-100 text-blue-700' },
  devolvido: { label: 'Devolvido', icon: CheckCircle, cls: 'bg-green-100 text-green-700' },
  rejeitado: { label: 'Rejeitado', icon: XCircle, cls: 'bg-red-100 text-red-700' },
};

const unidadeMedidor = (medidor_tipo) => (medidor_tipo === 'km' ? 'km' : 'h');

// Veículo vai dirigindo; só máquina/equipamento precisa de carona.
const precisaCarona = (e) => !/veiculo/.test(String(e?.ativo_tipo || ''));

// Qual transporte cabe agora: levar (ainda no pátio) ou buscar (obra encerrou o uso).
// No meio — máquina trabalhando na obra — não há transporte a fazer.
const sentidoTransporte = (e) => {
  if (!e) return null;
  if (e.devolucao_solicitada && !e.viagem_retorno_id) return 'RETORNO';
  if (!e.entregue_em && !e.viagem_id) return 'IDA';
  return null;
};
// Só ativo JÁ LIBERADO se move: solicitado ainda pode ser rejeitado pela Matriz.
const podeTransportar = (e) =>
  precisaCarona(e) && e?.status === 'em_uso' && !!sentidoTransporte(e);

// obraId + embedded: quando renderizado como aba de uma obra, filtra os empréstimos
// daquela obra e já trava a obra no formulário de solicitação (sem cabeçalho de página).
export default function EmprestimosAtivos({ obraId = null, embedded = false, podeSolicitar = true }) {
  const qc = useQueryClient();
  const { acessoGlobal } = useEmpresa();

  const [busca, setBusca] = useState('');

  const [solicitarModal, setSolicitarModal] = useState(false);
  const [formSolicitar, setFormSolicitar] = useState({
    ativo_id: '',
    obra_id: obraId || '',
    data_saida: hojeISO(),
    data_prevista_retorno: '',
    motivo: '',
  });
  // Erros do modal Solicitar Empréstimo (aviso inline + borda vermelha).
  const [errSolic, setErrSolic] = useState({});
  const clsSolic = (c) => (errSolic[c] ? 'border-red-400 focus-visible:ring-red-400' : '');
  const setSolic = (campo, valor) => {
    setFormSolicitar((f) => ({ ...f, [campo]: valor }));
    setErrSolic((e) => (e[campo] ? { ...e, [campo]: undefined } : e));
  };

  // Vistoria obrigatória nas duas pontas: liberar exige vistoria de SAÍDA, devolver
  // exige a de ENTRADA. O modal grava a vistoria e devolve o controle para cá.
  const [vistoriaModal, setVistoriaModal] = useState({ open: false, emp: null, tipo: 'SAIDA' });
  const [osModal, setOsModal] = useState({ open: false, id: null });
  // Abastecer direto da obra: o ativo já está em uso aqui, então o lançamento nasce
  // amarrado a este empréstimo e vai para aprovação da Matriz.
  const [abastecerModal, setAbastecerModal] = useState({ open: false, emp: null });
  // Máquina pesada não vai sozinha: viagem com caminhão + motorista até a obra.
  const [transporteModal, setTransporteModal] = useState({ open: false, emp: null });
  const aprovandoRef = useRef(null);   // empréstimo em liberação, p/ abrir a O.S. logo depois

  const [rejeitarModal, setRejeitarModal] = useState({ open: false, emp: null });
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [errRejeitar, setErrRejeitar] = useState('');

  const [devolverModal, setDevolverModal] = useState({ open: false, emp: null });
  const [medidorRetorno, setMedidorRetorno] = useState('');
  const [dataRetorno, setDataRetorno] = useState(hojeISO());
  const [errDevolver, setErrDevolver] = useState({});

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['emprestimos-ativos'],
    queryFn: () => base44.entities.EmprestimoAtivo.list('-created_date', 500),
  });

  const { data: ativos = [] } = useQuery({
    queryKey: ['ativos'],
    queryFn: () => base44.entities.Ativo.list('-created_date', 500),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list().catch(() => []),
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['emprestimos-ativos'] });
    qc.invalidateQueries({ queryKey: ['ativos'] });
  };

  const solicitarMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('solicitarEmprestimoAtivo', payload),
    onSuccess: (res) => {
      if (res.data?.success === false) {
        toast.error(res.data.error || 'Erro ao solicitar empréstimo.');
        return;
      }
      invalidar();
      toast.success('Empréstimo solicitado.');
      closeSolicitar();
    },
    onError: (e) => toast.error('Erro ao solicitar empréstimo: ' + (e?.message || e)),
  });

  const aprovarMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('aprovarEmprestimoAtivo', payload),
    onSuccess: (res) => {
      if (res.data?.success === false) {
        toast.error(res.data.error || 'Erro ao processar empréstimo.');
        return;
      }
      invalidar();
      const aprovado = res.data?.status === 'em_uso';
      // Liberou = emitiu a O.S.; já abre o comprovante para imprimir/assinar.
      if (aprovado && res.data?.os_numero) {
        toast.success(`Ativo liberado — O.S. ${res.data.os_numero} emitida.`);
        setOsModal({ open: true, id: res.data.emprestimo_id || aprovandoRef.current });
      } else {
        toast.success(aprovado ? 'Empréstimo aprovado.' : 'Empréstimo rejeitado.');
      }
      closeRejeitar();
    },
    onError: (e) => toast.error('Erro ao processar empréstimo: ' + (e?.message || e)),
  });

  // A obra sinaliza que terminou de usar — libera a viagem de volta.
  const encerrarUso = useMutation({
    mutationFn: (payload) => base44.functions.invoke('encerrarUsoAtivoObra', payload),
    onSuccess: (res) => {
      const d = res.data || {};
      if (d.success === false) { toast.error(d.error || 'Erro ao encerrar o uso.'); return; }
      invalidar();
      toast.success('Uso encerrado — a Matriz já pode programar a retirada.');
    },
    onError: (e) => toast.error('Erro: ' + (e?.response?.data?.error || e?.message || e)),
  });

  const devolverMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('devolverEmprestimoAtivo', payload),
    onSuccess: (res) => {
      if (res.data?.success === false) {
        toast.error(res.data.error || 'Erro ao devolver ativo.');
        return;
      }
      invalidar();
      toast.success('Devolvido — ' + fmtBRL(res.data?.custo_total) + ' rateado para a obra.');
      closeDevolver();
    },
    onError: (e) => toast.error('Erro ao devolver ativo: ' + (e?.message || e)),
  });

  // ---- opções dos pickers ----
  const ativosDisponiveis = useMemo(
    () => ativos.filter((a) => a.status === 'disponivel'),
    [ativos],
  );
  const ativoOptions = useMemo(
    () =>
      ativosDisponiveis.map((a) => ({
        value: a.id,
        label: `${a.nome || a.codigo || 'Ativo'}${a.tipo ? ` — ${a.tipo}` : ''}`,
      })),
    [ativosDisponiveis],
  );
  const obraOptions = useMemo(() => obras.map((o) => ({ value: o.id, label: o.nome })), [obras]);

  // Escopo: quando dentro de uma obra, só os empréstimos dela.
  const escopo = useMemo(
    () => (obraId ? emprestimos.filter((e) => e.obra_id === obraId) : emprestimos),
    [emprestimos, obraId],
  );

  // ---- filtro + paginação ----
  const filtered = useMemo(
    () =>
      escopo.filter((e) => {
        if (!busca) return true;
        const t = busca.toLowerCase();
        return (
          e.numero?.toLowerCase().includes(t) ||
          e.ativo_nome?.toLowerCase().includes(t) ||
          e.obra_nome?.toLowerCase().includes(t)
        );
      }),
    [escopo, busca],
  );
  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtered, 20);

  // ---- KPIs ----
  const totalSolicitados = escopo.filter((e) => e.status === 'solicitado').length;
  const totalEmUso = escopo.filter((e) => e.status === 'em_uso').length;
  const totalDevolvidos = escopo.filter((e) => e.status === 'devolvido').length;

  // ---- handlers modais ----
  const openSolicitar = () => {
    setFormSolicitar({ ativo_id: '', obra_id: obraId || '', data_saida: hojeISO(), data_prevista_retorno: '', motivo: '' });
    setErrSolic({});
    setSolicitarModal(true);
  };
  const closeSolicitar = () => { setErrSolic({}); setSolicitarModal(false); };

  // Liberar o ativo passa pela vistoria de saída — é ela que gera a prova do estado
  // em que o equipamento foi entregue e a assinatura de quem recebeu.
  const openVistoriaSaida = (emp) => setVistoriaModal({ open: true, emp, tipo: 'SAIDA' });
  const openVistoriaEntrada = (emp) => setVistoriaModal({ open: true, emp, tipo: 'ENTRADA' });
  const closeVistoria = () => setVistoriaModal({ open: false, emp: null, tipo: 'SAIDA' });

  const openRejeitar = (emp) => {
    setMotivoRejeicao('');
    setErrRejeitar('');
    setRejeitarModal({ open: true, emp });
  };
  const closeRejeitar = () => { setErrRejeitar(''); setRejeitarModal({ open: false, emp: null }); };

  const closeDevolver = () => { setErrDevolver({}); setDevolverModal({ open: false, emp: null }); };

  const confirmarSolicitar = () => {
    const e = {};
    if (!formSolicitar.ativo_id) e.ativo_id = 'Selecione o ativo.';
    if (!formSolicitar.obra_id) e.obra_id = 'Selecione a obra.';
    if (formSolicitar.data_saida && formSolicitar.data_prevista_retorno && formSolicitar.data_prevista_retorno < formSolicitar.data_saida) {
      e.data_prevista_retorno = 'O retorno não pode ser antes da saída.';
    }
    if (Object.keys(e).length) {
      setErrSolic(e);
      toast.error('Verifique os campos destacados.');
      return;
    }
    setErrSolic({});
    solicitarMutation.mutate({
      ativo_id: formSolicitar.ativo_id,
      obra_id: formSolicitar.obra_id,
      data_saida: formSolicitar.data_saida || undefined,
      data_prevista_retorno: formSolicitar.data_prevista_retorno || undefined,
      motivo: formSolicitar.motivo || undefined,
    });
  };

  // Cria a viagem do transporte escolhido na vistoria. Falhar aqui não desfaz a
  // vistoria nem a liberação — avisa e segue, a viagem pode ser criada depois.
  const criarViagemDoTransporte = async (emp, transporte, sentido) => {
    if (!transporte) return;
    try {
      const r = await base44.functions.invoke('iniciarViagemTransporteAtivo', {
        emprestimo_id: emp.id, sentido, ...transporte,
      });
      const d = r?.data || {};
      if (d.success === false) toast.warning('Vistoria registrada, mas a viagem não pôde ser criada: ' + d.error);
      else toast.success(`Viagem ${d.numero} criada — o motorista já vê em Viagens de Entrega.`);
      invalidar();
    } catch (e) {
      toast.warning('Vistoria registrada, mas a viagem não pôde ser criada.');
    }
  };

  // Vistoria gravada → segue o rito: saída libera (emite a O.S.), entrada devolve.
  const aposVistoria = async (res) => {
    const emp = vistoriaModal.emp;
    const tipo = vistoriaModal.tipo;
    closeVistoria();
    if (!emp) return;
    if (tipo === 'SAIDA') {
      aprovandoRef.current = emp.id;
      // Libera primeiro (o transporte exige empréstimo já liberado), depois cria a viagem.
      await aprovarMutation.mutateAsync({ emprestimo_id: emp.id, aprovar: true }).catch(() => null);
      await criarViagemDoTransporte(emp, res?.transporte, 'IDA');
    } else {
      // Na volta a viagem nasce ANTES da devolução: devolver encerra o empréstimo, e
      // depois disso o backend (com razão) não aceita mais criar transporte para ele.
      await criarViagemDoTransporte(emp, res?.transporte, 'RETORNO');
      // O medidor da vistoria é o que vale; a data de retorno se confirma no modal.
      setMedidorRetorno(String(res?.medidor ?? ''));
      setDataRetorno(hojeISO());
      setDevolverModal({ open: true, emp });
    }
  };

  const confirmarRejeitar = () => {
    const emp = rejeitarModal.emp;
    if (!emp) return;
    if (!motivoRejeicao.trim()) {
      setErrRejeitar('Informe o motivo da rejeição.');
      toast.error('Verifique os campos destacados.');
      return;
    }
    aprovarMutation.mutate({
      emprestimo_id: emp.id,
      aprovar: false,
      motivo_rejeicao: motivoRejeicao.trim(),
    });
  };

  const confirmarDevolver = () => {
    const emp = devolverModal.emp;
    if (!emp) return;

    const e = {};
    // Cobrança por diária não usa medidor; só exige leitura para hora/km.
    if (emp.tarifa_tipo !== 'dia') {
      if (medidorRetorno === '') e.medidor = 'Informe o medidor de retorno.';
      // Custo = (retorno − saída) × tarifa: retorno menor gera custo NEGATIVO na obra.
      else if (Number(medidorRetorno) < Number(emp.medidor_saida || 0)) {
        e.medidor = `O medidor não pode ser menor que o da saída (${Number(emp.medidor_saida || 0)}).`;
      }
    }
    if (!dataRetorno) e.data = 'Informe a data de retorno.';
    else if (dataRetorno > hojeISO()) e.data = 'A data de retorno não pode ser futura.';
    else if (emp.data_saida && dataRetorno < String(emp.data_saida).slice(0, 10)) {
      e.data = 'O retorno não pode ser anterior à saída.';
    }

    if (Object.keys(e).length) { setErrDevolver(e); toast.error('Verifique os campos destacados.'); return; }

    devolverMutation.mutate({
      emprestimo_id: emp.id,
      medidor_retorno: medidorRetorno === '' ? 0 : Number(medidorRetorno),
      data_retorno: dataRetorno || undefined,
    });
  };

  // preview do custo na devolução
  const devEmp = devolverModal.emp;
  const custoPreview = useMemo(() => {
    if (!devEmp) return null;
    if (devEmp.tarifa_tipo === 'dia') return 'cobrado por diária';
    const uso = Number(medidorRetorno || 0) - Number(devEmp.medidor_saida || 0);
    return fmtBRL(uso * Number(devEmp.tarifa_valor || 0));
  }, [devEmp, medidorRetorno]);

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {embedded ? (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Veículos & Ativos</h2>
            <p className="text-sm text-gray-500 mt-0.5">{escopo.length} empréstimo(s) desta obra</p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Empréstimo de Ativos</h1>
            <p className="text-sm text-gray-500 mt-1">{escopo.length} empréstimo(s) no total</p>
          </div>
        )}
        {podeSolicitar && (
          <Button onClick={openSolicitar} className="w-full sm:w-auto gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Solicitar Empréstimo
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Solicitados</p>
          <p className="text-lg sm:text-2xl font-bold text-amber-600 mt-1 tabular-nums">{totalSolicitados}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Em uso</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-1 tabular-nums">{totalEmUso}</p>
        </Card>
        <Card className="bg-white border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Devolvidos</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600 mt-1 tabular-nums">{totalDevolvidos}</p>
        </Card>
      </div>

      {/* Busca */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="relative sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9 h-11"
              placeholder="Buscar por número, ativo ou obra..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={6} />
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-400">Nenhum empréstimo encontrado.</p>
              {podeSolicitar && (
                <Button variant="outline" size="sm" className="mt-3 border-gray-300 text-gray-700" onClick={openSolicitar}>
                  Solicitar primeiro empréstimo
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Cards mobile */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {pageItens.map((e) => {
                  const stCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.solicitado;
                  const StatusIcon = stCfg.icon;
                  const un = unidadeMedidor(e.medidor_tipo);
                  const temSaida = e.medidor_saida != null && e.medidor_saida !== '';
                  return (
                    <div key={e.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{e.ativo_nome || '—'}{e.ativo_tipo && <span className="text-gray-400 font-normal"> · {e.ativo_tipo}</span>}</p>
                          <p className="text-xs text-gray-500">{e.numero || '—'}{e.obra_nome ? ` · ${e.obra_nome}` : ''}</p>
                        </div>
                        <Badge className={`gap-1 flex-shrink-0 ${stCfg.cls}`}><StatusIcon className="w-3 h-3" />{stCfg.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-600">
                        <span>{temSaida ? <>{e.medidor_saida}{e.status === 'devolvido' && e.medidor_retorno != null && <span className="text-gray-800"> → {e.medidor_retorno}</span>}<span className="text-gray-400"> {un}</span></> : '—'}</span>
                        <span className="text-gray-700">{e.status === 'devolvido' ? fmtBRL(e.custo_total) : ''}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end pt-1 border-t border-gray-100">
                        {e.status === 'solicitado' && (acessoGlobal ? (
                          <>
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-green-600 border-green-300 hover:bg-green-50" onClick={() => openVistoriaSaida(e)}><ClipboardCheck className="w-3.5 h-3.5" />Vistoriar e liberar</Button>
                            <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-300 hover:bg-red-50" onClick={() => openRejeitar(e)}>Rejeitar</Button>
                          </>
                        ) : <span className="text-xs text-gray-400 italic">aguardando Matriz</span>)}
                        {e.status === 'em_uso' && (
                          <>
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setAbastecerModal({ open: true, emp: e })}><Fuel className="w-3.5 h-3.5" />Abastecer</Button>
                            <Button variant="outline" size="sm" className="h-8 gap-1 text-blue-600 border-blue-300 hover:bg-blue-50" onClick={() => openVistoriaEntrada(e)}><ClipboardCheck className="w-3.5 h-3.5" />Vistoriar e devolver</Button>
                          </>
                        )}
                        {['em_uso', 'devolvido'].includes(e.status) && (
                          <Button variant="outline" size="sm" className="h-8 gap-1 text-gray-600 border-gray-300" onClick={() => setOsModal({ open: true, id: e.id })}><FileText className="w-3.5 h-3.5" />{e.os_numero || 'Ver O.S.'}</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Número</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Ativo</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Medidor</th>
                      <th className="text-left p-3 text-xs font-semibold text-gray-500">Custo</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pageItens.map((e) => {
                      const stCfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.solicitado;
                      const StatusIcon = stCfg.icon;
                      const un = unidadeMedidor(e.medidor_tipo);
                      const temSaida = e.medidor_saida != null && e.medidor_saida !== '';
                      return (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{e.numero || '—'}</td>
                          <td className="p-3 text-gray-700">
                            {e.ativo_nome || '—'}
                            {e.ativo_tipo && <span className="text-gray-400"> · {e.ativo_tipo}</span>}
                          </td>
                          <td className="p-3 text-gray-600">{e.obra_nome || '—'}</td>
                          <td className="p-3">
                            <Badge className={`gap-1 ${stCfg.cls}`}>
                              <StatusIcon className="w-3 h-3" />
                              {stCfg.label}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-600 whitespace-nowrap">
                            {temSaida ? (
                              <>
                                {e.medidor_saida}
                                {e.status === 'devolvido' && e.medidor_retorno != null && (
                                  <span className="text-gray-800"> → {e.medidor_retorno}</span>
                                )}
                                <span className="text-gray-400"> {un}</span>
                              </>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="p-3 text-gray-700 whitespace-nowrap">
                            {e.status === 'devolvido' ? fmtBRL(e.custo_total) : '—'}
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {e.status === 'solicitado' &&
                                (acessoGlobal ? (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                      onClick={() => openVistoriaSaida(e)}
                                    >
                                      <ClipboardCheck className="w-3.5 h-3.5" />
                                      Vistoriar e liberar
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="text-red-600 border-red-300 hover:bg-red-50"
                                      onClick={() => openRejeitar(e)}
                                    >
                                      Rejeitar
                                    </Button>
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">aguardando Matriz</span>
                                ))}
                              {/* Transporte e devolução vivem DENTRO da vistoria agora. */}
                              {(e.viagem_retorno_numero || e.viagem_numero) && (
                                <span className="text-xs text-gray-400 self-center" title="Viagens deste empréstimo">
                                  {e.viagem_retorno_numero || e.viagem_numero}
                                </span>
                              )}
                              {/* Enquanto o ativo está na obra, é aqui que se lança o
                                  abastecimento — quem abastece está no campo, não na Matriz. */}
                              {e.status === 'em_uso' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-amber-700 border-amber-300 hover:bg-amber-50"
                                  onClick={() => setAbastecerModal({ open: true, emp: e })}
                                  title="Registrar abastecimento deste veículo/máquina"
                                >
                                  <Fuel className="w-3.5 h-3.5" />
                                  Abastecer
                                </Button>
                              )}
                              {e.status === 'em_uso' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => openVistoriaEntrada(e)}
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5" />
                                  Vistoriar e devolver
                                </Button>
                              )}
                              {/* A O.S. é o comprovante do empréstimo — fica sempre à mão.
                                  Aparece mesmo sem número: empréstimo liberado ANTES de a
                                  O.S. existir não tem numeração, mas o documento (ativo,
                                  obra, período, medidores, vistorias) continua valendo. */}
                              {['em_uso', 'devolvido'].includes(e.status) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-gray-600 border-gray-300"
                                  onClick={() => setOsModal({ open: true, id: e.id })}
                                  title={e.os_numero ? 'Ver ordem de serviço' : 'Ver documento do empréstimo (sem O.S. numerada)'}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {e.os_numero || 'Ver O.S.'}
                                </Button>
                              )}
                              {e.status === 'rejeitado' && e.motivo_rejeicao && (
                                <span className="text-xs text-gray-400 italic" title={e.motivo_rejeicao}>
                                  motivo registrado
                                </span>
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

      {/* Modal: Solicitar Empréstimo */}
      <Dialog open={solicitarModal} onOpenChange={(o) => !o && closeSolicitar()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar Empréstimo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Ativo (disponível) *</Label>
              <ComboboxBusca
                options={ativoOptions}
                value={formSolicitar.ativo_id}
                onSelect={(v) => setSolic('ativo_id', v)}
                placeholder="Selecione o ativo"
                searchPlaceholder="Buscar ativo..."
                emptyMessage="Nenhum ativo disponível"
                className={clsSolic('ativo_id')}
              />
              {errSolic.ativo_id && <p className="text-xs text-red-600 mt-1">{errSolic.ativo_id}</p>}
            </div>
            {!obraId && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Obra *</Label>
                <ComboboxBusca
                  options={obraOptions}
                  value={formSolicitar.obra_id}
                  onSelect={(v) => setSolic('obra_id', v)}
                  placeholder="Selecione a obra"
                  searchPlaceholder="Buscar obra..."
                  emptyMessage="Nenhuma obra encontrada"
                  className={clsSolic('obra_id')}
                />
                {errSolic.obra_id && <p className="text-xs text-red-600 mt-1">{errSolic.obra_id}</p>}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Data de saída</Label>
                <Input
                  type="date"
                  value={formSolicitar.data_saida}
                  onChange={(e) => setFormSolicitar((f) => ({ ...f, data_saida: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Retorno previsto</Label>
                <Input
                  type="date"
                  value={formSolicitar.data_prevista_retorno}
                  onChange={(e) => setSolic('data_prevista_retorno', e.target.value)}
                  className={clsSolic('data_prevista_retorno')}
                />
                {errSolic.data_prevista_retorno && <p className="text-xs text-red-600 mt-1">{errSolic.data_prevista_retorno}</p>}
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motivo</Label>
              <Textarea
                rows={3}
                placeholder="Descreva o motivo do empréstimo..."
                value={formSolicitar.motivo}
                onChange={(e) => setFormSolicitar((f) => ({ ...f, motivo: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeSolicitar}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={confirmarSolicitar}
              disabled={solicitarMutation.isPending}
            >
              {solicitarMutation.isPending ? 'Enviando...' : 'Solicitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vistoria (saída e devolução) — obrigatória nas duas pontas */}
      <VistoriaAtivoModal
        open={vistoriaModal.open}
        emprestimo={vistoriaModal.emp}
        tipo={vistoriaModal.tipo}
        onClose={closeVistoria}
        onConcluido={aposVistoria}
      />

      {/* Abastecimento lançado da obra — o ativo já é o do empréstimo */}
      <AbastecimentoModal
        open={abastecerModal.open}
        onClose={() => setAbastecerModal({ open: false, emp: null })}
        obraId={abastecerModal.emp?.obra_id || null}
        // Só identifica QUAL ativo; o medidor atual o próprio modal lê do cadastro
        // (o do empréstimo é a leitura da saída e já nasce velha).
        ativoFixo={abastecerModal.emp ? {
          id: abastecerModal.emp.ativo_id,
          nome: abastecerModal.emp.ativo_nome,
          tipo: abastecerModal.emp.ativo_tipo,
        } : null}
      />

      {/* Transporte da máquina até a obra (caminhão + motorista) */}
      <TransporteAtivoModal
        open={transporteModal.open}
        emprestimo={transporteModal.emp}
        sentido={transporteModal.sentido}
        onClose={() => setTransporteModal({ open: false, emp: null })}
      />

      {/* Ordem de serviço — comprovante do empréstimo */}
      <OrdemServicoModal
        open={osModal.open}
        emprestimoId={osModal.id}
        onClose={() => setOsModal({ open: false, id: null })}
      />

      {/* Modal: Rejeitar */}
      <Dialog open={rejeitarModal.open} onOpenChange={(o) => !o && closeRejeitar()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar Empréstimo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              {rejeitarModal.emp?.ativo_nome} · {rejeitarModal.emp?.obra_nome}
            </p>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Motivo da rejeição *</Label>
              <Textarea
                rows={3}
                placeholder="Informe o motivo..."
                value={motivoRejeicao}
                onChange={(e) => { setMotivoRejeicao(e.target.value); if (errRejeitar) setErrRejeitar(''); }}
                className={errRejeitar ? 'border-red-400 focus-visible:ring-red-400' : ''}
              />
              {errRejeitar && <p className="text-xs text-red-500 mt-1">{errRejeitar}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRejeitar}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmarRejeitar}
              disabled={aprovarMutation.isPending}
            >
              {aprovarMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Devolver */}
      <Dialog open={devolverModal.open} onOpenChange={(o) => !o && closeDevolver()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver Ativo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              {devEmp?.ativo_nome} · {devEmp?.obra_nome}
              {devEmp?.medidor_saida != null && (
                <span className="block text-xs text-gray-400 mt-1">
                  Medidor de saída: {devEmp.medidor_saida} {unidadeMedidor(devEmp.medidor_tipo)}
                </span>
              )}
            </p>
            {devEmp?.tarifa_tipo !== 'dia' && (
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">
                  Medidor de retorno ({unidadeMedidor(devEmp?.medidor_tipo)})
                </Label>
                {/* Leitura conferida na vistoria — não se digita de novo aqui. */}
                <Input type="number" value={medidorRetorno} readOnly className={`bg-gray-50 ${errDevolver.medidor ? 'border-red-400' : ''}`} />
                {errDevolver.medidor
                  ? <p className="text-xs text-red-500 mt-1">{errDevolver.medidor}</p>
                  : <p className="text-xs text-gray-400 mt-1">Conferido na vistoria de devolução.</p>}
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Data de retorno *</Label>
              <Input type="date" value={dataRetorno} onChange={(e) => { setDataRetorno(e.target.value); setErrDevolver((p) => ({ ...p, data: null })); }}
                className={errDevolver.data ? 'border-red-400 focus-visible:ring-red-400' : ''} />
              {errDevolver.data && <p className="text-xs text-red-500 mt-1">{errDevolver.data}</p>}
            </div>
            {custoPreview != null && (
              <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm">
                <span className="text-gray-500">Custo rateado para a obra: </span>
                <span className="font-semibold text-gray-900">{custoPreview}</span>
                {/* Deixa explícito que não nasce dívida: o ativo é do próprio grupo. */}
                <p className="text-xs text-gray-400 mt-1">
                  Entra como custo de equipamento na DRE da obra. Não gera conta a pagar — o ativo é do grupo.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDevolver}>
              Cancelar
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={confirmarDevolver}
              disabled={devolverMutation.isPending}
            >
              {devolverMutation.isPending ? 'Devolvendo...' : 'Confirmar Devolução'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
