import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Search, Pencil, Trash2, AlertTriangle, Users, Handshake } from 'lucide-react';
import RegistrarEmpreitaModal from '@/components/rh/RegistrarEmpreitaModal';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { fmtCompactBRL } from '@/lib/fmtCompact';
import { REGIMES, REGIME_TERCEIRIZADO, regimeDe, labelRegime, valorDoRegime } from '@/lib/terceirizado';
import ErrorBoundary from '../components/layout/ErrorBoundary';

const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const funcaoConfig = {
  pedreiro: 'Pedreiro', servente: 'Servente', eletricista: 'Eletricista', encanador: 'Encanador',
  pintor: 'Pintor', carpinteiro: 'Carpinteiro', armador: 'Armador',
  operador_maquinas: 'Operador de Máquinas', motorista: 'Motorista', vigilante: 'Vigilante', outro: 'Outro',
};

const VAZIO = { nome: '', cpf: '', empresa_contratante: '', funcao: 'pedreiro', tipo_pagamento: 'DIARIA', valor_diaria: 0, valor_mensal: 0, valor_hora: 0, telefone: '', obra_id: '', status: 'ativo' };

export default function ProfissionaisTerceirizados() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [errors, setErrors] = useState({});
  const [editando, setEditando] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [form, setForm] = useState(VAZIO);
  const queryClient = useQueryClient();

  const { data: profissionais = [] } = useQuery({ queryKey: ['profissionais-terceirizados'], queryFn: () => base44.entities.ProfissionalTerceirizado.list('-created_date', 500) });
  const { data: obras = [] } = useQuery({ queryKey: ['obras'], queryFn: () => base44.entities.Obra.list() });
  const nomeObra = useMemo(() => Object.fromEntries(obras.map((o) => [o.id, o.nome])), [obras]);

  // Zera o valor do regime que NÃO está em uso — senão o cadastro guarda diária e
  // mensal ao mesmo tempo e ninguém sabe qual vale. Empreita não tem valor aqui.
  const payload = (d) => {
    const regime = d.tipo_pagamento || 'DIARIA';
    return {
      ...d,
      tipo_pagamento: regime,
      valor_hora: Number(d.valor_hora) || 0,
      valor_diaria: regime === 'DIARIA' ? Number(d.valor_diaria) || 0 : 0,
      valor_mensal: regime === 'MENSAL' ? Number(d.valor_mensal) || 0 : 0,
    };
  };

  // Fechamento mensal dos terceirizados MENSAIS → conta a pagar rateada por obra.
  const [competenciaPagto, setCompetenciaPagto] = useState(() => new Date().toISOString().slice(0, 7));
  const [empreitando, setEmpreitando] = useState(null);
  const gerarPagamentos = useMutation({
    mutationFn: () => base44.functions.invoke('gerarPagamentosTerceirizados', { competencia: competenciaPagto }),
    onSuccess: (res) => {
      const d = res?.data || res;
      const pulados = d?.pulados?.length ? ` · ${d.pulados.length} já pago(s) no mês` : '';
      toast.success(`${d?.gerados || 0} pagamento(s) gerado(s) — ${fmtBRL(d?.total || 0)}${pulados}. Veja em Contas a Pagar.`);
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').includes('conta') });
    },
    onError: (err) => {
      const msg = err?.detail?.message || err?.response?.data?.message;
      toast.error(msg || 'Erro ao gerar pagamentos: ' + err.message);
    },
  });

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: null }));
  };

  const fechar = () => { setDialogAberto(false); setEditando(null); setForm(VAZIO); setErrors({}); };
  const abrirNovo = () => { setEditando(null); setForm(VAZIO); setErrors({}); setDialogAberto(true); };
  // Cadastro antigo não tem regime — abre como DIÁRIA, que é o que já era usado.
  const abrirEditar = (p) => {
    setEditando(p);
    setForm({ ...VAZIO, ...p, tipo_pagamento: regimeDe(p), valor_hora: p.valor_hora ?? 0, valor_diaria: p.valor_diaria ?? 0, valor_mensal: p.valor_mensal ?? 0 });
    setErrors({});
    setDialogAberto(true);
  };

  const createMutation = useMutation({
    mutationFn: (d) => base44.entities.ProfissionalTerceirizado.create(payload(d)),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais-terceirizados']); toast.success('Profissional cadastrado!'); fechar(); },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }) => base44.entities.ProfissionalTerceirizado.update(id, payload(d)),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais-terceirizados']); toast.success('Profissional atualizado!'); fechar(); },
    onError: (e) => toast.error('Erro: ' + (e?.message || 'tente novamente')),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProfissionalTerceirizado.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['profissionais-terceirizados']); toast.success('Profissional excluído!'); setExcluir(null); },
    onError: (e) => { toast.error('Erro ao excluir: ' + e.message); setExcluir(null); },
  });

  const validar = () => {
    const e = {};
    const soDigitos = (v) => String(v || '').replace(/\D/g, '');

    if (!form.nome.trim()) e.nome = 'Informe o nome';
    if (!form.empresa_contratante.trim()) e.empresa_contratante = 'Informe a empresa contratante';

    const cpf = soDigitos(form.cpf);
    if (cpf && cpf.length !== 11) e.cpf = 'CPF deve ter 11 dígitos';

    const tel = soDigitos(form.telefone);
    if (tel && (tel.length < 10 || tel.length > 11)) e.telefone = 'Telefone incompleto';

    // Empreita é paga pela medição do contrato — não tem valor aqui, de propósito.
    // Diária/mensal sem valor gera conta a pagar zerada na aprovação do ponto.
    if (form.tipo_pagamento !== 'EMPREITA') {
      const campo = form.tipo_pagamento === 'MENSAL' ? 'valor_mensal' : 'valor_diaria';
      if (!(Number(form[campo]) > 0)) e.valor = 'Informe um valor maior que zero';
    }
    if (form.valor_hora !== '' && Number(form.valor_hora) < 0) e.valor_hora = 'Valor não pode ser negativo';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const salvar = () => {
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    if (editando) updateMutation.mutate({ id: editando.id, d: form });
    else createMutation.mutate(form);
  };

  const filtrados = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return profissionais.filter((p) => {
      const matchBusca = !q || p.nome?.toLowerCase().includes(q) || p.empresa_contratante?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'todos' || (p.status || 'ativo') === statusFilter;
      return matchBusca && matchStatus;
    });
  }, [profissionais, searchTerm, statusFilter]);

  const totalAtivos = profissionais.filter((p) => (p.status || 'ativo') === 'ativo').length;
  // Custo mensal por REGIME. Antes era `valor_hora × 220` para todo mundo: supunha
  // jornada CLT cheia para quem é pago por dia ou por serviço fechado — número que
  // parecia preciso e não queria dizer nada. Empreita fica fora (o valor está no
  // contrato, não aqui); diária estima por 22 dias úteis.
  const DIAS_UTEIS_MES = 22;
  const profAtivos = profissionais.filter((p) => (p.status || 'ativo') === 'ativo');
  const custoMensal = profAtivos.reduce((s, p) => {
    const r = regimeDe(p);
    if (r === 'MENSAL') return s + (Number(p.valor_mensal) || 0);
    if (r === 'DIARIA') return s + (Number(p.valor_diaria) || 0) * DIAS_UTEIS_MES;
    return s; // EMPREITA: valor vive no contrato
  }, 0);
  const qtdEmpreita = profAtivos.filter((p) => regimeDe(p) === 'EMPREITA').length;
  const qtdMensal = profAtivos.filter((p) => regimeDe(p) === 'MENSAL').length;

  const { paginatedItems: pageItens, currentPage, totalPages, goToPage, startIndex, endIndex, totalItems } = usePagination(filtrados, 20);
  const temFiltro = searchTerm || statusFilter !== 'todos';
  const ativos = (searchTerm ? 1 : 0) + (statusFilter !== 'todos' ? 1 : 0);
  const limparFiltros = () => { setSearchTerm(''); setStatusFilter('todos'); };

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        <PageHeader title="Profissionais Terceirizados" subtitle="Gestão de mão de obra terceirizada" action={abrirNovo} actionLabel="Novo Profissional" actionIcon={UserPlus} />

        {/* Fechamento do mês dos MENSAIS. Diária já vira conta ao aprovar o
            apontamento, e empreita sai da medição do contrato — só o mensal
            precisava de um gatilho. Só aparece se existir alguém nesse regime. */}
        {qtdMensal > 0 && (
          <Card className="bg-white border-gray-200">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Pagamento mensal dos terceirizados</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {qtdMensal} profissional(is) no regime mensal. Gera a conta a pagar do mês, rateada por obra
                  conforme as horas do ponto (inclui horas extras lançadas).
                </p>
              </div>
              <div className="flex gap-2 items-center shrink-0">
                <Input
                  type="month"
                  value={competenciaPagto}
                  onChange={(e) => setCompetenciaPagto(e.target.value)}
                  className="h-10 w-[150px]"
                />
                <Button
                  onClick={() => gerarPagamentos.mutate()}
                  disabled={!competenciaPagto || gerarPagamentos.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                >
                  {gerarPagamentos.isPending ? 'Gerando...' : 'Gerar pagamentos'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Profissionais Ativos</div><div className="text-lg sm:text-2xl font-bold text-gray-900 tabular-nums">{totalAtivos}</div></CardContent></Card>
          <Card className="bg-white border-gray-200"><CardContent className="p-4"><div className="text-xs sm:text-sm text-gray-500 mb-1">Total Cadastrados</div><div className="text-lg sm:text-2xl font-bold text-blue-600 tabular-nums">{profissionais.length}</div></CardContent></Card>
          <Card className="bg-white border-gray-200"><CardContent className="p-4">
            <div className="text-xs sm:text-sm text-gray-500 mb-1">Custo Mensal Estimado</div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-600 tabular-nums truncate" title={fmtBRL(custoMensal)}>{fmtCompactBRL(custoMensal)}</div>
            <div className="text-[10px] text-gray-400 mt-1">
              Mensais + diárias ({DIAS_UTEIS_MES} dias){qtdEmpreita > 0 ? ` · ${qtdEmpreita} de empreita fora (valor no contrato)` : ''}
            </div>
          </CardContent></Card>
        </div>

        {/* Filtros */}
        <FiltrosColapsaveis ativos={ativos} onLimpar={limparFiltros} rodape={<span className="text-xs text-gray-500">{filtrados.length} profissional(is)</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input className="pl-9 h-11" placeholder="Nome ou empresa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
              <ComboboxBusca
                options={[
                  { value: 'todos', label: 'Todos' },
                  { value: 'ativo', label: 'Ativos' },
                  { value: 'inativo', label: 'Inativos' },
                ]}
                value={statusFilter}
                onSelect={(v) => setStatusFilter(v || 'todos')}
                placeholder="Todos"
                searchPlaceholder="Buscar status..."
              />
            </div>
          </div>
        </FiltrosColapsaveis>

        {/* Lista */}
        <Card className="bg-white border-gray-200">
          <CardContent className="p-0">
            {filtrados.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-900 mb-1">Nenhum profissional</h3>
                <p className="text-sm text-gray-500 mb-5">{temFiltro ? 'Ajuste os filtros ou' : 'Cadastre o primeiro profissional terceirizado'}</p>
                <Button onClick={abrirNovo} className="bg-blue-600 hover:bg-blue-700"><UserPlus className="w-4 h-4 mr-2" />Novo Profissional</Button>
              </div>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="md:hidden flex flex-col gap-2 p-2">
                  {pageItens.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{p.nome}</p>
                          <p className="text-xs text-gray-500">{funcaoConfig[p.funcao] || p.funcao || '—'}</p>
                        </div>
                        {(p.status || 'ativo') === 'ativo' ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Ativo</Badge> : <Badge className="bg-gray-100 text-gray-500 border-0">Inativo</Badge>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
                        <div className="col-span-2"><span className="text-gray-400">Empresa: </span>{p.empresa_contratante || '—'}</div>
                        {nomeObra[p.obra_id] && <div className="col-span-2"><span className="text-gray-400">Obra: </span>{nomeObra[p.obra_id]}</div>}
                        <div>
                          <span className="text-gray-400">{labelRegime(p)}: </span>
                          {regimeDe(p) === 'EMPREITA'
                            ? 'valor no contrato'
                            : valorDoRegime(p) ? `${fmtBRL(valorDoRegime(p))}${regimeDe(p) === 'DIARIA' ? '/dia' : '/mês'}` : '—'}
                        </div>
                        {p.telefone && <div><span className="text-gray-400">Tel.: </span>{p.telefone}</div>}
                        {p.cpf && <div className="col-span-2"><span className="text-gray-400">CPF: </span>{p.cpf}</div>}
                      </div>
                      <div className="flex gap-1 justify-end pt-1 border-t border-gray-100">
                        {/* Empreita: porta na língua do cliente ("acordo por valor fechado").
                            Cria o contrato de empreitada por baixo — o pagamento continua
                            saindo do Medir, que é quem trava o saldo. */}
                        {regimeDe(p) === 'EMPREITA' && (
                          <Button size="sm" variant="ghost" className="h-8 gap-1 text-purple-700 hover:bg-purple-50" onClick={() => setEmpreitando(p)}>
                            <Handshake className="w-4 h-4" /> Empreita
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-gray-600" onClick={() => abrirEditar(p)}><Pencil className="w-4 h-4" /> Editar</Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setExcluir(p)}><Trash2 className="w-4 h-4" /> Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Profissional</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Função</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Empresa</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Obra</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Regime</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pageItens.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="p-3"><p className="font-medium text-gray-900">{p.nome}</p>{p.cpf && <p className="text-xs text-gray-500">{p.cpf}</p>}{p.telefone && <p className="text-xs text-gray-400">{p.telefone}</p>}</td>
                          <td className="p-3 text-gray-600">{funcaoConfig[p.funcao] || p.funcao || '—'}</td>
                          <td className="p-3 text-gray-600">{p.empresa_contratante || '—'}</td>
                          <td className="p-3 text-gray-600">{nomeObra[p.obra_id] || <span className="text-gray-400">—</span>}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={
                              regimeDe(p) === 'EMPREITA' ? 'border-purple-300 bg-purple-50 text-purple-700 text-[10px]'
                              : regimeDe(p) === 'MENSAL' ? 'border-blue-300 bg-blue-50 text-blue-700 text-[10px]'
                              : 'border-emerald-300 bg-emerald-50 text-emerald-700 text-[10px]'
                            }>{labelRegime(p)}</Badge>
                          </td>
                          <td className="p-3 text-right text-gray-700 tabular-nums">
                            {regimeDe(p) === 'EMPREITA'
                              ? <span className="text-xs text-gray-400">no contrato</span>
                              : valorDoRegime(p)
                                ? `${fmtBRL(valorDoRegime(p))}${regimeDe(p) === 'DIARIA' ? '/dia' : '/mês'}`
                                : '—'}
                          </td>
                          <td className="p-3">{(p.status || 'ativo') === 'ativo' ? <Badge className="bg-emerald-100 text-emerald-700 border-0">Ativo</Badge> : <Badge className="bg-gray-100 text-gray-500 border-0">Inativo</Badge>}</td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              {regimeDe(p) === 'EMPREITA' && (
                                <Button size="icon" variant="ghost" title="Registrar empreita (acordo por valor fechado)" onClick={() => setEmpreitando(p)}>
                                  <Handshake className="w-4 h-4 text-purple-600" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" title="Editar" onClick={() => abrirEditar(p)}><Pencil className="w-4 h-4 text-gray-400" /></Button>
                              <Button size="icon" variant="ghost" title="Excluir" onClick={() => setExcluir(p)} className="text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={goToPage} startIndex={startIndex} endIndex={endIndex} totalItems={totalItems} />
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialog cadastro/edição */}
        <Dialog open={dialogAberto} onOpenChange={(o) => { setDialogAberto(o); if (!o) { setEditando(null); setForm(VAZIO); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editando ? 'Editar Profissional' : 'Novo Profissional Terceirizado'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Nome *</Label>
                  <Input className={`h-11 ${errors.nome ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.nome} onChange={(e) => set('nome', e.target.value)} />
                  {errors.nome && <p className="text-xs text-red-500 mt-1">{errors.nome}</p>}
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">CPF</Label>
                  <Input mask="cpf" className={`h-11 ${errors.cpf ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.cpf} onChange={(e) => set('cpf', e.target.value)} placeholder="000.000.000-00" />
                  {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Empresa Contratante *</Label>
                <Input className={`h-11 ${errors.empresa_contratante ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.empresa_contratante} onChange={(e) => set('empresa_contratante', e.target.value)} />
                {errors.empresa_contratante && <p className="text-xs text-red-500 mt-1">{errors.empresa_contratante}</p>}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Função</Label>
                  <Select value={form.funcao} onValueChange={(v) => set('funcao', v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(funcaoConfig).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Regime de pagamento *</Label>
                  <Select value={form.tipo_pagamento} onValueChange={(v) => { set('tipo_pagamento', v); setErrors((p) => ({ ...p, valor: null })); }}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>{REGIMES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {/* O valor pedido muda com o regime — e a empreita não tem valor aqui:
                  ela é paga pela medição do contrato, então pedir um valor no cadastro
                  criaria um segundo lugar falando de dinheiro. */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
                <p className="text-[11px] text-gray-600">{REGIME_TERCEIRIZADO[form.tipo_pagamento]?.descricao}</p>
                {form.tipo_pagamento === 'EMPREITA' ? (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      O valor da empreita fica no <strong>contrato</strong> (Contratos → novo contrato do tipo
                      <strong> Empreitada</strong>, escolhendo este profissional como contratado). Ele não aparece
                      no Ponto/Presença: o pagamento sai da medição, não do dia trabalhado.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">
                        {REGIME_TERCEIRIZADO[form.tipo_pagamento]?.labelValor}
                      </Label>
                      <Input
                        type="number" step="0.01" min="0"
                        className={`h-11 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                        value={form.tipo_pagamento === 'MENSAL' ? form.valor_mensal : form.valor_diaria}
                        onChange={(e) => {
                          set(form.tipo_pagamento === 'MENSAL' ? 'valor_mensal' : 'valor_diaria', e.target.value);
                          setErrors((p) => ({ ...p, valor: null }));
                        }}
                        placeholder="0,00"
                      />
                      {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600 mb-1 block">Valor/Hora extra (R$)</Label>
                      <Input type="number" step="0.01" min="0" className={`h-11 ${errors.valor_hora ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.valor_hora} onChange={(e) => set('valor_hora', e.target.value)} placeholder="0,00" />
                      {errors.valor_hora
                        ? <p className="text-xs text-red-500 mt-1">{errors.valor_hora}</p>
                        : <p className="text-[11px] text-gray-400 mt-1">Usado só para as horas extras lançadas no ponto.</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Obra</Label>
                  <ComboboxBusca
                    options={obras.filter((o) => !['encerrada', 'cancelada'].includes(o.status)).map((o) => ({ value: o.id, label: o.nome }))}
                    value={form.obra_id}
                    onSelect={(v) => set('obra_id', v)}
                    placeholder="Selecione a obra (opcional)"
                    searchPlaceholder="Buscar obra..."
                    emptyMessage="Nenhuma obra."
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-600 mb-1 block">Status</Label>
                  <Select value={form.status} onValueChange={(v) => set('status', v)}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Telefone</Label>
                <Input mask="telefone" className={`h-11 ${errors.telefone ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                {errors.telefone && <p className="text-xs text-red-500 mt-1">{errors.telefone}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={fechar} className="border-gray-300 text-gray-700">Cancelar</Button>
              <Button onClick={salvar} disabled={createMutation.isPending || updateMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {(createMutation.isPending || updateMutation.isPending) ? 'Salvando...' : (editando ? 'Salvar' : 'Cadastrar')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmação de exclusão */}
        <Dialog open={!!excluir} onOpenChange={(o) => { if (!o) setExcluir(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-red-600" /> Excluir profissional</DialogTitle></DialogHeader>
            <p className="text-sm text-gray-600">Excluir o profissional <span className="font-medium">{excluir?.nome}</span>? Esta ação não pode ser desfeita.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExcluir(null)} className="border-gray-300 text-gray-700">Cancelar</Button>
              <Button onClick={() => deleteMutation.mutate(excluir.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 gap-2"><Trash2 className="w-4 h-4" />{deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <RegistrarEmpreitaModal
          open={!!empreitando}
          onOpenChange={(o) => { if (!o) setEmpreitando(null); }}
          profissional={empreitando}
        />
      </div>
    </ErrorBoundary>
  );
}
