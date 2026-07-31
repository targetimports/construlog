import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { Plus, Check, Receipt, CalendarPlus, Mail, MailCheck, MessageCircle, FileText, RefreshCw, Copy, ExternalLink } from 'lucide-react';
import { CabecalhoPagina, fmtBRL, fmtData, hojeISO } from '@/components/painel/ui';
import { toast } from 'sonner';

// COBRANÇAS — controle manual das mensalidades.
//
// O painel não emite boleto nem fala com gateway: registra o que foi cobrado e
// quando entrou. A baixa é manual (Pix, transferência, boleto pago por fora).
// Toda a regra de dinheiro vive aqui, para plugar um gateway depois sem mexer
// no resto do painel.

const hoje = hojeISO;

/** Pendente com vencimento passado é atraso — o status "vencido" é derivado, não gravado. */
const situacao = (c) => {
  if (c.status === 'pago') return 'pago';
  if (c.status === 'cancelado') return 'cancelado';
  return (c.vencimento || '') < hoje() ? 'vencido' : 'pendente';
};

const SIT = {
  pago: { label: 'Pago', cls: 'bg-emerald-100 text-emerald-800' },
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-800' },
  vencido: { label: 'Vencido', cls: 'bg-red-100 text-red-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
};

const competenciaAtual = () => new Date().toISOString().slice(0, 7);

/** "2026-07" → "julho/2026", para a competência não virar código na tela. */
const rotuloCompetencia = (comp) => {
  if (!/^\d{4}-\d{2}$/.test(comp || '')) return comp || '—';
  const [ano, mes] = comp.split('-');
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${nomes[Number(mes) - 1]}/${ano}`;
};

// Os canais de cobrança, do ponto de vista da tela. Os nomes de campo espelham
// o que o backend grava por canal (backend/src/cobrancaAviso.js).
const CANAIS_UI = [
  {
    chave: 'email', rotulo: 'E-mail', icone: MailCheck,
    chaveCliente: 'cobranca_email', campoDestino: 'email',
    campoPrevio: 'lembrete_enviado_em', campoAtraso: 'ultimo_aviso_atraso', campoContagem: 'avisos_atraso',
  },
  {
    chave: 'whatsapp', rotulo: 'WhatsApp', icone: MessageCircle,
    chaveCliente: 'cobranca_whatsapp', campoDestino: 'telefone',
    campoPrevio: 'lembrete_zap_em', campoAtraso: 'ultimo_zap_atraso', campoContagem: 'zaps_atraso',
  },
];

// Motivos que o backend devolve ao recusar o envio do aviso, em português.
const MOTIVO_AVISO = {
  email_nao_configurado: 'O e-mail (SMTP) não está configurado em Sistema › Integrações externas.',
  whatsapp_nao_configurado: 'O WhatsApp não está configurado em Sistema › Integrações externas.',
  nenhum_canal_configurado: 'Nenhum canal de envio configurado em Sistema › Integrações externas.',
  aviso_desligado: 'Os avisos estão desligados no cadastro deste cliente.',
  cliente_sem_destino: 'O cliente não tem o contato cadastrado para este canal.',
  cliente_sem_email: 'O cliente não tem e-mail cadastrado.',
  telefone_invalido: 'O telefone do cliente não está num formato válido.',
  cobranca_nao_encontrada: 'Cobrança não encontrada.',
  cliente_nao_encontrado: 'Cliente não encontrado.',
  ja_paga: 'Esta cobrança já está paga.',
  cancelada: 'Esta cobrança está cancelada.',
};

const NOME_CANAL = { email: 'e-mail', whatsapp: 'WhatsApp' };

// Recusas do módulo de pagamento, em português.
const MOTIVO_PAGAMENTO = {
  modo_manual: 'A Asaas não está configurada em Sistema › Integrações externas.',
  nao_emitida: 'Esta cobrança ainda não foi emitida na Asaas.',
  ja_paga: 'Esta cobrança já está paga.',
  cancelada: 'Esta cobrança está cancelada.',
  cobranca_nao_encontrada: 'Cobrança não encontrada.',
  cliente_nao_encontrado: 'Cliente não encontrado.',
};

// Quem entra na geração em lote e, principalmente, POR QUE alguém fica de fora.
// Antes o lote só olhava status === 'ativo' e, sem ninguém elegível, dizia "já
// estavam lançadas" — mentia sobre a causa. Agora cada exclusão tem motivo e
// aparece na tela antes de gravar qualquer coisa.
const MOTIVOS = {
  cancelado: 'Contrato cancelado',
  suspenso: 'Contrato suspenso',
  teste: 'Em teste (marque a opção abaixo para incluir)',
  ja_lancada: 'Já tem cobrança nesta competência',
  sem_valor: 'Sem mensalidade definida no cadastro',
};

export default function PainelCobrancas() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState('todas');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ cliente_id: '', competencia: competenciaAtual(), vencimento: '', valor: '', observacoes: '' });
  const [errors, setErrors] = useState({});
  const [lote, setLote] = useState(false); // tela de conferência da geração em lote
  const [compLote, setCompLote] = useState(competenciaAtual());
  const [incluirTeste, setIncluirTeste] = useState(false);
  const [avisandoId, setAvisandoId] = useState(null); // cobrança tendo o aviso enviado
  const [emitindoId, setEmitindoId] = useState(null); // cobrança sendo emitida na Asaas
  const [meios, setMeios] = useState(null); // { cobranca, url_fatura, linha_digitavel, pix_copia_e_cola }
  const [baixa, setBaixa] = useState(null); // cobrança em baixa
  const [pagamento, setPagamento] = useState({ data_pagamento: hoje(), forma: 'pix' });
  const [errBaixa, setErrBaixa] = useState({});

  const { data: cobrancas = [], isLoading } = useQuery({
    queryKey: ['cobrancas-saas'],
    queryFn: () => base44.entities.Cobranca.list('-vencimento', 1000).catch(() => []),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('nome', 500).catch(() => []),
  });

  const nomeCliente = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const criar = useMutation({
    mutationFn: (d) => base44.entities.Cobranca.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      toast.success('Cobrança lançada!');
      setModal(false);
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const darBaixa = useMutation({
    mutationFn: ({ id, dados }) => base44.entities.Cobranca.update(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      toast.success('Pagamento registrado!');
      setBaixa(null);
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  // PRÉVIA DA GERAÇÃO EM LOTE — classifica cada cliente antes de gravar.
  // É o que a tela de conferência mostra; nada é criado até confirmar.
  const previa = useMemo(() => {
    const jaTem = new Set(
      cobrancas.filter((c) => c.competencia === compLote && c.status !== 'cancelado').map((c) => c.cliente_id),
    );

    const gerar = [];
    const fora = [];

    for (const c of clientes) {
      const valor = Number(c.valor_mensal) || 0;
      const dia = String(Math.min(28, Number(c.dia_vencimento) || 10)).padStart(2, '0');

      let motivo = null;
      if (c.status === 'cancelado') motivo = 'cancelado';
      else if (c.status === 'suspenso') motivo = 'suspenso';
      else if (c.status === 'teste' && !incluirTeste) motivo = 'teste';
      else if (jaTem.has(c.id)) motivo = 'ja_lancada';
      else if (valor <= 0) motivo = 'sem_valor';

      if (motivo) fora.push({ cliente: c, motivo });
      else gerar.push({ cliente: c, valor, vencimento: `${compLote}-${dia}` });
    }

    return { gerar, fora, total: gerar.reduce((s, g) => s + g.valor, 0) };
  }, [clientes, cobrancas, compLote, incluirTeste]);

  const gerarMes = useMutation({
    mutationFn: async () => {
      for (const g of previa.gerar) {
        await base44.entities.Cobranca.create({
          cliente_id: g.cliente.id,
          cliente_nome: g.cliente.nome,
          competencia: compLote,
          vencimento: g.vencimento,
          valor: g.valor,
          status: 'pendente',
        });
      }
      return previa.gerar.length;
    },
    onSuccess: (criadas) => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      toast.success(`${criadas} cobrança(s) gerada(s) para ${rotuloCompetencia(compLote)}.`);
      setLote(false);
    },
    onError: (e) => toast.error('Erro ao gerar: ' + (e?.message || 'tente novamente')),
  });

  const abrirLote = () => { setCompLote(competenciaAtual()); setIncluirTeste(false); setLote(true); };

  // PAGAMENTO ONLINE (Asaas) — a tela se adapta ao que está configurado.
  //
  // Sem chave da Asaas o modo é "manual" e nada disso aparece: mostrar "Emitir
  // boleto" num painel que não fala com gateway nenhum seria prometer o que o
  // sistema não faz. Quando a chave entrar em Integrações externas, os botões
  // surgem sozinhos — sem release, sem ajuste de código.
  const { data: modoPagamento } = useQuery({
    queryKey: ['modo-pagamento'],
    queryFn: () => base44.api('/pagamentos/status').catch(() => ({ modo: 'manual' })),
    staleTime: 60_000,
  });
  const asaasLigada = modoPagamento?.modo === 'asaas';

  const emitir = useMutation({
    mutationFn: (id) => base44.api(`/pagamentos/cobrancas/${id}/emitir`, { method: 'POST', body: {} }),
    onMutate: (id) => setEmitindoId(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      if (r?.ok) toast.success(r.jaEmitida ? 'Esta cobrança já estava emitida.' : 'Cobrança emitida na Asaas.');
      else toast.error(MOTIVO_PAGAMENTO[r?.motivo] || r?.motivo || 'Não foi possível emitir.');
    },
    onError: (e) => toast.error('Falha ao emitir: ' + (e?.message || 'tente novamente')),
    onSettled: () => setEmitindoId(null),
  });

  const conciliar = useMutation({
    mutationFn: () => base44.api('/pagamentos/conciliar', { method: 'POST' }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      if (!r?.ok) { toast.error(MOTIVO_PAGAMENTO[r?.motivo] || 'Conciliação indisponível.'); return; }
      toast.success(r.baixadas
        ? `${r.baixadas} pagamento(s) encontrado(s) e baixado(s).`
        : `Nenhum pagamento novo (${r.verificadas} cobrança(s) conferida(s)).`);
    },
    onError: (e) => toast.error('Falha ao conciliar: ' + (e?.message || 'tente novamente')),
  });

  /** Abre boleto/Pix da cobrança para mandar ao cliente. */
  const verMeios = async (c) => {
    try {
      const r = await base44.api(`/pagamentos/cobrancas/${c.id}/meios`);
      if (!r?.ok) { toast.error(MOTIVO_PAGAMENTO[r?.motivo] || 'Meios de pagamento indisponíveis.'); return; }
      setMeios({ cobranca: c, ...r });
    } catch (e) {
      toast.error('Erro: ' + (e?.message || 'tente novamente'));
    }
  };

  // AVISO DE VENCIMENTO — o envio automático sai do agendador do backend (3 dias
  // antes). Este botão é o disparo manual, para quando o operador quer mandar na
  // hora. O backend respeita a chave do cliente nos dois caminhos.
  const clientePorId = useMemo(
    () => Object.fromEntries(clientes.map((c) => [c.id, c])),
    [clientes],
  );

  const podeAvisar = (c) => {
    const cli = clientePorId[c.cliente_id];
    return (!!cli?.cobranca_email && !!cli?.email) || (!!cli?.cobranca_whatsapp && !!cli?.telefone);
  };

  const avisar = useMutation({
    mutationFn: (id) => base44.api(`/pagamentos/cobrancas/${id}/avisar`, { method: 'POST' }),
    onMutate: (id) => setAvisandoId(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['cobrancas-saas'] });
      if (r?.ok) {
        const canais = (r.enviados || []).map((c) => NOME_CANAL[c] || c).join(' e ');
        toast.success(`${r.vencida ? 'Cobrança' : 'Lembrete'} enviado por ${canais}.`);
        // Um canal pode ter falhado enquanto o outro saiu — avisa sem esconder.
        const falhou = (r.resultados || []).filter((x) => !x.ok);
        falhou.forEach((f) => toast.warning(
          `${NOME_CANAL[f.canal] || f.canal}: ${MOTIVO_AVISO[f.motivo] || f.motivo}`,
        ));
      } else {
        toast.error(MOTIVO_AVISO[r?.motivo] || r?.motivo || 'Não foi possível enviar o aviso.');
      }
    },
    onError: (e) => toast.error('Falha ao enviar: ' + (e?.message || 'tente novamente')),
    onSettled: () => setAvisandoId(null),
  });

  // Estado de UM canal na linha: enviado quando, quantas vezes, ou por que não.
  const estadoCanal = (c, cli, cfg) => {
    const ligado = !!cli?.[cfg.chaveCliente];
    const destino = cli?.[cfg.campoDestino];
    const Icone = cfg.icone;

    if (!ligado) return null; // canal que o cliente não aceita não polui a linha

    const atraso = c[cfg.campoAtraso];
    const previo = c[cfg.campoPrevio];
    const contagem = Number(c[cfg.campoContagem] || 0);

    let texto; let cor; let corIcone;
    if (atraso) {
      const hojeMesmo = String(atraso).slice(0, 10) === hoje();
      texto = hojeMesmo ? 'hoje' : fmtData(atraso);
      cor = hojeMesmo ? 'text-gray-600' : 'text-amber-600';
      corIcone = hojeMesmo ? 'text-emerald-600' : 'text-amber-500';
    } else if (previo) {
      texto = fmtData(previo);
      cor = 'text-gray-600';
      corIcone = 'text-emerald-600';
    } else if (!destino) {
      texto = 'sem contato';
      cor = 'text-amber-600';
      corIcone = 'text-amber-500';
    } else {
      texto = 'a enviar';
      cor = 'text-gray-400';
      corIcone = 'text-gray-300';
    }

    return (
      <span
        key={cfg.chave}
        className={`inline-flex items-center gap-1 text-xs ${cor}`}
        title={`${cfg.rotulo}${destino ? ` — ${destino}` : ''}${contagem > 1 ? ` · ${contagem} cobranças de atraso` : ''}`}
      >
        <Icone className={`w-3.5 h-3.5 ${corIcone}`} />
        {texto}
        {contagem > 1 && <span className="text-gray-400">({contagem}×)</span>}
      </span>
    );
  };

  /** Estado dos avisos na linha da tabela, um por canal aceito pelo cliente. */
  const avisoDaCobranca = (c) => {
    if (c.status === 'pago' || c.status === 'cancelado') return <span className="text-xs text-gray-300">—</span>;

    const cli = clientePorId[c.cliente_id];
    const linhas = CANAIS_UI.map((cfg) => estadoCanal(c, cli, cfg)).filter(Boolean);

    if (!linhas.length) {
      return <span className="text-xs text-gray-400" title="Ligue os avisos no cadastro do cliente">desligado</span>;
    }
    return <div className="flex flex-col gap-0.5">{linhas}</div>;
  };

  const validar = () => {
    const e = {};
    if (!form.cliente_id) e.cliente_id = 'Selecione o cliente';
    if (!/^\d{4}-\d{2}$/.test(form.competencia || '')) e.competencia = 'Use o formato AAAA-MM';
    if (!form.vencimento) e.vencimento = 'Informe o vencimento';
    if (!(Number(form.valor) > 0)) e.valor = 'Informe um valor maior que zero';

    // Duas cobranças do mesmo mês para o mesmo cliente = cobrança em dobro.
    if (form.cliente_id && form.competencia) {
      const dup = cobrancas.some(
        (c) => c.cliente_id === form.cliente_id && c.competencia === form.competencia && c.status !== 'cancelado',
      );
      if (dup) e.competencia = 'Este cliente já tem cobrança nesta competência';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const abrirNova = () => {
    setForm({ cliente_id: '', competencia: competenciaAtual(), vencimento: '', valor: '', observacoes: '' });
    setErrors({});
    setModal(true);
  };

  // Escolher o cliente já traz mensalidade e vencimento do contrato.
  const escolherCliente = (id) => {
    const c = clientes.find((x) => x.id === id);
    setForm((f) => {
      const comp = f.competencia || competenciaAtual();
      const dia = String(Math.min(28, Number(c?.dia_vencimento) || 10)).padStart(2, '0');
      return {
        ...f,
        cliente_id: id,
        valor: c?.valor_mensal != null ? String(c.valor_mensal) : f.valor,
        vencimento: f.vencimento || `${comp}-${dia}`,
      };
    });
    setErrors((e) => ({ ...e, cliente_id: null }));
  };

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    criar.mutate({
      ...form,
      cliente_nome: nomeCliente[form.cliente_id] || '',
      valor: Number(form.valor),
      status: 'pendente',
    });
  };

  const confirmarBaixa = () => {
    const e = {};
    if (!pagamento.data_pagamento) e.data = 'Informe a data do pagamento';
    else if (pagamento.data_pagamento > hoje()) e.data = 'A data não pode ser futura';
    setErrBaixa(e);
    if (Object.keys(e).length) { toast.error('Verifique os campos destacados.'); return; }

    darBaixa.mutate({
      id: baixa.id,
      dados: { ...baixa, status: 'pago', data_pagamento: pagamento.data_pagamento, forma_pagamento: pagamento.forma },
    });
  };

  const filtradas = useMemo(() => {
    if (filtro === 'todas') return cobrancas;
    return cobrancas.filter((c) => situacao(c) === filtro);
  }, [cobrancas, filtro]);

  const pag = usePagination(filtradas, 15);

  const kpis = useMemo(() => {
    const comp = competenciaAtual();
    const doMes = cobrancas.filter((c) => c.competencia === comp);
    return {
      recebidoMes: doMes.filter((c) => c.status === 'pago').reduce((s, c) => s + (Number(c.valor) || 0), 0),
      aReceberMes: doMes.filter((c) => situacao(c) === 'pendente').reduce((s, c) => s + (Number(c.valor) || 0), 0),
      vencido: cobrancas.filter((c) => situacao(c) === 'vencido').reduce((s, c) => s + (Number(c.valor) || 0), 0),
      qtdVencidas: cobrancas.filter((c) => situacao(c) === 'vencido').length,
    };
  }, [cobrancas]);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Mensalidades dos clientes — aviso 3 dias antes do vencimento e cobrança diária em caso de atraso, para quem optar">
        {/* Conciliar: rede de segurança para quando o webhook da Asaas se perder
            (deploy, rede fora). Sem a Asaas ligada, o botão não existe. */}
        {asaasLigada && (
          <Button
            variant="outline"
            onClick={() => conciliar.mutate()}
            disabled={conciliar.isPending}
            className="gap-2 border-gray-300 text-gray-700"
            title="Conferir na Asaas se há pagamentos que não chegaram por webhook"
          >
            <RefreshCw className={`w-4 h-4 ${conciliar.isPending ? 'animate-spin' : ''}`} />
            {conciliar.isPending ? 'Conferindo...' : 'Conferir pagamentos'}
          </Button>
        )}
        <Button
          variant="outline"
          onClick={abrirLote}
          disabled={clientes.length === 0}
          className="gap-2 border-gray-300 text-gray-700"
        >
          <CalendarPlus className="w-4 h-4" />
          Gerar mensalidades
        </Button>
        <Button onClick={abrirNova} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nova cobrança
        </Button>
      </CabecalhoPagina>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium">Recebido no mês</p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{fmtBRL(kpis.recebidoMes)}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium">A receber no mês</p>
          <p className="mt-1 text-xl font-bold text-blue-700">{fmtBRL(kpis.aReceberMes)}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium">Em atraso</p>
          <p className="mt-1 text-xl font-bold text-red-600">{fmtBRL(kpis.vencido)}</p>
        </CardContent></Card>
        <Card className="bg-white border-gray-200"><CardContent className="p-4">
          <p className="text-xs text-gray-500 font-medium">Cobranças vencidas</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{kpis.qtdVencidas}</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {[['todas', 'Todas'], ['pendente', 'Pendentes'], ['vencido', 'Vencidas'], ['pago', 'Pagas']].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => { setFiltro(k); pag.goToPage(1); }}
            className={`rounded-full px-4 h-9 text-sm font-medium transition-colors ${
              filtro === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={5} /></div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-16">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {cobrancas.length === 0
                  ? 'Nenhuma cobrança lançada. Use "Gerar mensalidades" para lançar o mês de todos os clientes de uma vez.'
                  : 'Nenhuma cobrança neste filtro.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Cliente</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Competência</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Vencimento</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Valor</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Situação</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Aviso</th>
                      <th className="w-44" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map((c) => {
                      const s = SIT[situacao(c)];
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium text-gray-900">{c.cliente_nome || nomeCliente[c.cliente_id] || '—'}</td>
                          <td className="p-3 text-gray-600">{c.competencia}</td>
                          <td className="p-3 text-gray-600">{fmtData(c.vencimento)}</td>
                          <td className="p-3 text-right tabular-nums font-medium">{fmtBRL(c.valor)}</td>
                          <td className="p-3">
                          <Badge className={`border-0 ${s.cls}`}>{s.label}</Badge>
                          {/* Emitida na Asaas: o cliente já tem boleto/Pix na mão. */}
                          {c.asaas_id && (
                            <span className="block text-[11px] text-blue-600 mt-1">boleto emitido</span>
                          )}
                        </td>
                          <td className="p-3">{avisoDaCobranca(c)}</td>
                          <td className="p-3 text-right">
                            {c.status !== 'pago' && c.status !== 'cancelado' && (
                              <div className="flex items-center justify-end gap-1">
                                {/* Asaas: emitir enquanto não emitida; depois, ver boleto/Pix. */}
                                {asaasLigada && !c.asaas_id && (
                                  <Button
                                    size="sm" variant="outline"
                                    onClick={() => emitir.mutate(c.id)}
                                    disabled={emitindoId === c.id}
                                    className="gap-1 border-gray-300 text-gray-700"
                                    title="Emitir boleto/Pix na Asaas"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    {emitindoId === c.id ? 'Emitindo' : 'Emitir'}
                                  </Button>
                                )}
                                {asaasLigada && c.asaas_id && (
                                  <Button
                                    size="sm" variant="outline"
                                    onClick={() => verMeios(c)}
                                    className="gap-1 border-blue-300 text-blue-700"
                                    title="Ver boleto e Pix para enviar ao cliente"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> Boleto/Pix
                                  </Button>
                                )}
                                {podeAvisar(c) && (
                                  <Button
                                    size="sm" variant="outline"
                                    onClick={() => avisar.mutate(c.id)}
                                    disabled={avisandoId === c.id}
                                    className="gap-1 border-gray-300 text-gray-700"
                                    title="Enviar aviso de vencimento agora"
                                  >
                                    <Mail className="w-3.5 h-3.5" />
                                    {avisandoId === c.id ? 'Enviando' : 'Avisar'}
                                  </Button>
                                )}
                                <Button
                                  size="sm" variant="outline"
                                  onClick={() => { setBaixa(c); setPagamento({ data_pagamento: hoje(), forma: 'pix' }); setErrBaixa({}); }}
                                  className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                                >
                                  <Check className="w-3.5 h-3.5" /> Dar baixa
                                </Button>
                              </div>
                            )}
                            {c.status === 'pago' && (
                              <span className="text-xs text-gray-400">{fmtData(c.data_pagamento)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-gray-100">
                {pag.paginatedItems.map((c) => {
                  const s = SIT[situacao(c)];
                  return (
                    <div key={c.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 break-words">{c.cliente_nome || nomeCliente[c.cliente_id]}</p>
                        <Badge className={`border-0 shrink-0 ${s.cls}`}>{s.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{c.competencia} · vence {fmtData(c.vencimento)}</span>
                        <span className="font-semibold text-gray-900 tabular-nums">{fmtBRL(c.valor)}</span>
                      </div>
                      <div className="text-xs">{avisoDaCobranca(c)}</div>
                      {c.status !== 'pago' && c.status !== 'cancelado' && (
                        <div className="flex flex-wrap gap-2">
                          {asaasLigada && !c.asaas_id && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => emitir.mutate(c.id)}
                              disabled={emitindoId === c.id}
                              className="gap-1 border-gray-300 text-gray-700"
                            >
                              <FileText className="w-3.5 h-3.5" /> Emitir
                            </Button>
                          )}
                          {asaasLigada && c.asaas_id && (
                            <Button size="sm" variant="outline" onClick={() => verMeios(c)} className="gap-1 border-blue-300 text-blue-700">
                              <FileText className="w-3.5 h-3.5" /> Boleto/Pix
                            </Button>
                          )}
                          {podeAvisar(c) && (
                            <Button
                              size="sm" variant="outline"
                              onClick={() => avisar.mutate(c.id)}
                              disabled={avisandoId === c.id}
                              className="gap-1 border-gray-300 text-gray-700"
                            >
                              <Mail className="w-3.5 h-3.5" /> Avisar
                            </Button>
                          )}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => { setBaixa(c); setPagamento({ data_pagamento: hoje(), forma: 'pix' }); setErrBaixa({}); }}
                            className="flex-1 gap-1 text-emerald-700 border-emerald-300"
                          >
                            <Check className="w-3.5 h-3.5" /> Dar baixa
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <Pagination
                currentPage={pag.currentPage} totalPages={pag.totalPages} onPageChange={pag.goToPage}
                startIndex={pag.startIndex} endIndex={pag.endIndex} totalItems={pag.totalItems}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Nova cobrança */}
      {/* BOLETO E PIX — o que se manda ao cliente.
          Copiar em vez de só exibir: linha digitável e código Pix são feitos
          para colar, e ninguém digita 48 dígitos a partir da tela. */}
      <Dialog open={!!meios} onOpenChange={(o) => { if (!o) setMeios(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Boleto e Pix</DialogTitle>
          </DialogHeader>

          {meios && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {meios.cobranca.cliente_nome} · {fmtBRL(meios.cobranca.valor)} ·
                vence {fmtData(meios.cobranca.vencimento)}
              </p>

              {meios.url_fatura && (
                <a
                  href={meios.url_fatura} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3 hover:bg-gray-50"
                >
                  <span className="text-sm text-gray-900">Abrir a fatura no site da Asaas</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
                </a>
              )}

              {meios.linha_digitavel && (
                <div>
                  <Label className="text-xs text-gray-600">Linha digitável do boleto</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={meios.linha_digitavel} className="h-11 font-mono text-xs" />
                    <Button
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(meios.linha_digitavel); toast.success('Linha digitável copiada.'); }}
                      className="shrink-0 border-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {meios.pix_copia_e_cola && (
                <div>
                  <Label className="text-xs text-gray-600">Pix copia e cola</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={meios.pix_copia_e_cola} className="h-11 font-mono text-xs" />
                    <Button
                      variant="outline"
                      onClick={() => { navigator.clipboard.writeText(meios.pix_copia_e_cola); toast.success('Código Pix copiado.'); }}
                      className="shrink-0 border-gray-300"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {meios.pix_qrcode && (
                <div className="text-center">
                  <img
                    src={`data:image/png;base64,${meios.pix_qrcode}`}
                    alt="QR Code do Pix"
                    className="mx-auto w-44 h-44 rounded-lg border border-gray-200"
                  />
                </div>
              )}

              {!meios.url_fatura && !meios.linha_digitavel && !meios.pix_copia_e_cola && (
                <p className="text-sm text-amber-700">
                  A Asaas ainda não devolveu os meios de pagamento desta cobrança.
                  Boleto costuma levar alguns instantes após a emissão.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setMeios(null)} className="border-gray-300 text-gray-700">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GERAÇÃO EM LOTE — conferência antes de gravar.
          Lançar mensalidade é criar dívida no nome do cliente: quem confirma
          precisa ver quem entra, quanto, e por que alguém ficou de fora. */}
      <Dialog open={lote} onOpenChange={(o) => { if (!o) setLote(false); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerar mensalidades</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="sm:w-52">
                <Label className="text-xs text-gray-600">Competência</Label>
                <Input
                  type="month"
                  className="h-11 mt-1"
                  value={compLote}
                  onChange={(e) => setCompLote(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 pb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirTeste}
                  onChange={(e) => setIncluirTeste(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-blue-600"
                />
                Cobrar também os clientes em teste
              </label>
            </div>

            {previa.gerar.length > 0 ? (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Serão lançadas ({previa.gerar.length})
                  </p>
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmtBRL(previa.total)}</p>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-gray-100">
                  {previa.gerar.map((g) => (
                    <div key={g.cliente.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{g.cliente.nome}</p>
                        <p className="text-xs text-gray-400">vence em {fmtData(g.vencimento)}</p>
                      </div>
                      <p className="text-sm text-gray-700 tabular-nums shrink-0">{fmtBRL(g.valor)}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  Nenhuma cobrança a lançar em {rotuloCompetencia(compLote)} — veja abaixo o motivo de cada cliente.
                </p>
              </div>
            )}

            {previa.fora.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Fora desta geração ({previa.fora.length})
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {previa.fora.map((f) => (
                    <div key={f.cliente.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <p className="text-sm text-gray-600 truncate">{f.cliente.nome}</p>
                      <p className="text-xs text-gray-400 shrink-0">{MOTIVOS[f.motivo]}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLote(false)} className="border-gray-300 text-gray-700">
              Cancelar
            </Button>
            <Button
              onClick={() => gerarMes.mutate()}
              disabled={gerarMes.isPending || previa.gerar.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {gerarMes.isPending
                ? 'Gerando...'
                : `Lançar ${previa.gerar.length} cobrança(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={modal} onOpenChange={(o) => { if (!o) setModal(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova cobrança</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-gray-600">Cliente *</Label>
              <div className="mt-1">
                <ComboboxBusca
                  options={clientes.map((c) => ({ value: c.id, label: c.nome }))}
                  value={form.cliente_id}
                  onSelect={escolherCliente}
                  placeholder="Selecione o cliente"
                  searchPlaceholder="Buscar cliente..."
                  emptyMessage="Nenhum cliente cadastrado."
                  className={errors.cliente_id ? 'border-red-400' : ''}
                />
              </div>
              {errors.cliente_id && <p className="text-xs text-red-500 mt-1">{errors.cliente_id}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-gray-600">Competência *</Label>
                <Input
                  type="month"
                  className={`h-11 mt-1 ${errors.competencia ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.competencia} onChange={(e) => set('competencia', e.target.value)}
                />
                {errors.competencia && <p className="text-xs text-red-500 mt-1">{errors.competencia}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">Vencimento *</Label>
                <Input
                  type="date"
                  className={`h-11 mt-1 ${errors.vencimento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.vencimento} onChange={(e) => set('vencimento', e.target.value)}
                />
                {errors.vencimento && <p className="text-xs text-red-500 mt-1">{errors.vencimento}</p>}
              </div>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Valor (R$) *</Label>
              <Input
                type="number" step="0.01" min="0"
                className={`h-11 mt-1 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                value={form.valor} onChange={(e) => set('valor', e.target.value)} placeholder="0,00"
              />
              {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
            </div>

            <div>
              <Label className="text-xs text-gray-600">Observações</Label>
              <Textarea rows={2} className="mt-1" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={salvar} disabled={criar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {criar.isPending ? 'Salvando...' : 'Lançar cobrança'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baixa de pagamento */}
      <Dialog open={!!baixa} onOpenChange={(o) => { if (!o) setBaixa(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
          {baixa && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="font-medium text-gray-900">{baixa.cliente_nome || nomeCliente[baixa.cliente_id]}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {baixa.competencia} · vence {fmtData(baixa.vencimento)}
                </p>
                <p className="mt-2 text-xl font-bold text-gray-900">{fmtBRL(baixa.valor)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600">Data do pagamento *</Label>
                  <Input
                    type="date"
                    className={`h-11 mt-1 ${errBaixa.data ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    value={pagamento.data_pagamento}
                    onChange={(e) => { setPagamento((p) => ({ ...p, data_pagamento: e.target.value })); setErrBaixa({}); }}
                  />
                  {errBaixa.data && <p className="text-xs text-red-500 mt-1">{errBaixa.data}</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Forma</Label>
                  <Select value={pagamento.forma} onValueChange={(v) => setPagamento((p) => ({ ...p, forma: v }))}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">Pix</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixa(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={confirmarBaixa} disabled={darBaixa.isPending} className="bg-emerald-600 hover:bg-emerald-700">
              {darBaixa.isPending ? 'Registrando...' : 'Confirmar pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
