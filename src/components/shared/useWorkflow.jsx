import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa } from './useEmpresaContext';

/**
 * Hook para gerenciar workflows
 */
export function useWorkflow(tipoWorkflow) {
  const { empresaId } = useEmpresa();
  const queryClient = useQueryClient();

  const workflowDefinicaoQuery = useQuery({
    queryKey: ['workflow-definicao', empresaId, tipoWorkflow],
    queryFn: async () => {
      if (!empresaId) return null;

      const workflows = await base44.entities.WorkflowDefinicao.filter({
        empresa_id: empresaId,
        tipo: tipoWorkflow,
        ativa: true
      });

      return workflows[0] || null;
    },
    enabled: !!empresaId
  });

  const criarInstancia = useMutation({
    mutationFn: async (dados) => {
      if (!empresaId || !workflowDefinicaoQuery.data) return;

      const instancia = await base44.entities.WorkflowInstancia.create({
        empresa_id: empresaId,
        workflow_definicao_id: workflowDefinicaoQuery.data.id,
        entidade_tipo: dados.entidade_tipo,
        entidade_id: dados.entidade_id,
        data_inicio: new Date().toISOString()
      });

      return instancia;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instancia'] });
    }
  });

  const avancarEtapa = useMutation({
    mutationFn: async ({ instancia_id, status, comentario }) => {
      const instancia = await base44.entities.WorkflowInstancia.read(instancia_id);
      const etapaAtual = instancia.etapa_atual;

      // Adiciona progresso da etapa atual
      const progresso = instancia.progresso || [];
      progresso[etapaAtual] = {
        etapa: etapaAtual,
        status,
        usuario_email: (await base44.auth.me()).email,
        comentario,
        data: new Date().toISOString()
      };

      // Calcula próximo status
      let novoStatus = instancia.status;
      let novaEtapa = etapaAtual + 1;

      if (status === 'rejeitado') {
        novoStatus = 'rejeitado';
      } else if (novaEtapa >= workflowDefinicaoQuery.data.etapas.length) {
        novoStatus = 'aprovado';
      }

      await base44.entities.WorkflowInstancia.update(instancia_id, {
        progresso,
        etapa_atual: novaEtapa,
        status: novoStatus,
        data_conclusao: novoStatus !== 'em_progresso' ? new Date().toISOString() : null
      });

      return { status: novoStatus, etapa: novaEtapa };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instancia'] });
    }
  });

  return {
    workflowDefinicao: workflowDefinicaoQuery.data,
    criarInstancia,
    avancarEtapa,
    isLoading: workflowDefinicaoQuery.isLoading
  };
}

/**
 * Hook para verificar status de um workflow
 */
export function useWorkflowStatus(entidadeId, entidadeTipo) {
  const { empresaId } = useEmpresa();

  const query = useQuery({
    queryKey: ['workflow-status', empresaId, entidadeId],
    queryFn: async () => {
      if (!empresaId) return null;

      const instancias = await base44.entities.WorkflowInstancia.filter({
        empresa_id: empresaId,
        entidade_id: entidadeId,
        entidade_tipo: entidadeTipo
      });

      return instancias[instancias.length - 1] || null;
    },
    enabled: !!empresaId && !!entidadeId
  });

  return query.data;
}