import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import RequireRole from '../components/auth/RequireRole';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Download, Calendar, AlertCircle, CheckCircle2, CreditCard, FileText, List } from 'lucide-react';
import { toast } from 'sonner';
import Pagination from '@/components/shared/Pagination';
import { exportarXLSXBranded } from '@/lib/xlsxBrand';
import { useEmpresaBranding } from '@/components/shared/useBranding';

import FiltrosContasPagar from '../components/financeiro/FiltrosContasPagar';
import FiltroAplicadoBanner from '../components/shared/FiltroAplicadoBanner';
import ContaPagarModal from '../components/financeiro/ContaPagarModal';
import PagamentoContaModal from '../components/financeiro/PagamentoContaModal';
import BotaoAnexarNFGasto from '../components/documentos-fiscais/BotaoAnexarNFGasto';
import BadgeStatusNF from '../components/documentos-fiscais/BadgeStatusNF';
import BoletoFormModal from '../components/boletos/BoletoFormModal';
import { TableSkeleton } from '@/components/shared/Skeletons';

const fmtBRL = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContasPagar({ embedded = false }) {
  const [filtros, setFiltros] = useState({});
  const [activeTab, setActiveTab] = useState('contas');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [obraBannerNome, setObraBannerNome] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState(null);
  const [pagamentoModal, setPagamentoModal] = useState({ open: false, conta: null });
  const [boletoModalOpen, setBoletoModalOpen] = useState(false);
  const [user, setUser] = useState(null);

  const queryClient = useQueryClient();
  const itensPorPagina = 20;

  // Ler query params na inicialização (drill-down)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const origem = params.get('origem');
    
    if (origem === 'planejado_vs_real') {
      const obraId = params.get('obra_id');
      
      if (obraId) {
        setFiltros(prev => ({
          ...prev,
          obra_id: obraId
        }));
        setMostrarBanner(true);
      }
    }
  }, []);

  // Buscar contas a pagar
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-pagar'],
    queryFn: () => base44.entities.ContaFinanceira.filter({ tipo: 'pagar' })
  });

  // Buscar obras
  const { data: obras } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  // Empresa/branding p/ o cabeçalho do Excel (empresa da obra filtrada; senão matriz).
  const { empresa, branding } = useEmpresaBranding(obras?.find((o) => o.id === filtros.obra_id)?.empresa_id);

  // Buscar usuário (para verificar permissão)
  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  // Atualizar nome da obra no banner
  useEffect(() => {
    if (filtros.obra_id && obras) {
      const obra = obras.find(o => o.id === filtros.obra_id);
      if (obra) setObraBannerNome(obra.nome);
    }
  }, [filtros.obra_id, obras]);

  // Rótulo de status para o Excel (mesma regra do badge da tela).
  const statusLabelDe = (c) => {
    if (c._vencido && c.status === 'pendente') return 'Vencido';
    const labels = { pendente: 'Pendente', em_aprovacao: 'Em Aprovação', parcial: 'Parcial', pago: 'Pago', reprovada: 'Reprovada', atrasado: 'Atrasado', cancelado: 'Cancelado' };
    return labels[c.status] || c.status || '—';
  };
  const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '');

  // Exporta EXCEL branded com exatamente o que está filtrado na tela.
  const exportarExcel = () => {
    if (!contasFiltradas.length) { toast.error('Nenhuma conta para exportar'); return; }
    try {
      const obraNome = (id) => obras?.find((o) => o.id === id)?.nome || '';
      exportarXLSXBranded(`contas_pagar_${new Date().toISOString().split('T')[0]}`, [{
        nome: 'Contas a Pagar',
        titulo: 'Contas a Pagar',
        subtitulo: `${contasFiltradas.length} conta(s)` + (filtros.obra_id ? ` · ${obraNome(filtros.obra_id)}` : ''),
        headers: ['Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Valor', 'Status', 'Pagamento', 'Obra'],
        rows: contasFiltradas.map((c) => [
          dataBR(c.data_vencimento),
          c.descricao || '',
          c.fornecedor_cliente || '',
          (c.categoria || '').replace(/_/g, ' '),
          Number(c.valor) || 0,
          statusLabelDe(c),
          dataBR(c.data_pagamento),
          obraNome(c.obra_id),
        ]),
        moeda: [4],
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
    if (filtros.status) {
      resultado = resultado.filter(c => c.status === filtros.status);
    }
    if (filtros.categoria) {
      resultado = resultado.filter(c => c.categoria === filtros.categoria);
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

    // Mais recém-criadas no topo: uma conta acabada de lançar (folha, manual, etc.)
    // aparece imediatamente no início da lista. Desempate por vencimento (mais próximo antes).
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

  const getStatusBadge = (conta) => {
    if (conta._vencido && conta.status === 'pendente') {
      return <Badge className="bg-red-100 text-red-700 border-0">Vencido</Badge>;
    }
    const config = {
      pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
      em_aprovacao: { label: 'Em Aprovação', className: 'bg-orange-100 text-orange-700' },
      parcial: { label: 'Parcial', className: 'bg-blue-100 text-blue-700' },
      pago: { label: 'Pago', className: 'bg-green-100 text-green-700' },
      reprovada: { label: 'Reprovada', className: 'bg-red-100 text-red-700' },
      atrasado: { label: 'Atrasado', className: 'bg-red-100 text-red-700' },
      cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-600' }
    };
    const { label, className } = config[conta.status] || config.pendente;
    return <Badge className={`${className} border-0`}>{label}</Badge>;
  };

  const solicitarAprovacaoMutation = useMutation({
    mutationFn: (contaId) => base44.functions.invoke('solicitarAprovacaoPagamento', { conta_id: contaId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      const msg = res.data?.branch === 'DIRECT_ALLOWED' ? 'Pronto para pagamento' : 'Enviado para aprovação (alçada)';
      toast.success(msg);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    }
  });

  const pagarMutation = useMutation({
    mutationFn: (contaId) => base44.functions.invoke('pagarContaPagar', { conta_id: contaId }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
      toast.success('Pagamento registrado com sucesso!');
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message;
      toast.error(msg);
    }
  });

  // Quem tem alçada direta (FINANCEIRO_APPROVE) paga a conta pendente sem etapa de aprovação —
  // para esses, "Aprovar" numa conta pendente é no-op e só confunde. Mostramos "Aprovar" a eles
  // apenas em contas 'em_aprovacao' (para liberar). Já quem NÃO tem alçada vê "Solicitar aprovação"
  // nas pendentes (roteia as que excedem o limite).
  const podeAprovarDireto = ['admin', 'financeiro', 'programador'].includes(user?.role) || !!user?.acesso_global;

  // Quem pode criar/editar a conta. Antes era só diretor/financeiro — o admin ficava
  // de fora e o modal abria inteiro em somente-leitura (campos e Salvar desabilitados).
  const podeEditarConta = ['admin', 'programador', 'admin_empresa', 'diretor', 'financeiro'].includes(
    String(user?.role || '').toLowerCase()
  ) || !!user?.acesso_global;

  const limparFiltrosBanner = () => {
    setFiltros({});
    setMostrarBanner(false);
    setPaginaAtual(1);
    window.history.replaceState({}, '', window.location.pathname);
  };

  // Ler tab da URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = params.get('tab');
    if (tabFromUrl === 'boletos') setActiveTab('boletos');
  }, []);

  const content = (
    <div className={embedded ? "space-y-6" : "space-y-6 pb-6"}>
      {/* Header */}
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contas a Pagar</h1>
          <p className="text-gray-500 text-sm mt-1">Gestão de despesas e pagamentos</p>
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

      {/* Ações */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <p className="text-sm text-gray-600">
          {contasFiltradas.length} conta(s) encontrada(s)
        </p>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button
            onClick={() => {
              setContaSelecionada(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta
          </Button>
          <Button
            onClick={() => setBoletoModalOpen(true)}
            variant="outline"
            className="w-full sm:w-auto border-blue-300 text-blue-700 hover:bg-blue-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Novo Boleto
          </Button>
          <Button variant="outline" onClick={exportarExcel} className="w-full sm:w-auto border-gray-300 text-gray-700">
            <Download className="w-4 h-4 mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <FiltrosContasPagar
        filtros={filtros}
        setFiltros={setFiltros}
        obras={obras}
      />

      {/* Tabela (desktop) / Cards (mobile) */}
      <Card className="bg-white border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><TableSkeleton bare rows={6} cols={9} /></div>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">Valor</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">NF</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Pagamento</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasPaginadas.map(conta => (
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
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="capitalize whitespace-nowrap">
                          {conta.categoria?.replace(/_/g, ' ') || '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                        {fmtBRL(conta.valor)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(conta)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <BotaoAnexarNFGasto
                          referencia_tipo="CONTAS_PAGAR"
                          referencia_id={conta.id}
                          referencia_nome={conta.descricao}
                          obra_id={conta.obra_id}
                          podeEditar={podeEditarConta}
                          onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {conta.data_pagamento ? new Date(conta.data_pagamento).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 whitespace-nowrap">
                          {((conta.status === 'pendente' && !podeAprovarDireto) || (conta.status === 'em_aprovacao' && podeAprovarDireto)) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => solicitarAprovacaoMutation.mutate(conta.id)}
                              disabled={solicitarAprovacaoMutation.isPending}
                              className="gap-1 h-8"
                              title={conta.status === 'em_aprovacao' ? 'Aprovar pagamento (alçada)' : 'Solicitar aprovação se exceder a alçada'}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {conta.status === 'em_aprovacao' ? 'Aprovar' : 'Solicitar aprovação'}
                            </Button>
                          )}
                          {(conta.status === 'pendente' || conta.status === 'em_aprovacao') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPagamentoModal({ open: true, conta })}
                              disabled={conta.status === 'em_aprovacao'}
                              className="gap-1 h-8"
                              title={conta.status === 'em_aprovacao' ? 'Aguardando aprovação' : 'Registrar pagamento'}
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              Pagar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setContaSelecionada(conta);
                              setModalOpen(true);
                            }}
                            className="gap-1 h-8"
                          >
                            Editar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Cards (mobile) */}
              <div className="md:hidden flex flex-col gap-2 p-2">
                {contasPaginadas.map(conta => {
                  const vencido = conta._vencido && conta.status === 'pendente';
                  return (
                    <div key={conta.id} className={`p-3 rounded-lg border space-y-2 ${vencido ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-gray-900 break-words min-w-0" title={conta.descricao}>{conta.descricao || '—'}</p>
                        {getStatusBadge(conta)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        {conta.fornecedor_cliente && <span className="break-words">{conta.fornecedor_cliente}</span>}
                        {conta.categoria && <Badge variant="outline" className="capitalize text-xs">{conta.categoria.replace(/_/g, ' ')}</Badge>}
                      </div>
                      <div className="flex items-end justify-between gap-2">
                        <div className="text-xs text-gray-500 min-w-0">
                          <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" /> Venc.: {new Date(conta.data_vencimento).toLocaleDateString('pt-BR')}</div>
                          {conta.data_pagamento && <div className="mt-0.5">Pago: {new Date(conta.data_pagamento).toLocaleDateString('pt-BR')}</div>}
                        </div>
                        <p className="text-base font-bold text-gray-900 tabular-nums shrink-0">{fmtBRL(conta.valor)}</p>
                      </div>
                      <div className="flex items-center flex-wrap gap-1 pt-2 border-t border-gray-100">
                        <BotaoAnexarNFGasto
                          referencia_tipo="CONTAS_PAGAR"
                          referencia_id={conta.id}
                          referencia_nome={conta.descricao}
                          obra_id={conta.obra_id}
                          podeEditar={podeEditarConta}
                          onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); }}
                        />
                        {((conta.status === 'pendente' && !podeAprovarDireto) || (conta.status === 'em_aprovacao' && podeAprovarDireto)) && (
                          <Button size="sm" variant="outline" onClick={() => solicitarAprovacaoMutation.mutate(conta.id)} disabled={solicitarAprovacaoMutation.isPending} className="gap-1 h-8">
                            <CheckCircle2 className="w-3.5 h-3.5" /> {conta.status === 'em_aprovacao' ? 'Aprovar' : 'Solicitar aprovação'}
                          </Button>
                        )}
                        {(conta.status === 'pendente' || conta.status === 'em_aprovacao') && (
                          <Button size="sm" variant="outline" onClick={() => setPagamentoModal({ open: true, conta })} disabled={conta.status === 'em_aprovacao'} className="gap-1 h-8">
                            <CreditCard className="w-3.5 h-3.5" /> Pagar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => { setContaSelecionada(conta); setModalOpen(true); }} className="gap-1 h-8 ml-auto">
                          Editar
                        </Button>
                      </div>
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

      {/* Modal de Conta a Pagar */}
      <ContaPagarModal
        open={modalOpen}
        conta={contaSelecionada}
        onClose={() => {
          setModalOpen(false);
          setContaSelecionada(null);
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['contas-pagar'] });
        }}
        podeEditar={podeEditarConta}
      />

      {/* Modal de Pagamento (escolhe o caixa/banco — baixa o caixa + verba) */}
      <PagamentoContaModal
        open={pagamentoModal.open}
        conta={pagamentoModal.conta}
        onClose={() => setPagamentoModal({ open: false, conta: null })}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })}
      />

      {/* Modal de Boleto (upload + OCR) — cria uma Conta a Pagar forma_pagamento 'boleto' */}
      <BoletoFormModal
        open={boletoModalOpen}
        onClose={() => setBoletoModalOpen(false)}
        boleto={null}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })}
      />

    </div>
  );

  if (embedded) return content;
  return <RequireRole allowedRoles={['diretor', 'financeiro']}>{content}</RequireRole>;
}