import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RequireRole from '../components/auth/RequireRole';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Download, DollarSign, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';
import Pagination from '@/components/shared/Pagination';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

import FiltrosContasReceber from '../components/financeiro/FiltrosContasReceber';
import FormContaReceber from '../components/financeiro/FormContaReceber';
import DialogBaixaRecebimento from '../components/financeiro/DialogBaixaRecebimento';
import FiltroAplicadoBanner from '../components/shared/FiltroAplicadoBanner';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function ContasReceber({ embedded = false }) {
  const [filtros, setFiltros] = useState({});
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [modalForm, setModalForm] = useState(false);
  const [modalBaixa, setModalBaixa] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [obraBannerNome, setObraBannerNome] = useState('');

  const queryClient = useQueryClient();
  const itensPorPagina = 20;

  // Ler query params na inicialização (drill-down)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origem = params.get('origem');
    
    if (origem === 'planejado_vs_real') {
      const obraId = params.get('obra_id');
      const status = params.get('status'); // 'pago' para receita
      
      if (obraId) {
        setFiltros(prev => ({
          ...prev,
          obra_id: obraId,
          ...(status && { status })
        }));
        setMostrarBanner(true);
      }
    }
  }, []);

  // Buscar contas a receber
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-receber'],
    queryFn: () => base44.entities.ContaFinanceira.filter({ tipo: 'receber' })
  });

  // Buscar obras
  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Buscar clientes
  const { data: clientes } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => base44.entities.Cliente.list()
  });

  // Empresas do grupo — para mostrar qual empresa recebe o valor (deriva da obra do título).
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => base44.entities.Empresa.list().catch(() => [])
  });
  const empresaDaConta = (conta) => {
    const eid = conta?.empresa_id || obras?.find((o) => o.id === conta?.obra_id)?.empresa_id;
    return (eid && empresas.find((e) => e.id === eid)?.nome) || '—';
  };

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra filtrada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras?.find((o) => o.id === filtros.obra_id)?.empresa_id);

  // Atualizar nome da obra no banner
  useEffect(() => {
    if (filtros.obra_id && obras) {
      const obra = obras.find(o => o.id === filtros.obra_id);
      if (obra) setObraBannerNome(obra.nome);
    }
  }, [filtros.obra_id, obras]);

  // Criar conta via backend (validação obra_id)
  const salvarMutation = useMutation({
    mutationFn: (data) => {
      if (contaSelecionada?.id) {
        return base44.functions.invoke('editarContaReceber', {
          conta_id: contaSelecionada.id,
          valor: data.valor,
          vencimento: data.data_vencimento,
          status: data.status,
          observacao: data.observacao
        });
      } else {
        return base44.functions.invoke('criarContaReceber', data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['contas-receber']);
      setModalForm(false);
      setContaSelecionada(null);
      toast.success(contaSelecionada?.id ? 'Título atualizado com sucesso' : 'Título criado com sucesso');
    },
    onError: (error) => {
      const msg = error.response?.data?.error || error.message || 'Erro ao criar título';
      toast.error(msg);
    }
  });

  // Dar baixa
  const baixaMutation = useMutation({
    mutationFn: (data) => base44.functions.invoke('darBaixaRecebimento', {
      conta_id: contaSelecionada.id,
      ...data
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries(['contas-receber']);
      setModalBaixa(false);
      setContaSelecionada(null);
      toast.success(result.data.message);
    },
    onError: (error) => {
      toast.error(error.message || 'Erro ao processar baixa');
    }
  });

  // Rótulo de status para o Excel (mesma regra do badge da tela).
  const statusLabelDe = (c) => {
    if (c._vencido && c.status === 'pendente') return 'Vencido';
    const labels = { pendente: 'Pendente', parcial: 'Parcial', recebido: 'Recebido', pago: 'Recebido', atrasado: 'Vencido', cancelado: 'Cancelado' };
    return labels[c.status] || c.status || '—';
  };
  const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

  // Exporta EXCEL branded com exatamente o que está filtrado na tela.
  const exportarExcel = () => {
    if (!contasFiltradas.length) { toast.error('Nenhum dado para exportar'); return; }
    try {
      const obraNome = (id) => obras?.find((o) => o.id === id)?.nome || '';
      exportarXLSXBranded(`contas_receber_${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Contas a Receber',
        titulo: 'Contas a Receber',
        subtitulo: `${contasFiltradas.length} título(s)` + (filtros.obra_id ? ` · ${obraNome(filtros.obra_id)}` : ''),
        headers: ['Vencimento', 'Descrição', 'Cliente', 'Empresa', 'Categoria', 'Valor', 'Status', 'Recebimento', 'Obra'],
        rows: contasFiltradas.map((c) => [
          dataBR(c.data_vencimento),
          c.descricao || '',
          c.fornecedor_cliente || '',
          empresaDaConta(c),
          (c.categoria || '').replace(/_/g, ' '),
          Number(c.valor) || 0,
          statusLabelDe(c),
          dataBR(c.data_pagamento || c.data_recebimento),
          obraNome(c.obra_id),
        ]),
        moeda: [5],
      }], { empresa, branding });
      toast.success('Excel exportado');
    } catch (e) {
      toast.error('Erro ao exportar: ' + (e?.message || 'tente novamente'));
    }
  };

  // Filtrar e paginar
  const contasFiltradas = useMemo(() => {
    if (!contas) return [];

    let resultado = [...contas];

    // Aplicar filtros
    if (filtros.obra_id) {
      resultado = resultado.filter(c => c.obra_id === filtros.obra_id);
    }
    if (filtros.cliente_id) {
      resultado = resultado.filter(c => c.cliente_id === filtros.cliente_id);
    }
    if (filtros.status) {
      resultado = resultado.filter(c => c.status === filtros.status);
    }
    if (filtros.forma_pagamento) {
      resultado = resultado.filter(c => c.forma_pagamento === filtros.forma_pagamento);
    }
    if (filtros.data_vencimento_de) {
      resultado = resultado.filter(c => c.data_vencimento >= filtros.data_vencimento_de);
    }
    if (filtros.data_vencimento_ate) {
      resultado = resultado.filter(c => c.data_vencimento <= filtros.data_vencimento_ate);
    }
    if (filtros.valor_min) {
      resultado = resultado.filter(c => c.valor >= filtros.valor_min);
    }
    if (filtros.valor_max) {
      resultado = resultado.filter(c => c.valor <= filtros.valor_max);
    }
    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(c =>
        c.descricao?.toLowerCase().includes(busca) ||
        c.fornecedor_cliente?.toLowerCase().includes(busca) ||
        c.referencia_tipo?.toLowerCase().includes(busca)
      );
    }

    // Verificar vencidos
    const hoje = new Date().toISOString().split('T')[0];
    resultado = resultado.map(c => ({
      ...c,
      _vencido: c.status === 'pendente' && c.data_vencimento < hoje
    }));

    // Ordenar por vencimento
    // Mais recém-criadas no topo: um título recém-gerado (ex.: ao aprovar uma BM)
    // aparece logo no início. Desempate por vencimento (mais próximo antes).
    resultado.sort((a, b) => {
      const dc = new Date(b.created_date || 0) - new Date(a.created_date || 0);
      if (dc !== 0) return dc;
      return new Date(a.data_vencimento || 0) - new Date(b.data_vencimento || 0);
    });

    return resultado;
  }, [contas, filtros]);

  // Paginar (volta à página 1 quando os filtros mudam)
  useEffect(() => { setPaginaAtual(1); }, [filtros]);
  const totalPaginas = Math.ceil(contasFiltradas.length / itensPorPagina);
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const contasPaginadas = contasFiltradas.slice(inicio, inicio + itensPorPagina);

  // Calcular totais
  const totais = useMemo(() => {
    // Não contar títulos cancelados nos totais (inflavam "Total a Receber"/"Pendente").
    const ativas = contasFiltradas.filter((c) => c.status !== 'cancelado');
    const total = ativas.reduce((s, c) => s + (c.valor || 0), 0);
    const recebido = ativas.reduce((s, c) => s + (c.valor_recebido || 0), 0);
    const pendente = total - recebido;
    return { total, recebido, pendente };
  }, [contasFiltradas]);

  const getStatusBadge = (conta) => {
    if (conta._vencido && conta.status === 'pendente') {
      return <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>;
    }
    const config = {
      pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
      parcial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700' },
      recebido: { label: 'Recebido', className: 'bg-green-100 text-green-700' },
      pago: { label: 'Recebido', className: 'bg-green-100 text-green-700' },
      atrasado: { label: 'Vencido', className: 'bg-red-100 text-red-700' },
      cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' }
    };
    const { label, className } = config[conta.status] || config.pendente;
    return <Badge className={`${className} border-0`}>{label}</Badge>;
  };

  const limparFiltrosBanner = () => {
    setFiltros({});
    setMostrarBanner(false);
    setPaginaAtual(1);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const content = (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-6"}>
      {/* Header */}
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Receber</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de títulos e recebimentos</p>
        </div>
      )}

      {/* Banner de filtro aplicado */}
      {mostrarBanner && (
        <FiltroAplicadoBanner
          obraNome={obraBannerNome}
          dataInicio={filtros.data_vencimento_de}
          dataFim={filtros.data_vencimento_ate}
          onLimpar={limparFiltrosBanner}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">Total a Receber</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{fmtBRL(totais.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">Total Recebido</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{fmtBRL(totais.recebido)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-gray-500">Pendente</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{fmtBRL(totais.pendente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-gray-600">
          {contasFiltradas.length} título(s) encontrado(s)
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={exportarExcel} className="w-full sm:w-auto border-gray-300 text-gray-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
          <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700" onClick={() => { setContaSelecionada(null); setModalForm(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Título
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosContasReceber
        filtros={filtros}
        setFiltros={setFiltros}
        obras={obras}
        clientes={clientes}
      />

      {/* Tabela (desktop) / Cards (mobile) */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton bare rows={6} cols={8} /></div>
          ) : contasPaginadas.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              Nenhuma conta encontrada
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Vencimento</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Empresa</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor Total</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Recebido</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Pendente</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasPaginadas.map(conta => {
                    const valorRestante = (conta.valor || 0) - (conta.valor_recebido || 0);
                    return (
                      <tr key={conta.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-gray-700">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-900 max-w-[260px]">
                          <span className="line-clamp-2" title={conta.descricao}>{conta.descricao}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{conta.fornecedor_cliente || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{empresaDaConta(conta)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                          {fmtBRL(conta.valor)}
                        </td>
                        <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap tabular-nums">
                          {fmtBRL(conta.valor_recebido)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-600 whitespace-nowrap tabular-nums">
                          {fmtBRL(valorRestante)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {getStatusBadge(conta)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center whitespace-nowrap">
                            {(conta.status === 'pendente' || conta.status === 'parcial') && (
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 h-8"
                                onClick={() => { setContaSelecionada(conta); setModalBaixa(true); }}
                              >
                                <DollarSign className="w-4 h-4 mr-1" />
                                Dar Baixa
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

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {contasPaginadas.map(conta => {
                  const valorRestante = (conta.valor || 0) - (conta.valor_recebido || 0);
                  const vencido = conta._vencido && conta.status === 'pendente';
                  return (
                    <div key={conta.id} className={`p-3 rounded-lg border space-y-2 ${vencido ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 break-words min-w-0" title={conta.descricao}>{conta.descricao || '—'}</p>
                        {getStatusBadge(conta)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500">
                        {conta.fornecedor_cliente && <span className="break-words">{conta.fornecedor_cliente}</span>}
                        <span className="text-gray-400">·</span>
                        <span className="break-words font-medium text-gray-600">{empresaDaConta(conta)}</span>
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs text-gray-500"><Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" /> Venc.: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</div>
                        <p className="text-base font-bold text-gray-900 tabular-nums shrink-0">{fmtBRL(conta.valor)}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                        <div><span className="text-gray-500">Recebido</span><p className="font-medium text-green-600 tabular-nums">{fmtBRL(conta.valor_recebido)}</p></div>
                        <div className="text-right"><span className="text-gray-500">Pendente</span><p className="font-semibold text-orange-600 tabular-nums">{fmtBRL(valorRestante)}</p></div>
                      </div>
                      {(conta.status === 'pendente' || conta.status === 'parcial') && (
                        <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 h-8 gap-1" onClick={() => { setContaSelecionada(conta); setModalBaixa(true); }}>
                          <DollarSign className="w-4 h-4" /> Dar Baixa
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Paginação (padrão do sistema) */}
          <Pagination
            currentPage={paginaAtual}
            totalPages={totalPaginas}
            onPageChange={setPaginaAtual}
            startIndex={inicio}
            endIndex={Math.min(inicio + itensPorPagina, contasFiltradas.length)}
            totalItems={contasFiltradas.length}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      {modalForm && (
        <FormContaReceber
          open={modalForm}
          onClose={() => setModalForm(false)}
          conta={contaSelecionada}
          onSave={(data) => salvarMutation.mutate(data)}
          obras={obras}
          clientes={clientes}
        />
      )}

      {modalBaixa && contaSelecionada && (
        <DialogBaixaRecebimento
          open={modalBaixa}
          onClose={() => { setModalBaixa(false); setContaSelecionada(null); }}
          conta={contaSelecionada}
          onConfirm={(data) => baixaMutation.mutate(data)}
        />
      )}
    </div>
  );

  if (embedded) return content;
  return <RequireRole allowedRoles={['diretor', 'financeiro']}>{content}</RequireRole>;
}