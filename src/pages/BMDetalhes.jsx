/**
 * BMDetalhes: Tela nativa de edição de BM
 * Motor completo de cálculo via calcBMv2
 */

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/shared/Skeletons';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { ArrowLeft, Save, CheckCircle, RotateCcw, Settings, Download, ExternalLink, Loader2, AlertTriangle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BMResumoTopo from '@/components/medicao/BMResumoTopo';
import BMPlanilhaRow from '@/components/medicao/BMPlanilhaRow';
import BMPlanilhaCard from '@/components/medicao/BMPlanilhaCard';
import BMPlanilhaFooter from '@/components/medicao/BMPlanilhaFooter';
import BMPreviewBanner from '@/components/medicao/BMPreviewBanner';
import ConfigDescontosRetencoes from '@/components/medicao/ConfigDescontosRetencoes';
import BMItensVazio from '@/components/medicao/BMItensVazio';
import RouteGuardWithFallback from '@/components/layout/RouteGuardWithFallback';
import { gerarBoletimMedicaoPDF } from '@/lib/boletimMedicaoPdf';
import { useEmpresaBranding } from '@/components/shared/useBranding';

export default function BMDetalhesPage() {
  return (
    <RouteGuardWithFallback requiredPermissionKey="MEDICOES_VIEW">
      <BMDetalhesContent />
    </RouteGuardWithFallback>
  );
}

