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
import { Building2, Plus, Search, Pencil, Users, CheckCircle2, PauseCircle, XCircle, ShieldAlert } from 'lucide-react';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { TableSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';
import { PLANOS, valorDoPlano } from '@/lib/planos';
import { CabecalhoPagina, fmtBRL } from '@/components/painel/ui';

// CLIENTES DO SAAS — as construtoras que assinam o Construlog.
// Não confundir com a entidade Empresa do ERP (que é a empresa DENTRO da obra):
// aqui cada registro é um contrato de assinatura.

const STATUS = {
  ativo: { label: 'Ativo', cls: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  teste: { label: 'Em teste', cls: 'bg-blue-100 text-blue-800', icon: Users },
  suspenso: { label: 'Suspenso', cls: 'bg-amber-100 text-amber-800', icon: PauseCircle },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const VAZIO = {
  nome: '', cnpj: '', responsavel: '', email: '', telefone: '',
  plano: 'Construtora', valor_mensal: '', dia_vencimento: 10,
  status: 'teste', inicio: new Date().toISOString().slice(0, 10), observacoes: '',
  // Aviso de vencimento por e-mail: desligado por padrão. E-mail sai em nome do
  // fornecedor para um terceiro — quem liga é quem conhece o combinado com o
  // cliente, não um default nosso.
  cobranca_email: false,
  cobranca_whatsapp: false,
};

const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// Status que fazem o painel NEGAR autorização no heartbeat — ou seja, que
// derrubam o sistema do cliente. Espelha a regra de backend/src/integracao.js
// (avaliarAutorizacao); mexer lá pede mexer aqui.
const STATUS_QUE_BLOQUEIA = new Set(['suspenso', 'cancelado']);

export default function PainelClientes() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [errors, setErrors] = useState({});
  const [confirmarStatus, setConfirmarStatus] = useState(null); // { dados, instancia }

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes-saas'],
    queryFn: () => base44.entities.ClienteSaaS.list('-created_date', 500).catch(() => []),
  });
  // Instâncias: precisamos saber se este cliente tem sistema RODANDO antes de
  // deixar alguém mudar o status para um valor que derruba o acesso.
  const { data: instancias = [] } = useQuery({
    queryKey: ['instancias-cliente'],
    queryFn: () => base44.entities.InstanciaCliente.list('-created_date', 500).catch(() => []),
  });

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: null } : e));
  };

  const abrirNovo = () => { setEditando(null); setForm(VAZIO); setErrors({}); setModal(true); };
  const abrirEditar = (c) => {
    setEditando(c);
    setForm({ ...VAZIO, ...c, valor_mensal: c.valor_mensal ?? '' });
    setErrors({});
    setModal(true);
  };


  const salvar = useMutation({
    mutationFn: (dados) => (editando
      ? base44.entities.ClienteSaaS.update(editando.id, dados)
      : base44.entities.ClienteSaaS.create(dados)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes-saas'] });
      toast.success(editando ? 'Cliente atualizado!' : 'Cliente cadastrado!');
      setModal(false);
    },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome da empresa';

    const cnpj = soDigitos(form.cnpj);
    if (cnpj && cnpj.length !== 14) e.cnpj = 'CNPJ deve ter 14 dígitos';

    if (!form.email.trim()) e.email = 'Informe o e-mail de contato';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido';

    const tel = soDigitos(form.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto';

    // Valor é a base da cobrança mensal: zero geraria fatura sem valor.
    if (!(Number(form.valor_mensal) > 0)) e.valor_mensal = 'Informe a mensalidade';

    const dia = Number(form.dia_vencimento);
    if (!(dia >= 1 && dia <= 28)) e.dia_vencimento = 'Use um dia entre 1 e 28';

    if (!form.inicio) e.inicio = 'Informe o início do contrato';

    // Aviso ligado sem e-mail é promessa que o sistema não cumpre: ninguém
    // receberia nada e não haveria erro visível em lugar nenhum.
    if (form.cobranca_email && !String(form.email || '').trim()) {
      e.email = 'Informe o e-mail para poder avisar o cliente do vencimento';
    }
    if (form.cobranca_whatsapp && !String(form.telefone || '').trim()) {
      e.telefone = 'Informe o telefone para poder cobrar por WhatsApp';
    }

    // CNPJ repetido = cliente cadastrado duas vezes, com cobrança duplicada.
    if (cnpj) {
      const dup = clientes.some((c) => c.id !== editando?.id && soDigitos(c.cnpj) === cnpj);
      if (dup) e.cnpj = 'Já existe um cliente com este CNPJ';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSalvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }

    const dados = {
      ...form,
      cnpj: form.cnpj.trim(),
      valor_mensal: Number(form.valor_mensal),
      dia_vencimento: Number(form.dia_vencimento),
      cobranca_email: !!form.cobranca_email,
      cobranca_whatsapp: !!form.cobranca_whatsapp,
    };

    // MUDANÇA DE STATUS QUE DERRUBA O CLIENTE.
    //
    // "suspenso" e "cancelado" fazem o heartbeat negar autorização: o sistema do
    // cliente para de funcionar em até 30s. Editar isso num <select>, com o mesmo
    // gesto de corrigir um telefone, é desproporcional à consequência — então
    // pede a mesma confirmação do cadeado em Integrações.
    //
    // Só pergunta quando há instância registrada: cliente sem sistema no ar não
    // tem nada para derrubar, e a pergunta ali seria só atrito.
    const instancia = instancias.find((i) => i.cliente_id === editando?.id) || null;
    const derruba = STATUS_QUE_BLOQUEIA.has(dados.status);
    const antesEstavaLiberado = editando && !STATUS_QUE_BLOQUEIA.has(editando.status);

    if (editando && derruba && antesEstavaLiberado && instancia) {
      setConfirmarStatus({ dados, instancia });
      return;
    }

    salvar.mutate(dados);
  };

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientes.filter((c) => {
      const achou = !q
        || (c.nome || '').toLowerCase().includes(q)
        || (c.email || '').toLowerCase().includes(q)
        || soDigitos(c.cnpj).includes(soDigitos(q));
      const status = filtroStatus === 'todos' || (c.status || 'teste') === filtroStatus;
      return achou && status;
    });
  }, [clientes, busca, filtroStatus]);

  const pag = usePagination(filtrados, 15);

  const kpis = useMemo(() => {
    const ativos = clientes.filter((c) => c.status === 'ativo');
    return {
      ativos: ativos.length,
      teste: clientes.filter((c) => c.status === 'teste').length,
      suspensos: clientes.filter((c) => c.status === 'suspenso').length,
      mrr: ativos.reduce((s, c) => s + (Number(c.valor_mensal) || 0), 0),
    };
  }, [clientes]);

  return (
    <div className="space-y-6 pb-6">
      <CabecalhoPagina subtitulo="Construtoras que assinam o Construlog">
        <Button onClick={abrirNovo} className="gap-2 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Plus className="w-4 h-4" /> Novo cliente
        </Button>
      </CabecalhoPagina>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Receita mensal</p>
            <p className="mt-1 text-xl font-bold text-emerald-700">{fmtBRL(kpis.mrr)}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Clientes ativos</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{kpis.ativos}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Em teste</p>
            <p className="mt-1 text-xl font-bold text-blue-700">{kpis.teste}</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 font-medium">Suspensos</p>
            <p className="mt-1 text-xl font-bold text-amber-700">{kpis.suspensos}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 h-11"
            placeholder="Buscar por empresa, e-mail ou CNPJ..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); pag.goToPage(1); }}
          />
        </div>
        <Select value={filtroStatus} onValueChange={(v) => { setFiltroStatus(v); pag.goToPage(1); }}>
          <SelectTrigger className="h-11 w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton rows={5} /></div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-16">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">
                {clientes.length === 0 ? 'Nenhum cliente cadastrado ainda.' : 'Nenhum cliente para este filtro.'}
              </p>
              {clientes.length === 0 && (
                <Button onClick={abrirNovo} variant="outline" className="mt-4 border-gray-300 text-gray-700">
                  Cadastrar o primeiro
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Tabela (desktop) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-600">Empresa</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Contato</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Plano</th>
                      <th className="text-right p-3 font-semibold text-gray-600">Mensalidade</th>
                      <th className="text-center p-3 font-semibold text-gray-600">Vence dia</th>
                      <th className="text-left p-3 font-semibold text-gray-600">Status</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pag.paginatedItems.map((c) => {
                      const st = STATUS[c.status] || STATUS.teste;
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <p className="font-medium text-gray-900">{c.nome}</p>
                            {c.cnpj && <p className="text-xs text-gray-400">{c.cnpj}</p>}
                          </td>
                          <td className="p-3 text-gray-600">
                            <p className="truncate max-w-[200px]">{c.email}</p>
                            {c.telefone && <p className="text-xs text-gray-400">{c.telefone}</p>}
                          </td>
                          <td className="p-3 text-gray-600">{c.plano}</td>
                          <td className="p-3 text-right tabular-nums font-medium text-gray-900">{fmtBRL(c.valor_mensal)}</td>
                          <td className="p-3 text-center text-gray-600">{c.dia_vencimento || '—'}</td>
                          <td className="p-3">
                            <Badge className={`border-0 ${st.cls}`}>{st.label}</Badge>
                          </td>
                          <td className="p-3">
                            <Button variant="ghost" size="icon" onClick={() => abrirEditar(c)} title="Editar">
                              <Pencil className="w-4 h-4 text-gray-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden divide-y divide-gray-100">
                {pag.paginatedItems.map((c) => {
                  const st = STATUS[c.status] || STATUS.teste;
                  return (
                    <div key={c.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 break-words">{c.nome}</p>
                          <p className="text-xs text-gray-500 break-words">{c.email}</p>
                        </div>
                        <Badge className={`border-0 shrink-0 ${st.cls}`}>{st.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{c.plano} · vence dia {c.dia_vencimento || '—'}</span>
                        <span className="font-semibold tabular-nums">{fmtBRL(c.valor_mensal)}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => abrirEditar(c)} className="w-full border-gray-300 text-gray-700">
                        Editar
                      </Button>
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

      {/* Modal de cadastro/edição */}
      <Dialog open={modal} onOpenChange={(o) => { if (!o) setModal(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Label className="text-xs text-gray-600">Empresa *</Label>
                <Input
                  className={`h-11 mt-1 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.nome} onChange={(e) => set('nome', e.target.value)}
                  placeholder="Ex: Construtora Alvorada Ltda"
                />
                {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">CNPJ</Label>
                <Input
                  mask="cnpj"
                  className={`h-11 mt-1 ${errors.cnpj ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.cnpj} onChange={(e) => set('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
                {errors.cnpj && <p className="text-xs text-red-500 mt-1">{errors.cnpj}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">Responsável</Label>
                <Input className="h-11 mt-1" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} placeholder="Quem assina pela empresa" />
              </div>
              <div>
                <Label className="text-xs text-gray-600">E-mail *</Label>
                <Input
                  type="email"
                  className={`h-11 mt-1 ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.email} onChange={(e) => set('email', e.target.value)}
                  placeholder="financeiro@construtora.com.br"
                />
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <Label className="text-xs text-gray-600">Telefone</Label>
                <Input
                  mask="telefone"
                  className={`h-11 mt-1 ${errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                  value={form.telefone} onChange={(e) => set('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Assinatura</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">Plano</Label>
                  {/* Trocar o plano sugere a mensalidade de tabela — o valor
                      continua editável para negociação. */}
                  <Select
                    value={form.plano}
                    onValueChange={(v) => {
                      set('plano', v);
                      const sugerido = valorDoPlano(v);
                      if (sugerido != null) set('valor_mensal', String(sugerido));
                    }}
                  >
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLANOS.map((p) => <SelectItem key={p.nome} value={p.nome}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Mensalidade (R$) *</Label>
                  <Input
                    type="number" step="0.01" min="0"
                    className={`h-11 mt-1 ${errors.valor_mensal ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    value={form.valor_mensal} onChange={(e) => set('valor_mensal', e.target.value)}
                    placeholder="0,00"
                  />
                  {errors.valor_mensal && <p className="text-xs text-red-500 mt-1">{errors.valor_mensal}</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Dia do vencimento *</Label>
                  <Input
                    type="number" min="1" max="28"
                    className={`h-11 mt-1 ${errors.dia_vencimento ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    value={form.dia_vencimento} onChange={(e) => set('dia_vencimento', e.target.value)}
                  />
                  {errors.dia_vencimento
                    ? <p className="text-xs text-red-500 mt-1">{errors.dia_vencimento}</p>
                    : <p className="text-[11px] text-gray-400 mt-1">Até 28, para existir em todo mês.</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Início do contrato *</Label>
                  <Input
                    type="date"
                    className={`h-11 mt-1 ${errors.inicio ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    value={form.inicio} onChange={(e) => set('inicio', e.target.value)}
                  />
                  {errors.inicio && <p className="text-xs text-red-500 mt-1">{errors.inicio}</p>}
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-gray-600">Status</Label>
                  <Select value={form.status} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS).map(([k, s]) => <SelectItem key={k} value={k}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* A consequência aparece já na escolha, não só na confirmação:
                      quem está editando merece saber antes de clicar em Salvar. */}
                  {STATUS_QUE_BLOQUEIA.has(form.status) && (
                    <p className="text-xs text-red-600 mt-1.5 flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      Este status <strong>bloqueia o sistema do cliente</strong> no próximo
                      heartbeat (até 30s).
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Avisos de vencimento — por onde este cliente aceita ser cobrado.
                Cada canal é independente: dá para usar só um, os dois ou nenhum. */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Avisos de cobrança
              </p>
              <p className="text-xs text-gray-500">
                Um lembrete 3 dias antes de cada mensalidade vencer e, passado o prazo
                sem pagamento, uma cobrança por dia até a baixa.
              </p>

              <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                form.cobranca_email ? 'border-blue-200 bg-blue-50/60' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  checked={!!form.cobranca_email}
                  onChange={(e) => set('cobranca_email', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">Por e-mail</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {form.email ? `Enviado para ${form.email}` : 'Enviado para o e-mail do cliente'}
                  </span>
                  {form.cobranca_email && !form.email && (
                    <span className="block text-xs text-amber-700 mt-1">
                      Informe o e-mail acima, senão não há para onde enviar.
                    </span>
                  )}
                </span>
              </label>

              <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                form.cobranca_whatsapp ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  checked={!!form.cobranca_whatsapp}
                  onChange={(e) => set('cobranca_whatsapp', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-emerald-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">Por WhatsApp</span>
                  <span className="block text-xs text-gray-500 mt-0.5">
                    {form.telefone ? `Enviado para ${form.telefone}` : 'Enviado para o telefone do cliente'}
                  </span>
                  {form.cobranca_whatsapp && !form.telefone && (
                    <span className="block text-xs text-amber-700 mt-1">
                      Informe o telefone acima, senão não há para onde enviar.
                    </span>
                  )}
                </span>
              </label>
            </div>

            <div>
              <Label className="text-xs text-gray-600">Observações</Label>
              <Textarea rows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} placeholder="Combinações, desconto negociado, etc." className="mt-1" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModal(false)} className="border-gray-300 text-gray-700">Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONFIRMAÇÃO DE STATUS QUE DERRUBA O CLIENTE.
          Mesma seriedade do cadeado em Integrações: diz o que vai acontecer,
          quanta gente está trabalhando agora e o que o cliente vai ver. */}
      <Dialog open={!!confirmarStatus} onOpenChange={(o) => { if (!o) setConfirmarStatus(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {confirmarStatus?.dados?.status === 'cancelado' ? 'Cancelar o contrato?' : 'Suspender o acesso?'}
            </DialogTitle>
          </DialogHeader>

          {confirmarStatus && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50 px-3 py-3">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm text-red-800 space-y-1">
                  <p>
                    O sistema de <strong>{confirmarStatus.dados.nome}</strong> vai
                    parar de funcionar em até 30 segundos.
                  </p>
                  {confirmarStatus.instancia?.metricas?.usuarios_online > 0 && (
                    <p>
                      Há <strong>{confirmarStatus.instancia.metricas.usuarios_online} usuário(s)</strong> trabalhando
                      neste momento.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">O que o cliente vai ver</p>
                <p className="text-sm text-gray-700">
                  {confirmarStatus.dados.status === 'cancelado'
                    ? '"Contrato encerrado."'
                    : '"Contrato suspenso. Fale com o suporte."'}
                </p>
                <p className="text-xs text-gray-500">
                  Instância: {confirmarStatus.instancia?.nome || '—'}
                  {confirmarStatus.instancia?.url ? ` · ${confirmarStatus.instancia.url}` : ''}
                </p>
              </div>

              <p className="text-xs text-gray-500">
                Os dados do cliente ficam preservados. Voltar o status para Ativo
                libera o acesso automaticamente, também em até 30 segundos.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmarStatus(null)}
              className="border-gray-300 text-gray-700"
            >
              Voltar sem salvar
            </Button>
            <Button
              onClick={() => { salvar.mutate(confirmarStatus.dados); setConfirmarStatus(null); }}
              disabled={salvar.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {confirmarStatus?.dados?.status === 'cancelado' ? 'Cancelar contrato' : 'Suspender acesso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
