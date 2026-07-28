import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useWorkflowStatus } from '@/components/shared/useWorkflow';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export default function WorkflowAprovacao({ entidadeId, entidadeTipo }) {
  const [showDialog, setShowDialog] = useState(false);
  const [comentario, setComentario] = useState('');
  const queryClient = useQueryClient();

  const workflowStatus = useWorkflowStatus(entidadeId, entidadeTipo);

  const { data: workflowDef } = useQuery({
    queryKey: ['workflow-def', workflowStatus?.workflow_definicao_id],
    queryFn: () => base44.entities.WorkflowDefinicao.read(workflowStatus?.workflow_definicao_id),
    enabled: !!workflowStatus
  });

  const processarMutation = useMutation({
    mutationFn: async (dados) => {
      return await base44.functions.invoke('processarWorkflow', {
        instancia_id: workflowStatus.id,
        status: dados.status,
        comentario: dados.comentario
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-status'] });
      setShowDialog(false);
      setComentario('');
    }
  });

  if (!workflowStatus) return null;

  const etapaAtual = workflowDef?.etapas?.[workflowStatus.etapa_atual];
  const progresso = (workflowStatus.etapa_atual / (workflowDef?.etapas?.length || 1)) * 100;

  const statusConfig = {
    em_progresso: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    aprovado: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    rejeitado: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' }
  };

  const config = statusConfig[workflowStatus.status] || statusConfig.em_progresso;
  const Icon = config.icon;

  return (
    <div className={`p-4 rounded-lg border-2 ${config.bg}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 ${config.color} mt-1`} />
          <div>
            <h4 className="font-semibold text-gray-900">
              {workflowStatus.status === 'em_progresso' ? 'Aguardando Aprovação' : 'Workflow Finalizado'}
            </h4>
            {etapaAtual && (
              <p className="text-sm text-gray-600 mt-1">
                Etapa: <strong>{etapaAtual.nome}</strong>
                {etapaAtual.tempo_limite_horas && ` (até ${etapaAtual.tempo_limite_horas}h)`}
              </p>
            )}

            {/* Histórico de aprovações */}
            {workflowStatus.progresso?.length > 0 && (
              <div className="mt-3 space-y-2">
                {workflowStatus.progresso.map((p, i) => (
                  <div key={i} className="text-xs text-gray-600">
                    <p className="font-medium">
                      {p.status === 'aprovado' && '✓'} {p.status === 'rejeitado' && '✗'} {p.usuario_email}
                    </p>
                    {p.comentario && <p className="italic">{p.comentario}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div className="flex-1 ml-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${progresso}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {workflowStatus.etapa_atual} de {workflowDef?.etapas?.length || 0} etapas
          </p>
        </div>
      </div>

      {/* Botões de ação */}
      {workflowStatus.status === 'em_progresso' && (
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setComentario('');
              setShowDialog(true);
            }}
          >
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200"
            onClick={() => {
              setComentario('');
              setShowDialog(true);
            }}
          >
            Rejeitar
          </Button>
        </div>
      )}

      {/* Dialog de ação */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Processar Aprovação</DialogTitle>
            <DialogDescription>
              Adicione um comentário e escolha a ação
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentário (opcional)"
            className="min-h-24"
          />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => processarMutation.mutate({ status: 'aprovado', comentario })}
              className="bg-green-600 hover:bg-green-700"
            >
              Aprovar
            </Button>
            <Button
              onClick={() => processarMutation.mutate({ status: 'rejeitado', comentario })}
              variant="destructive"
            >
              Rejeitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}