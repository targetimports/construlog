import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa } from './useEmpresaContext';

/**
 * Hook para registrar ações de auditoria
 */
export function useAuditoria() {
  const { empresaId } = useEmpresa();

  const registrarAcao = async (acao, entidade, entidade_id, modulo = null, detalhes = null, dados_anteriores = null, dados_novos = null) => {
    try {
      const user = await base44.auth.me();
      
      await base44.asServiceRole.entities.LogAuditoria.create({
        user_email: user.email,
        empresa_id: empresaId || null,
        acao,
        modulo,
        entidade,
        entidade_id,
        detalhes: detalhes || `${acao} em ${entidade}`,
        dados_anteriores,
        dados_novos,
        sucesso: true
      });
    } catch (error) {
      console.error('Erro ao registrar auditoria:', error);
    }
  };

  return { registrarAcao };
}

/**
 * Wrapper para adicionar auditoria automaticamente em operações
 */
export function comAuditoria(registrarAcao) {
  return {
    criar: async (entidade, entidade_id, modulo, dados, detalhes) => {
      await registrarAcao('criar', entidade, entidade_id, modulo, detalhes, null, dados);
    },
    editar: async (entidade, entidade_id, modulo, dados_anteriores, dados_novos, detalhes) => {
      await registrarAcao('atualizar', entidade, entidade_id, modulo, detalhes, dados_anteriores, dados_novos);
    },
    deletar: async (entidade, entidade_id, modulo, detalhes) => {
      await registrarAcao('excluir', entidade, entidade_id, modulo, detalhes);
    },
    visualizar: async (entidade, entidade_id, modulo, detalhes) => {
      await registrarAcao('visualizar', entidade, entidade_id, modulo, detalhes);
    },
    aprovar: async (entidade, entidade_id, modulo, detalhes) => {
      await registrarAcao('aprovar', entidade, entidade_id, modulo, detalhes);
    },
    exportar: async (entidade, formato, modulo, detalhes) => {
      await registrarAcao('exportar', entidade, null, modulo, `${detalhes} (formato: ${formato})`);
    }
  };
}