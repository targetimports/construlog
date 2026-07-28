import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import FiltrosColapsaveis from '@/components/shared/FiltrosColapsaveis';
import Pagination from '@/components/shared/Pagination';
import { usePagination } from '@/components/shared/usePagination';
import { Trash2, Pencil, Plus, Calendar, AlertCircle, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import ValidadorObraGlobal from '@/components/shared/ValidadorObraGlobal';

// "Lançamento rápido" por obra. Grava em ContaFinanceira (sem silo):
//   despesa -> tipo 'pagar'   | receita -> tipo 'receber'
//   liquidado -> status pago/recebido (+ data e valor liquidados) | senão 'pendente'.
const TIPO_MAP = { despesa: 'pagar', receita: 'receber' };
const CATEGORIAS_DESPESA = ['Material', 'Mão de Obra', 'Equipamento', 'Aluguel/Combustível', 'Frete', 'Alimentação', 'Estadias', 'Impostos', 'Retiradas', 'Outros'];
const CATEGORIAS_RECEITA = ['Medição', 'Aporte', 'Outros'];
const FORMAS = ['Dinheiro', 'PIX', 'Transferência', 'Cartão', 'Boleto', 'Cheque'];
const itensPorPagina = 20;

export default function LancamentosFinanceiros() {
  const [obraId, setObraId] = useState('');
  const [filtros, setFiltros] = useState({ tipo: 'todas', situacao: 'todas' });
  const [modalOpen, setModalOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['lancamentos-conta', obraId],
    queryFn: () => obraId ? base44.entities.ContaFinanceira.filter({ obra_id: obraId }) : [],
    enabled: !!obraId
  });

  const obraNome = obras.find(o => o.id === obraId)?.nome || '';

  const deletarMutation = useMutation({
    mutationFn: (id) => base44.entities.ContaFinanceira.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lancamentos-conta'] });
      toast.success('Lançamento removido');
    },
    onError: () => toast.error('Erro ao remover')
  });

  const liquidado = (c) => c.status === 'pago' || c.status === 'recebido';

  const contasFiltradas = useMemo(() => {
    let r = [...contas];
    if (filtros.tipo !== 'todas') r = r.filter(c => c.tipo === TIPO_MAP[filtros.tipo]);
    if (filtros.situacao === 'liquidado') r = r.filter(liquidado);
    if (filtros.situacao === 'pendente') r = r.filter(c => !liquidado(c));
    r.sort((a, b) => new Date(b.data_vencimento || 0) - new Date(a.data_vencimento || 0));
    return r;
  }, [contas, filtros]);

  const {
    paginatedItems: contasPaginadas,
    currentPage, totalPages, goToPage, startIndex, endIndex, totalItems,
  } = usePagination(contasFiltradas, itensPorPagina);

  const totais = useMemo(() => {
    const despesas = contasFiltradas.filter(c => c.tipo === 'pagar').reduce((s, c) => s + (c.valor || 0), 0);
    const receitas = contasFiltradas.filter(c => c.tipo === 'receber').reduce((s, c) => s + (c.valor || 0), 0);
    return { despesas, receitas, saldo: receitas - despesas };
  }, [contasFiltradas]);

  const getStatusBadge = (c) => {
    if (c.status === 'pago' || c.status === 'recebido') return <Badge className="bg-green-100 text-green-700 border-0">Liquidado</Badge>;
    if (c.status === 'parcial') return <Badge className="bg-blue-100 text-blue-700 border-0">Parcial</Badge>;
    if (c.status === 'cancelado') return <Badge className="bg-gray-100 text-gray-600 border-0">Cancelado</Badge>;
    return <Badge className="bg-amber-100 text-amber-700 border-0">Pendente</Badge>;
  };

  const dataDe = (c) => c.data_pagamento || c.data_recebimento || c.data_vencimento;

  return (
    <div className="space-y-6 pb-6">
      <ValidadorObraGlobal />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lançamentos Financeiros</h1>
        <p className="text-gray-500 text-sm mt-1">Lançamento rápido de despesas e receitas da obra — integrado ao financeiro</p>
      </div>

      {/* Seletor de Obra */}
      <Card className="bg-white border-gray-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
            <div className="flex-1 min-w-0">
              <label className="block text-xs text-gray-600 mb-1">Obra *</label>
              <ComboboxBusca
                options={obras.map(o => ({ value: o.id, label: o.nome || o.codigo || o.id }))}
                value={obraId}
                onSelect={(v) => { setObraId(v || ''); goToPage(1); }}
                placeholder="Selecione uma obra"
                searchPlaceholder="Buscar obra..."
                emptyMessage="Nenhuma obra."
              />
            </div>
            <Button
              onClick={() => { setContaSelecionada(null); setModalOpen(true); }}
              disabled={!obraId}
              className="w-full sm:w-auto h-11 bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Lançamento
            </Button>
          </div>
        </CardContent>
      </Card>

      {obraId && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Despesas</p>
                    <p className="text-2xl font-bold text-red-600 mt-1">R$ {totais.despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-500 opacity-30" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Receitas</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">R$ {totais.receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500 opacity-30" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-200">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Saldo</p>
                    <p className={`text-2xl font-bold mt-1 ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>R$ {totais.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <Wallet className="w-8 h-8 text-blue-500 opacity-30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros (colapsáveis) */}
          <FiltrosColapsaveis
            ativos={(filtros.tipo !== 'todas' ? 1 : 0) + (filtros.situacao !== 'todas' ? 1 : 0)}
            onLimpar={() => { setFiltros({ tipo: 'todas', situacao: 'todas' }); goToPage(1); }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Tipo</label>
                <ComboboxBusca
                  options={[{ value: 'todas', label: 'Todos os tipos' }, { value: 'despesa', label: 'Despesas' }, { value: 'receita', label: 'Receitas' }]}
                  value={filtros.tipo}
                  onSelect={(v) => { setFiltros({ ...filtros, tipo: v || 'todas' }); goToPage(1); }}
                  placeholder="Todos os tipos"
                  searchPlaceholder="Buscar..."
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Situação</label>
                <ComboboxBusca
                  options={[{ value: 'todas', label: 'Todas' }, { value: 'liquidado', label: 'Liquidado' }, { value: 'pendente', label: 'Pendente' }]}
                  value={filtros.situacao}
                  onSelect={(v) => { setFiltros({ ...filtros, situacao: v || 'todas' }); goToPage(1); }}
                  placeholder="Todas"
                  searchPlaceholder="Buscar..."
                />
              </div>
            </div>
          </FiltrosColapsaveis>

          {/* Tabela (desktop) / Cards (mobile) */}
          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {contasPaginadas.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  Nenhum lançamento encontrado. Crie um novo para começar!
                </div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Data</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Categoria</th>
                        <th className="text-left p-3 text-xs font-semibold text-gray-500">Descrição</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="text-right p-3 text-xs font-semibold text-gray-500">Valor</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-500">Situação</th>
                        <th className="text-center p-3 text-xs font-semibold text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contasPaginadas.map(c => {
                        const isDespesa = c.tipo === 'pagar';
                        return (
                          <tr key={c.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                {dataDe(c) ? new Date(dataDe(c)).toLocaleDateString('pt-BR') : '-'}
                              </div>
                            </td>
                            <td className="p-3 font-medium capitalize">{(c.categoria || '-').replace(/_/g, ' ')}</td>
                            <td className="p-3 text-gray-700">{c.descricao}</td>
                            <td className="p-3 text-center">
                              <Badge className={`border-0 ${isDespesa ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isDespesa ? 'Despesa' : 'Receita'}
                              </Badge>
                            </td>
                            <td className={`p-3 text-right font-mono font-bold ${isDespesa ? 'text-red-600' : 'text-green-600'}`}>
                              {isDespesa ? '-' : '+'}R$ {(c.valor || 0).toFixed(2)}
                            </td>
                            <td className="p-3 text-center">{getStatusBadge(c)}</td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setContaSelecionada(c); setModalOpen(true); }}>
                                  <Pencil className="w-4 h-4 text-gray-500" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => deletarMutation.mutate(c.id)}>
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>

                  {/* Cards (mobile) */}
                  <div className="md:hidden flex flex-col gap-2 p-2">
                    {contasPaginadas.map(c => {
                      const isDespesa = c.tipo === 'pagar';
                      return (
                        <div key={c.id} className="p-3 rounded-lg border border-gray-200 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-gray-900 break-words min-w-0">{c.descricao || '—'}</p>
                            {getStatusBadge(c)}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                            <Badge className={`border-0 text-xs ${isDespesa ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{isDespesa ? 'Despesa' : 'Receita'}</Badge>
                            <span className="capitalize">{(c.categoria || '-').replace(/_/g, ' ')}</span>
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <div className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {dataDe(c) ? new Date(dataDe(c)).toLocaleDateString('pt-BR') : '-'}</div>
                            <p className={`text-base font-bold tabular-nums shrink-0 ${isDespesa ? 'text-red-600' : 'text-green-600'}`}>{isDespesa ? '-' : '+'}R$ {(c.valor || 0).toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                            <Button size="sm" variant="ghost" className="gap-1 h-8" onClick={() => { setContaSelecionada(c); setModalOpen(true); }}>
                              <Pencil className="w-3.5 h-3.5 text-gray-500" /> Editar
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1 h-8 text-red-500 ml-auto" onClick={() => deletarMutation.mutate(c.id)}>
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                startIndex={startIndex}
                endIndex={endIndex}
                totalItems={totalItems}
              />
            </CardContent>
          </Card>
        </>
      )}

      {modalOpen && (
        <LancamentoModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setContaSelecionada(null); }}
          obraId={obraId}
          obraNome={obraNome}
          conta={contaSelecionada}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['lancamentos-conta'] })}
        />
      )}
    </div>
  );
}

function LancamentoModal({ open, onClose, obraId, obraNome, conta, onSaved }) {
  const editando = !!conta?.id;
  const liquidadoInicial = conta?.status === 'pago' || conta?.status === 'recebido';
  const [dados, setDados] = useState({
    data: (conta?.data_pagamento || conta?.data_recebimento || conta?.data_vencimento || new Date().toISOString().split('T')[0]).slice(0, 10),
    tipo: conta ? (conta.tipo === 'receber' ? 'receita' : 'despesa') : 'despesa',
    categoria: conta?.categoria || 'Material',
    descricao: conta?.descricao || '',
    fornecedor_cliente: conta?.fornecedor_cliente || '',
    forma_pagamento: conta?.forma_pagamento || 'Dinheiro',
    valor: conta?.valor || 0,
    // Novo lançamento nasce PENDENTE — a baixa deve ser feita em Contas a Pagar/Receber
    // (pagarContaPagar/darBaixaRecebimento), que aí sim movem o caixa e a verba.
    situacao: conta ? (liquidadoInicial ? 'liquidado' : 'pendente') : 'pendente',
  });
  const [errors, setErrors] = useState({});
  const set = (k, v) => {
    setDados(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: null }));
  };

  const isDespesa = dados.tipo === 'despesa';
  const categorias = isDespesa ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA;

  const salvar = useMutation({
    mutationFn: () => {
      const valor = Number(dados.valor) || 0;
      const liq = dados.situacao === 'liquidado';
      const tipo = TIPO_MAP[dados.tipo];
      const payload = {
        tipo,
        obra_id: obraId,
        obra_nome: obraNome,
        descricao: dados.descricao,
        fornecedor_cliente: dados.fornecedor_cliente || '',
        categoria: dados.categoria,
        forma_pagamento: dados.forma_pagamento,
        valor,
        data_vencimento: dados.data,
        status: liq ? (isDespesa ? 'pago' : 'recebido') : 'pendente',
      };
      if (liq && isDespesa) { payload.data_pagamento = dados.data; payload.valor_pago = valor; }
      else if (liq && !isDespesa) { payload.data_recebimento = dados.data; payload.valor_recebido = valor; }
      else { payload.valor_pago = 0; payload.valor_recebido = 0; }

      return editando
        ? base44.entities.ContaFinanceira.update(conta.id, payload)
        : base44.entities.ContaFinanceira.create(payload);
    },
    onSuccess: () => {
      onSaved?.();
      toast.success(editando ? 'Lançamento atualizado' : 'Lançamento criado');
      onClose();
    },
    onError: (e) => toast.error(e?.message || 'Erro ao salvar')
  });

  const validar = () => {
    const e = {};
    if (!dados.data) e.data = 'Informe a data';
    // "Já pago/recebido" é dinheiro que já andou: não pode ter data no futuro.
    else if (dados.situacao === 'liquidado' && dados.data > new Date().toISOString().split('T')[0]) {
      e.data = 'Lançamento já liquidado não pode ter data futura';
    }
    if (!dados.descricao?.trim()) e.descricao = 'Informe a descrição';
    if (!(Number(dados.valor) > 0)) e.valor = 'Informe um valor maior que zero';
    if (!dados.categoria) e.categoria = 'Selecione a categoria';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validar()) { toast.error('Verifique os campos destacados.'); return; }
    salvar.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar Lançamento' : 'Novo Lançamento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <Input className={`h-11 ${errors.data ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="date" value={dados.data} onChange={(e) => set('data', e.target.value)} />
              {errors.data && <p className="text-xs text-red-500 mt-1">{errors.data}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <Select value={dados.tipo} onValueChange={(v) => { setDados(p => ({ ...p, tipo: v, categoria: (v === 'despesa' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA)[0] })); setErrors(p => ({ ...p, categoria: null })); }}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="despesa">Despesa</SelectItem>
                  <SelectItem value="receita">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
              <Select value={dados.categoria} onValueChange={(v) => set('categoria', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Situação</label>
              <Select value={dados.situacao} onValueChange={(v) => { set('situacao', v); setErrors(p => ({ ...p, data: null })); }}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="liquidado">{isDespesa ? 'Já pago' : 'Já recebido'}</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição *</label>
            <Input className={`h-11 ${errors.descricao ? 'border-red-400 focus-visible:ring-red-400' : ''}`} value={dados.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descrição do lançamento" />
            {errors.descricao && <p className="text-xs text-red-500 mt-1">{errors.descricao}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{isDespesa ? 'Fornecedor' : 'Cliente'}</label>
              <Input className="h-11" value={dados.fornecedor_cliente} onChange={(e) => set('fornecedor_cliente', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Forma de pagamento</label>
              <Select value={dados.forma_pagamento} onValueChange={(v) => set('forma_pagamento', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Valor *</label>
            <Input className={`h-11 ${errors.valor ? 'border-red-400 focus-visible:ring-red-400' : ''}`} type="number" step="0.01" min="0" value={dados.valor} onChange={(e) => set('valor', parseFloat(e.target.value) || 0)} placeholder="0,00" />
            {errors.valor && <p className="text-xs text-red-500 mt-1">{errors.valor}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending} className="bg-blue-600 hover:bg-blue-700">
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
