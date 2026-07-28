/**
 * Hook centralizado para dados do ObraDetalhes.
 * Chama o endpoint getObraDetailsData (agregador) e retorna
 * resumoOrcamento, resumoCronograma, resumoFinanceiro, contagens.
 * 
 * Garante defaults seguros para todos os campos — jamais retorna null/undefined
 * onde componentes esperam número ou objeto.
 */
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const DEFAULT_RESUMO_ORCAMENTO = {
  hasOrcamento: false,
  orcamento_id: null,
  versao: null,
  status: null,
  total_orcado: 0,
  total_itens: 0,
  valor_realizado: 0,
  percentual_consumido: 0,
};

const DEFAULT_RESUMO_CRONOGRAMA = {
  hasData: false,
  total_atividades: 0,
  concluidas: 0,
  em_andamento: 0,
  progresso_geral: 0,
  data_inicio: null,
  data_prevista_fim: null,
};

const DEFAULT_RESUMO_FINANCEIRO = {
  hasData: false,
  total_receitas: 0,
  total_despesas: 0,
  saldo: 0,
  receitas_recebidas: 0,
  despesas_pagas: 0,
  percentual_consumido_orcamento: 0,
  qtd_contas_pagar: 0,
  qtd_contas_receber: 0,
};

const DEFAULT_CONTAGENS = {
  requisicoes: 0,
  requisicoes_pendentes: 0,
  documentos: 0,
};

export function useObraDetailsData(obraId) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['obra-details-data', obraId],
    queryFn: async () => {
      const res = await base44.functions.invoke('getObraDetailsData', { obra_id: obraId });
      return res.data;
    },
    enabled: !!obraId,
    staleTime: 30000,
    retry: 2,
  });

  return {
    obra: data?.obra || null,
    resumoOrcamento: data?.resumoOrcamento || DEFAULT_RESUMO_ORCAMENTO,
    resumoCronograma: data?.resumoCronograma || DEFAULT_RESUMO_CRONOGRAMA,
    resumoFinanceiro: data?.resumoFinanceiro || DEFAULT_RESUMO_FINANCEIRO,
    contagens: data?.contagens || DEFAULT_CONTAGENS,
    isLoading,
    isError,
    error,
    refetch,
  };
}