function BMDetalhesContent() {
  const urlParams = new URLSearchParams(window.location.search);
  const bmId = urlParams.get('bm_id');
  const queryClient = useQueryClient();

  const [calcData, setCalcData] = useState(null);
  const [unsavedChanges, setUnsavedChanges] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [pagItens, setPagItens] = useState(1);
  const POR_PAGINA_ITENS = 15;

  // Buscar BM
  const { data: bm, isLoading: bmLoading, error: bmError } = useQuery({
    queryKey: ['bm', bmId],
    queryFn: () => base44.entities.BM.filter({ id: bmId }).then(r => r?.[0]),
    enabled: !!bmId,
  });

  // Buscar cálculo inicial
  const { data: initialCalc, isLoading: calcLoading, error: calcError } = useQuery({
    queryKey: ['calcBMv2', bmId],
    queryFn: () => base44.functions.invoke('calcBMv2', { bm_id: bmId }),
    enabled: !!bmId && !bmLoading,
    select: (response) => response.data,
  });

  // Buscar totais da última BM APROVADA (para comparativo preview vs oficial)
  const { data: aprovadoTotals } = useQuery({
    queryKey: ['bm-aprovada-totals', bm?.obra_id, bm?.contrato_versao_id],
    queryFn: async () => {
      const bmsAprovadas = await base44.entities.BM.filter({
        obra_id: bm.obra_id,
        contrato_versao_id: bm.contrato_versao_id,
        status: 'APROVADA'
      });
      if (!bmsAprovadas?.length) return null;
      const ultima = bmsAprovadas.sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
      return {
        percent_concluida: ultima.percent_concluida || 0,
        total_acumulado: ultima.total_acumulado || 0,
        total_periodo: ultima.total_periodo || 0,
      };
    },
    enabled: !!bm?.obra_id && !!bm?.contrato_versao_id && bm?.status === 'RASCUNHO',
  });

  // Obra + config financeira + branding, para o Boletim de Medição em PDF.
  const { data: obra } = useQuery({
    queryKey: ['obra', bm?.obra_id],
    queryFn: () => base44.entities.Obra.filter({ id: bm.obra_id }).then(r => r?.[0]),
    enabled: !!bm?.obra_id,
  });
  const { empresa, branding } = useEmpresaBranding(obra?.empresa_id);
  const { data: configMedicao } = useQuery({
    queryKey: ['config-medicao-bm', bm?.obra_id, bm?.contrato_versao_id],
    queryFn: async () => {
      const c = await base44.entities.ConfiguracaoMedicao.filter({ obra_id: bm.obra_id, contrato_versao_id: bm.contrato_versao_id });
      return c?.[0] || (await base44.entities.ConfiguracaoMedicao.filter({ obra_id: bm.obra_id }))?.[0] || null;
    },
    enabled: !!bm?.obra_id,
  });

  // Gera o Boletim de Medição em PDF (branded) a partir da fonte canônica BM/BMItem.
  const gerarBoletim = async () => {
    try {
      if (!calcData?.items?.length) { toast.error('BM sem itens para gerar o boletim.'); return; }
      const t = calcData.totals || {};
      const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
      const bruto = Number(t.total_periodo) || 0;
      const cfgAtiva = configMedicao ? configMedicao.ativo !== false : false;
      const pctDesc = cfgAtiva ? (Number(configMedicao.percentual_desconto) || 0) : 0;
      const pctRet = cfgAtiva ? (Number(configMedicao.percentual_retencao) || 0) : 0;
      const valorDesconto = r2(bruto * (pctDesc / 100));
      const baseAposDesc = r2(bruto - valorDesconto);
      const valorRetido = r2(baseAposDesc * (pctRet / 100));
      const tc = Number(t.total_contrato) || 0;
      const medicao = {
        numero: bm.numero,
        status: bm.status,
        periodo_inicio: bm.data_inicio,
        periodo_fim: bm.data_fim,
        data_medicao: bm.data_aprovacao || bm.data_fim,
        responsavel_email: bm.aprovada_por || bm.created_by || '',
        percentual_fisico_anterior: tc > 0 ? (Number(t.total_anterior) / tc) * 100 : 0,
        percentual_fisico_periodo: tc > 0 ? (bruto / tc) * 100 : 0,
        percentual_fisico_acumulado: Number(t.percent_concluida) || 0,
        valor_medido: bruto,
        total_descontos: valorDesconto,
        total_retencoes: valorRetido,
        valor_liquido: r2(baseAposDesc - valorRetido),
        observacoes: bm.observacao_auditoria || '',
      };
      const itens = calcData.items.map((it) => ({
        descricao: it.item_label || it.descricao,
        unidade: it.unidade,
        quantidade_prevista: it.qtd_contrato,
        quantidade_anterior: it.qtd_anterior,
        quantidade_periodo: it.qtd_periodo_final,
        quantidade_acumulada: it.qtd_acumulada,
        percentual_executado: it.percent_fisico_item,
        valor_unitario: it.preco_unit_com_bdi,
        valor_periodo: it.vl_periodo,
      }));
      await gerarBoletimMedicaoPDF({ medicao, itens, obra: obra || {}, empresa, branding });
    } catch (e) {
      toast.error('Erro ao gerar boletim: ' + (e?.message || 'tente novamente'));
    }
  };

  useEffect(() => {
    if (initialCalc) {
      setCalcData(initialCalc);
      setValidationErrors(initialCalc.validation_errors || []);
    }
  }, [initialCalc]);

  // Mutation para salvar mudanças
  const saveMutation = useMutation({
    mutationFn: async () => {
      const overrides = Object.values(unsavedChanges);
      const response = await base44.functions.invoke('calcBMv2', {
        bm_id: bmId,
        persist: true,
        items_override: overrides
      });
      return response.data;
    },
    onSuccess: (data) => {
      setCalcData(data);
      setUnsavedChanges({});
      setValidationErrors(data.validation_errors || []);
      queryClient.invalidateQueries({ queryKey: ['bm', bmId] });
      queryClient.invalidateQueries({ queryKey: ['calcBMv2', bmId] });
      if (data.validation_errors?.length > 0) {
        toast.info(`BM salva. ${data.validation_errors.length} item(s) ajustado(s) ao saldo do contrato.`);
      } else {
        toast.success('BM salva com sucesso!');
      }
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  // Mutation para aprovar (com integração financeira)
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (Object.keys(unsavedChanges).length > 0) {
        await saveMutation.mutateAsync();
      }
      // Chamar orquestrador com integração financeira
      const result = await base44.functions.invoke('onBMApproveWithFinance', {
        bm_id: bmId,
        observacao_auditoria: `BM #${bm?.numero} aprovada pelo usuário`
      });
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bm', bmId] });
      const msg = data.conta_receber_id 
        ? `BM aprovada! ContaReceber #${data.conta_receber_id} gerada (R$ ${data.conta_receber_valor?.toFixed(2)})`
        : 'BM aprovada!';
      toast.success(msg);
    },
    onError: (error) => {
      toast.error(`Erro ao aprovar: ${error.message}`);
    }
  });

  const handleItemUpdate = (update) => {
    setUnsavedChanges(prev => ({
      ...prev,
      [update.contrato_item_id]: update
    }));
    
    // Recalcular localmente
    if (calcData) {
      const updatedItems = calcData.items.map(it => 
        it.contrato_item_id === update.contrato_item_id 
          ? { ...it, qtd_periodo_input: update.qtd_periodo_input, override_manual: update.override_manual }
          : it
      );
      setCalcData(prev => ({ ...prev, items: updatedItems }));
    }
  };

  if (!bmId) {
    return (
      <div className="text-center text-gray-600 py-10">
        BM ID não fornecido. Volte e selecione uma medição.
      </div>
    );
  }

  if (bmLoading || calcLoading) {
    return <PageSkeleton kpis={4} rows={8} cols={6} />;
  }

  if (bmError || calcError) {
    return (
      <div className="text-center text-red-600 py-10">
        Erro ao carregar: {bmError?.message || calcError?.message}
      </div>
    );
  }

  if (!bm || !calcData) {
    return (
      <div className="text-center text-gray-600 py-10">
        Medição não encontrada.
      </div>
    );
  }

  const isReadOnly = bm.status === 'APROVADA';

  // Paginação dos itens da medição (totais no rodapé continuam sobre TODOS os itens).
  const totalItens = calcData.items.length;
  const totalPaginasItens = Math.max(1, Math.ceil(totalItens / POR_PAGINA_ITENS));
  const pagAtualItens = Math.min(pagItens, totalPaginasItens);
  const itensPagina = calcData.items.slice((pagAtualItens - 1) * POR_PAGINA_ITENS, pagAtualItens * POR_PAGINA_ITENS);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Medição BM #{bm.numero}</h1>
            <p className="text-sm text-gray-600">
              {bm.data_inicio && new Date(bm.data_inicio).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={gerarBoletim} className="gap-2 border-gray-300 text-gray-700">
            <Download className="w-4 h-4" />
            Boletim PDF
          </Button>
          {!isReadOnly && (
            <>
              <Button 
                onClick={() => saveMutation.mutate()}
                disabled={Object.keys(unsavedChanges).length === 0 || saveMutation.isPending}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </Button>
              <Button 
                onClick={() => {
                  if (!calcData?.items?.length) {
                    toast.error('Não é possível aprovar uma BM sem itens.');
                    return;
                  }
                  approveMutation.mutate();
                }}
                disabled={approveMutation.isPending || !calcData?.items?.length}
                variant="default"
                className="gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4" />
                Aprovar
              </Button>
            </>
          )}
          {bm && bm.status === 'APROVADA' && (
            <Button 
              onClick={() => {
                window.location.href = `?page=RetificarBM&bm_id=${bm.id}`;
              }}
              variant="outline"
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Retificar
            </Button>
          )}
        </div>
      </div>

      {/* Banner OFICIAL vs PREVIEW */}
      <BMPreviewBanner
        bm={bm}
        totals={calcData.totals}
        aprovadoTotals={aprovadoTotals}
      />

      {/* Resumo */}
      <BMResumoTopo bm={bm} totals={calcData.totals} loading={saveMutation.isPending} />

      {/* Tabs: Detalhes, Itens, IA, Financeiro */}
      <Tabs defaultValue="detalhes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="financeiro" className="flex items-center gap-1">
            <Settings className="w-4 h-4" /> Financeiro
          </TabsTrigger>
        </TabsList>

        {/* TAB: Detalhes */}
        <TabsContent value="detalhes" className="space-y-4">
          {calcData.groups && calcData.groups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Evolução por Etapa</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop: tabela */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead className="bg-gray-100 border-b border-gray-200 text-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Etapa</th>
                        <th className="px-4 py-3 text-right font-semibold">Peso</th>
                        <th className="px-4 py-3 text-right font-semibold">Anterior</th>
                        <th className="px-4 py-3 text-right font-semibold">Período</th>
                        <th className="px-4 py-3 text-right font-semibold">Acumulado</th>
                        <th className="px-4 py-3 text-right font-semibold">Saldo</th>
                        <th className="px-4 py-3 text-right font-semibold">% Concluída</th>
                      </tr>
                    </thead>
                    <tbody>
                      {calcData.groups.map((g, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{g.grupo}</td>
                          <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{(g.peso_percentual || 0).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{g.vl_anterior.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-gray-800 tabular-nums">{g.vl_periodo.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">{g.vl_acumulado.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-red-600 tabular-nums">{g.vl_saldo.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800 tabular-nums">{(g.percent_concluida || 0).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile: cards por etapa */}
                <div className="md:hidden divide-y divide-gray-100">
                  {calcData.groups.map((g, idx) => (
                    <div key={idx} className="p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-800">{g.grupo}</span>
                        <span className="font-semibold text-gray-800 tabular-nums">{(g.percent_concluida || 0).toFixed(2)}%</span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                        <div className="flex justify-between gap-2"><span className="text-gray-500">Peso</span><span className="tabular-nums">{(g.peso_percentual || 0).toFixed(2)}%</span></div>
                        <div className="flex justify-between gap-2"><span className="text-gray-500">Anterior</span><span className="tabular-nums text-gray-600">{g.vl_anterior.toFixed(2)}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-gray-500">Período</span><span className="tabular-nums text-gray-800">{g.vl_periodo.toFixed(2)}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-gray-500">Acumulado</span><span className="tabular-nums text-emerald-600 font-semibold">{g.vl_acumulado.toFixed(2)}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-gray-500">Saldo</span><span className="tabular-nums text-red-600">{g.vl_saldo.toFixed(2)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Itens */}
        <TabsContent value="itens" className="space-y-4">
          {/* Aviso informativo (itens ajustados ao saldo) */}
          {validationErrors.length > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sky-800 font-semibold text-sm">
                <Info className="w-4 h-4" />
                {validationErrors.length} item(s) ajustado(s) ao saldo do contrato
              </div>
              <ul className="text-xs text-sky-700 space-y-1 ml-6 list-disc">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err.mensagem}</li>
                ))}
              </ul>
              <p className="text-xs text-sky-700 mt-2">
                O motor de cálculo ajustou automaticamente as quantidades ao saldo disponível.
                Para medir acima do contrato, é necessário um aditivo contratual.
              </p>
            </div>
          )}

          {calcData.items?.length === 0 ? (
            <BMItensVazio
              bm={bm}
              diagnostico={calcData.diagnostico}
              onPreloadSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ['calcBMv2', bmId] });
                queryClient.invalidateQueries({ queryKey: ['bm', bmId] });
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">
                    Itens da Medição
                    <span className="ml-2 text-xs text-gray-500 font-normal">({calcData.items.length} itens)</span>
                  </CardTitle>
                  {Object.keys(unsavedChanges).length > 0 && (
                    <span className="text-xs text-orange-600 font-semibold">
                      ● {Object.keys(unsavedChanges).length} item(s) alterado(s)
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Desktop: planilha completa (tabela larga com rolagem) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm border-collapse min-w-[960px]">
                    <thead className="bg-gray-100 border-b border-gray-200 sticky top-0 z-10 text-gray-700">
                      <tr>
                        <th className="px-3 py-3 text-left font-semibold">Cód</th>
                        <th className="px-3 py-3 text-left font-semibold">Descrição</th>
                        <th className="px-3 py-3 text-right font-semibold">Peso</th>
                        <th colSpan="2" className="text-center font-semibold bg-blue-50 border-l border-blue-200 py-3">Contrato (Qtd · P.Unit)</th>
                        <th colSpan="2" className="text-center font-semibold bg-gray-50 border-l border-gray-200 py-3">Anterior (Qtd · R$)</th>
                        {/* Quem se digita agora é o ACUMULADO (total executado até
                            aqui); o Período é a diferença, calculada. */}
                        <th colSpan="2" className="text-center font-semibold bg-yellow-50 border-l border-yellow-200 py-3">
                          Período (Qtd · R$)
                          <span className="block text-[10px] font-normal text-gray-500">calculado</span>
                        </th>
                        <th colSpan="2" className="text-center font-semibold bg-green-50 border-l border-green-200 py-3">
                          Acumulado (Qtd · R$)
                          <span className="block text-[10px] font-normal text-green-700">total executado — digite aqui</span>
                        </th>
                        <th colSpan="2" className="text-center font-semibold bg-red-50 border-l border-red-200 py-3">Saldo (Qtd · R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensPagina.map((item) => (
                        <BMPlanilhaRow
                          key={item.contrato_item_id}
                          item={item}
                          onUpdate={handleItemUpdate}
                          readOnly={isReadOnly}
                        />
                      ))}
                    </tbody>
                    <BMPlanilhaFooter
                      totals={calcData.totals}
                      hasChanges={Object.keys(unsavedChanges).length > 0}
                      isPreview={bm.status === 'RASCUNHO'}
                    />
                  </table>
                </div>

                {/* Mobile: cards editáveis (mesma lógica de edição da planilha).
                    Os totais ficam no Resumo do topo — não repete rodapé aqui. */}
                <div className="md:hidden p-3 space-y-2">
                  {itensPagina.map((item) => (
                    <BMPlanilhaCard
                      key={item.contrato_item_id}
                      item={item}
                      onUpdate={handleItemUpdate}
                      readOnly={isReadOnly}
                    />
                  ))}
                </div>

                {/* Paginação */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 border-t border-gray-200">
                  <span className="text-xs text-gray-500">
                    {totalItens === 0 ? 'Nenhum item' : `Mostrando ${(pagAtualItens - 1) * POR_PAGINA_ITENS + 1}–${Math.min(pagAtualItens * POR_PAGINA_ITENS, totalItens)} de ${totalItens} itens`}
                  </span>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPagItens(p => Math.max(1, p - 1))} disabled={pagAtualItens <= 1} className="h-8 gap-1 border-gray-300 text-gray-700">
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </Button>
                    <span className="text-xs text-gray-600">Página {pagAtualItens} de {totalPaginasItens}</span>
                    <Button variant="outline" size="sm" onClick={() => setPagItens(p => Math.min(totalPaginasItens, p + 1))} disabled={pagAtualItens >= totalPaginasItens} className="h-8 gap-1 border-gray-300 text-gray-700">
                      Próxima <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB: Financeiro */}
        <TabsContent value="financeiro" className="space-y-4">
          <ConfigDescontosRetencoes 
            obra_id={bm?.obra_id}
            contrato_versao_id={bm?.contrato_versao_id}
          />
        </TabsContent>
      </Tabs>

      {/* Info */}
      {isReadOnly && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <strong>BM Aprovada:</strong> Esta medição está aprovada e bloqueada para edição. 
          Para corrigir, crie uma retificação.
        </div>
      )}
    </div>
  );
}