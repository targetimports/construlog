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
import { Plus, Check, Receipt, CalendarPlus } from 'lucide-react';
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
      <CabecalhoPagina subtitulo="Mensalidades dos clientes — controle manual">
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
                      <th className="w-28" />
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
                          <td className="p-3"><Badge className={`border-0 ${s.cls}`}>{s.label}</Badge></td>
                          <td className="p-3 text-right">
                            {c.status !== 'pago' && c.status !== 'cancelado' && (
                              <Button
                                size="sm" variant="outline"
                                onClick={() => { setBaixa(c); setPagamento({ data_pagamento: hoje(), forma: 'pix' }); setErrBaixa({}); }}
                                className="gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Dar baixa
                              </Button>
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
                      {c.status !== 'pago' && c.status !== 'cancelado' && (
                        <Button
                          size="sm" variant="outline"
                          onClick={() => { setBaixa(c); setPagamento({ data_pagamento: hoje(), forma: 'pix' }); setErrBaixa({}); }}
                          className="w-full gap-1 text-emerald-700 border-emerald-300"
                        >
                          <Check className="w-3.5 h-3.5" /> Dar baixa
                        </Button>
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
