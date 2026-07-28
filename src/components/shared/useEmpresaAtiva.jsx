import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook para obter contexto da empresa ativa
 * Cache leve em memória (5min) para não pesar o sistema
 */
export function useEmpresaAtiva() {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity
  });

  const { data: empresa, isLoading } = useQuery({
    queryKey: ['empresa-ativa', user?.empresa_id],
    queryFn: async () => {
      if (!user?.empresa_id) return null;
      
      try {
        const emp = await base44.entities.Empresa.get(user.empresa_id);
        
        // Montar endereço completo
        const partes = [
          emp.endereco_rua,
          emp.endereco_numero,
          emp.endereco_bairro,
          emp.endereco_cidade,
          emp.endereco_estado,
          emp.endereco_cep
        ].filter(Boolean);

        const enderecoCompleto = partes.length > 0 
          ? `${emp.endereco_rua || ''}, ${emp.endereco_numero || ''} - ${emp.endereco_bairro || ''} - ${emp.endereco_cidade || ''}/${emp.endereco_estado || ''} - ${emp.endereco_cep || ''}`
          : '';

        // Log dev apenas
        if (process.env.NODE_ENV === 'development') {
          console.log('[EMPRESA CONTEXT READY]', {
            empresaId: emp.id,
            empresaNome: emp.razao_social,
            enderecoCompleto
          });
        }

        return {
          empresaId: emp.id,
          empresaNome: emp.razao_social,
          enderecoCompleto: enderecoCompleto.trim()
        };
      } catch (err) {
        console.warn('[useEmpresaAtiva] Erro ao buscar empresa:', err.message);
        return null;
      }
    },
    enabled: !!user?.empresa_id,
    staleTime: 5 * 60 * 1000, // 5 minutos cache
    retry: 1
  });

  return {
    empresaId: empresa?.empresaId || null,
    empresaNome: empresa?.empresaNome || '',
    enderecoCompleto: empresa?.enderecoCompleto || '',
    isLoading
  };
}