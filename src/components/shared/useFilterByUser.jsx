import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook para filtrar dados por usuário autenticado
 * Retorna dados do usuário atual + dados compartilhados com ele
 */
export function useFilterByUser(entityName) {
  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const compartilhamentosQuery = useQuery({
    queryKey: ['compartilhamentos', userQuery.data?.email],
    queryFn: async () => {
      if (!userQuery.data?.email) return [];
      
      // Pega dados compartilhados com este usuário
      const compartilhados = await base44.entities.CompartilhamentoDados.filter({
        usuario_compartilhado_email: userQuery.data.email,
        tipo_entidade: entityName,
        revogado: false
      });
      
      return compartilhados;
    },
    enabled: !!userQuery.data?.email
  });

  return {
    user: userQuery.data,
    compartilhamentos: compartilhamentosQuery.data || [],
    isLoading: userQuery.isLoading || compartilhamentosQuery.isLoading,
    userEmail: userQuery.data?.email
  };
}

/**
 * Função para filtrar entidades respeitando isolamento de dados
 */
export async function filtrarEntidadesAcesso(entityName, userEmail) {
  if (!userEmail) return [];

  // Pega dados criados pelo usuário
  const meusDados = await base44.entities[entityName].filter({
    created_by: userEmail
  });

  // Pega dados compartilhados com o usuário
  const compartilhados = await base44.entities.CompartilhamentoDados.filter({
    usuario_compartilhado_email: userEmail,
    tipo_entidade: entityName,
    revogado: false
  });

  if (compartilhados.length === 0) return meusDados;

  // Pega os IDs das entidades compartilhadas
  const idsCompartilhados = compartilhados.map(c => c.entidade_id);

  // Pega os dados compartilhados
  const dadosCompartilhados = await Promise.all(
    idsCompartilhados.map(id => base44.entities[entityName].read(id))
  );

  return [...meusDados, ...dadosCompartilhados];
}

/**
 * Verifica se usuário tem permissão para acessar uma entidade
 */
export async function verificarAcessoEntidade(entityName, entidadeId, userEmail) {
  if (!userEmail) return false;

  const entidade = await base44.entities[entityName].read(entidadeId);

  // Se é criador, tem acesso total
  if (entidade.created_by === userEmail) return true;

  // Se está compartilhado e não revogado, tem acesso
  const compartilhamento = await base44.entities.CompartilhamentoDados.filter({
    tipo_entidade: entityName,
    entidade_id: entidadeId,
    usuario_compartilhado_email: userEmail,
    revogado: false
  });

  return compartilhamento.length > 0;
}