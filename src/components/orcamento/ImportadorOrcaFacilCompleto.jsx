import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

import Etapa1SinteticoUpload from './wizard/Etapa1SinteticoUpload';
import Etapa2CronogramaUpload from './wizard/Etapa2CronogramaUpload';
import Etapa4DadosObra from './wizard/Etapa4DadosObra';
import Etapa4Medicoes from './wizard/Etapa4Medicoes';
import Etapa5ReviewFinal from './wizard/Etapa5ReviewFinal';
import TelaSuccesso from './wizard/TelaSuccesso';

// Step 2 = Cronograma, Step 3 = Dados da Obra, Step 4 = Revisão Final
const ETAPAS = [
  { num: 1, titulo: 'Orçamento Sintético' },
  { num: 2, titulo: 'Cronograma' },
  { num: 3, titulo: 'Dados da Obra' },
  { num: 4, titulo: 'Medições' },
  { num: 5, titulo: 'Revisão Final' },
];

export default function ImportadorOrcaFacilCompleto() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [etapaAtual, setEtapaAtual] = useState(1);
  const [importRunId] = useState(() => `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [dadosImportacao, setDadosImportacao] = useState({
    sintetico: null,
    cronograma: null,
    dadosObra: null,
    medicoes: null
  });
  const [obraCriada, setObraCriada] = useState(null);
  const [totalOrcamento, setTotalOrcamento] = useState(null);
  const [etapa3TentouAvancar, setEtapa3TentouAvancar] = useState(false);
  const [validationDetails, setValidationDetails] = useState(null);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const importMutation = useMutation({
    mutationFn: async (dados) => {
      // Extrair payload do fluxo Etapa4DadosObra
      const obraPayloadRaw = dados.dadosObra?.payload || {};
      const obraPayload = {
        ...obraPayloadRaw,
        cliente: obraPayloadRaw.cliente ?? obraPayloadRaw.cliente_nome ?? obraPayloadRaw.client ?? undefined,
        cliente_id: obraPayloadRaw.cliente_id ?? obraPayloadRaw.client_id ?? undefined
      };
      
      // Log de diagnóstico
      console.log('[ImportadorOrcaFacilCompleto] Dados completos antes de enviar:', obraPayload);

      // Montar payload final (compatível com finalizarImportacaoCompleta)
      const toISODate = (v) => {
        if (!v) return null;
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
        const d = new Date(v);
        if (isNaN(d.getTime())) return null;
        return d.toISOString().split('T')[0];
      };
      const periodLabels = dados.cronograma?.periodos_labels || [];
      const obraStartISO = toISODate(obraPayload.data_inicio || obraPayload.dataInicioPlanejada);
      const obraEndISO = toISODate(obraPayload.data_prevista_fim || obraPayload.dataFimPlanejada);
      const computeByPeriod = (startLabel, endLabel) => {
        if (!obraStartISO || !obraEndISO || !periodLabels.length) return { start: null, end: null };
        const startIdx = Math.max(0, periodLabels.indexOf(startLabel));
        const endIdx = Math.min(periodLabels.length - 1, Math.max(0, periodLabels.indexOf(endLabel)));
        const startDate = new Date(obraStartISO);
        const endDate = new Date(obraEndISO);
        const totalMs = endDate.getTime() - startDate.getTime();
        const denom = Math.max(periodLabels.length - 1, 1);
        const dateAt = (idx) => new Date(startDate.getTime() + Math.round((idx / denom) * totalMs));
        return { start: toISODate(dateAt(startIdx)), end: toISODate(dateAt(endIdx)) };
      };

      const atividadesCompat = (dados.cronograma?.atividades || []).map((a) => {
        const inicioRaw = a.dataInicioPlanejada || a.data_inicio_planejada || a.data_inicio || a.inicio;
        const fimRaw = a.dataFimPlanejada || a.data_fim_planejada || a.data_fim || a.fim;
        let inicioISO = toISODate(inicioRaw);
        let fimISO = toISODate(fimRaw);
        if ((!inicioISO || !fimISO) && (a.periodoInicio || a.periodoFim)) {
          const byPer = computeByPeriod(a.periodoInicio, a.periodoFim);
          inicioISO = inicioISO || byPer.start;
          fimISO = fimISO || byPer.end;
        }
        return {
          nome: a.nomeAtividade || a.nome || a.atividade,
          inicio: inicioISO,
          fim: fimISO,
          qtd: a.quantidadePlanejada ?? a.qtd ?? a.quantidade ?? 0,
          und: a.und || a.unidade || null
        };
      });

      // Cronograma é OPCIONAL: em vez de bloquear a finalização do cadastro,
      // descartamos as atividades sem datas planejadas e seguimos com as válidas.
      const atividadesValidas = atividadesCompat.filter(it => it.inicio && it.fim);
      const descartadas = atividadesCompat.length - atividadesValidas.length;
      if (descartadas > 0) {
        console.warn(`[ImportadorOrcaFacilCompleto] ${descartadas} atividade(s) de cronograma sem datas — ignoradas (cronograma opcional).`);
        toast.info(`${descartadas} atividade(s) do cronograma sem datas foram ignoradas.`);
      }

      const payload = {
        import_run_id: importRunId,
        dados_obra: obraPayload,
        dados_sintetico: dados.sintetico,
        cronograma: {
          atividades: atividadesValidas,
          // Distribuição mensal (físico-financeiro) para persistir em
          // CronogramaItemPeriodo e alimentar o gráfico por mês real.
          periodos_labels: periodLabels,
          itens_fisfinan: (dados.cronograma?.itens || [])
            .filter((it) => !it.is_grupo && it.descricao && it.periodos)
            .map((it) => ({ descricao: it.descricao, periodos: it.periodos, total_valor: it.total_valor || 0 })),
        }
      };

      // Log e validação
      const qtdAtividades = payload.cronograma?.atividades?.length || 0;
      console.log('FINALIZAR: cronograma atividades:', qtdAtividades);
      console.log('Enviando para finalizarImportacaoCompleta:', payload);

      return base44.functions.invoke('finalizarImportacaoCompleta', payload);
    },
    onSuccess: async (data) => {
      setValidationDetails(null);
       const qtdSalvas = data.data?.cronograma_items || 0;
       const obraId = data.data?.obraId || data.data?.obra_id;
       const totalOrcamento = data.data?.total_orcamento_confirmado || 0;
       const itensOrcamento = data.data?.total_itens ?? data.data?.orcamentoItems ?? 0;
       // Capturar estado de consolidação já resolvido pelo backend
       const consolidadoResult = {
         consolidado: data.data?.consolidado === true,
         total_itens: data.data?.total_itens || 0,
         processados: data.data?.processados || 0,
       };

       console.log('[ImportadorOrcaFacilCompleto] Resposta completa:', data.data);
       console.log('[ImportadorOrcaFacilCompleto] consolidado=', consolidadoResult.consolidado, 'total_itens=', consolidadoResult.total_itens);
       console.log('[ImportadorOrcaFacilCompleto] Importação bem-sucedida, obraId:', obraId);
      
      // Invalidar TODOS os caches relacionados
      queryClient.invalidateQueries({ queryKey: ['obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['obra-detalhes', obraId] });
      queryClient.invalidateQueries({ queryKey: ['obras'] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['orcamento-itens-obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['cronograma', obraId] });
      queryClient.invalidateQueries({ queryKey: ['cronograma-items', obraId] });
      queryClient.invalidateQueries({ queryKey: ['marcos-obra', obraId] });
      queryClient.invalidateQueries({ queryKey: ['obra-resumo', obraId] });
      queryClient.invalidateQueries({ queryKey: ['importacao-orcafacil', obraId] });
      
      toast.success(`Importação concluída! ${qtdSalvas} atividades no cronograma.`);
      
      // Executar diagnóstico para PROVA
      if (obraId) {
        try {
          const diagResult = await base44.functions.invoke('diagnosticarObraCampos', { obra_id: obraId });
          console.log('[ImportadorOrcaFacilCompleto] DIAGNÓSTICO FINAL:', diagResult.data);
        } catch (err) {
          console.warn('Diagnóstico não completou:', err.message);
        }
      }
      
      // Mostrar tela de sucesso com valor já confirmado
      if (obraId) {
        setObraCriada({ id: obraId, itensOrcamento, consolidadoResult });
        setTotalOrcamento(totalOrcamento || 0);
        console.log('Tela de sucesso com total_orcamento:', totalOrcamento, 'consolidado:', consolidadoResult.consolidado);
      }
    },
    onError: (error) => {
      // Extrair mensagem real do response body (axios wraps it in error.response.data)
      const body = error?.response?.data;
      const msg = body?.message || body?.error || error.message || 'Erro desconhecido';
      const code = body?.code ? ` [${body.code}]` : '';
      if (error?.details) {
        setValidationDetails(error.details);
      } else if (body?.details) {
        setValidationDetails(body.details);
      }
      toast.error(`Erro na importação${code}: ${msg}`);
    }
  });

  const podeAvancar = () => {
    if (etapaAtual === 1) return !!dadosImportacao.sintetico;
    if (etapaAtual === 2) return true; // cronograma é opcional
    if (etapaAtual === 3) return !!dadosImportacao.dadosObra;
    if (etapaAtual === 4) return true;
    return false;
  };

  const mensagemBloqueio = () => {
    if (etapaAtual === 1 && !dadosImportacao.sintetico)
      return 'Carregue o orçamento sintético antes de avançar';
    if (etapaAtual === 3 && !dadosImportacao.dadosObra)
      return 'Preencha os dados da obra antes de avançar';
    return null;
  };



  // Se importação foi bem-sucedida, mostrar tela de sucesso
  if (obraCriada) {
    return (
      <TelaSuccesso
        obraId={obraCriada.id}
        total_orcamento_confirmado={totalOrcamento}
        itensOrcamento={obraCriada.itensOrcamento}
        importResult={obraCriada.consolidadoResult}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-6">
      {/* Voltar — topo esquerda, no padrão do sistema. Volta uma etapa do wizard;
          se já estiver na 1ª etapa, volta para a página anterior. */}
      <Button
        variant="ghost"
        onClick={() => (etapaAtual > 1 ? setEtapaAtual((e) => e - 1) : window.history.back())}
        className="mb-4 -ml-2 gap-2 text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Button>

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Importar OrçaFascio</h1>
      </div>

      {/* Stepper — mobile: compacto (etapa X de N + barra) */}
      <div className="mb-6 sm:hidden">
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-sm font-medium text-gray-700 flex-shrink-0">Etapa {etapaAtual} de {ETAPAS.length}</span>
          <span className="text-sm text-gray-600 truncate text-right">{ETAPAS.find((e) => e.num === etapaAtual)?.titulo}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${(etapaAtual / ETAPAS.length) * 100}%` }} />
        </div>
      </div>

      {/* Stepper — desktop */}
      <div className="mb-8 hidden sm:flex">
        {ETAPAS.map((etapa, idx) => (
          <div key={etapa.num} className="flex-1 flex flex-col items-center">
            {/* Linha (meias de cada lado) + círculo, sempre na mesma altura */}
            <div className="flex items-center w-full">
              <div className={`flex-1 h-0.5 transition-colors ${idx === 0 ? 'invisible' : (etapa.num <= etapaAtual ? 'bg-green-400' : 'bg-gray-200')}`} />
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                etapa.num === etapaAtual
                  ? 'bg-blue-600 text-white shadow-md'
                  : etapa.num < etapaAtual
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}>
                {etapa.num < etapaAtual ? <CheckCircle className="w-5 h-5" /> : etapa.num}
              </div>
              <div className={`flex-1 h-0.5 transition-colors ${idx === ETAPAS.length - 1 ? 'invisible' : (etapa.num < etapaAtual ? 'bg-green-400' : 'bg-gray-200')}`} />
            </div>
            <p className="text-xs mt-1.5 text-center leading-tight text-gray-600 max-w-[96px]">{etapa.titulo}</p>
          </div>
        ))}
      </div>

      {/* Conteúdo da etapa */}
      <Card>
        <CardContent className="pt-6">
          {etapaAtual === 1 && (
            <Etapa1SinteticoUpload
              dadosIniciais={dadosImportacao.sintetico}
              onDadosCarregados={(dados) =>
                setDadosImportacao(prev => ({ ...prev, sintetico: dados }))
              }
            />
          )}
          {etapaAtual === 2 && (
            <Etapa2CronogramaUpload
              dadosIniciais={dadosImportacao.cronograma}
              onDadosCarregados={(dados) =>
                setDadosImportacao(prev => ({ ...prev, cronograma: dados }))
              }
            />
          )}
          {etapaAtual === 3 && (
            <Etapa4DadosObra
              tentouAvancar={etapa3TentouAvancar}
              // Sugestões lidas do cabeçalho da planilha (contratante, objeto, obra).
              // A tela pré-preenche; o usuário confere antes de seguir.
              metaArquivo={dadosImportacao.sintetico?.meta}
              onDadosCarregados={(dados) =>
                setDadosImportacao(prev => ({ ...prev, dadosObra: dados }))
              }
            />
          )}
          {etapaAtual === 4 && (
            <Etapa4Medicoes
              onDadosCarregados={(dados) =>
                setDadosImportacao(prev => ({ ...prev, medicoes: dados }))
              }
            />
          )}
          {etapaAtual === 5 && (
            <Etapa5ReviewFinal dados={dadosImportacao} />
          )}

          {mensagemBloqueio() && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">{mensagemBloqueio()}</p>
            </div>
          )}

          {importMutation.isError && (() => {
            const body = importMutation.error?.response?.data;
            const msg = body?.message || body?.error || importMutation.error?.message || 'Erro desconhecido';
            const code = body?.code;
            const details = body?.details || validationDetails || importMutation.error?.details;
            const status = importMutation.error?.response?.status;
            return (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-semibold text-red-900">
                  Erro ao importar {status ? `(HTTP ${status})` : ''}
                  {code && <span className="ml-2 text-xs font-mono bg-red-100 px-1 rounded">{code}</span>}
                </p>
                <p className="text-sm text-red-700">{msg}</p>
                {details && Object.keys(details).length > 0 && (
                  <details className="text-xs text-red-600 mt-1">
                    <summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
                    <pre className="mt-1 bg-red-100 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                      {JSON.stringify(details, null, 2)}
                    </pre>
                  </details>
                )}
                {!body && <p className="text-xs text-red-500">Sem payload no erro — verifique os logs da função.</p>}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Navegação — só avançar/finalizar; o "Voltar" foi para o topo. */}
      <div className="flex justify-end mt-6">
        {etapaAtual < ETAPAS.length ? (
          <Button
            onClick={() => {
              if (etapaAtual === 3) setEtapa3TentouAvancar(true);
              if (podeAvancar()) {
                setEtapaAtual(e => e + 1);
              } else {
                // Antes o clique sem preencher não fazia NADA (silencioso). Agora
                // avisa o que falta — na etapa 1, o arquivo do orçamento.
                toast.error(mensagemBloqueio() || 'Preencha os campos obrigatórios antes de avançar.');
              }
            }}
            className="w-full sm:w-auto"
          >
            Próximo <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => importMutation.mutate(dadosImportacao)}
            disabled={importMutation.isPending}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            {importMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {importMutation.isPending ? 'Importando…' : 'Finalizar Importação'}
          </Button>
        )}
      </div>
    </div>
  );
}