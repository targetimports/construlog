import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa } from './useEmpresaContext';

/**
 * Hook para gerenciar integrações da empresa
 */
export function useIntegracao(tipo) {
  const { empresaId } = useEmpresa();

  const query = useQuery({
    queryKey: ['integracao', empresaId, tipo],
    queryFn: async () => {
      if (!empresaId) return null;

      const integracoes = await base44.entities.Integracao.filter({
        empresa_id: empresaId,
        tipo: tipo,
        ativa: true
      });

      return integracoes[0] || null;
    },
    enabled: !!empresaId
  });

  const testarConexao = async () => {
    if (!query.data) return false;
    // Implementar teste específico por tipo
    try {
      // Placeholder - cada integração teria seu próprio teste
      return true;
    } catch {
      return false;
    }
  };

  return {
    integracao: query.data,
    isLoading: query.isLoading,
    testarConexao
  };
}

/**
 * Hook para listar todas as integrações ativas
 */
export function useIntegracoes() {
  const { empresaId } = useEmpresa();

  const query = useQuery({
    queryKey: ['integracoes', empresaId],
    queryFn: async () => {
      if (!empresaId) return [];

      return await base44.entities.Integracao.filter({
        empresa_id: empresaId,
        ativa: true
      });
    },
    enabled: !!empresaId
  });

  return query.data || [];
}