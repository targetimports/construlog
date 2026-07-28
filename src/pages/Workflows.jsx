import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa, usePermissoes } from '@/components/shared/useEmpresaContext';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, MoreVertical } from 'lucide-react';
import WorkflowForm from '@/components/workflow/WorkflowForm';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function Workflows() {
  const { empresaId } = useEmpresa();
  const { temPermissao } = usePermissoes();
  const [showForm, setShowForm] = useState(false);
  const [workflowEdit, setWorkflowEdit] = useState(null);
  const queryClient = useQueryClient();

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', empresaId],
    queryFn: () => base44.entities.WorkflowDefinicao.filter({ empresa_id: empresaId }),
    enabled: !!empresaId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowDefinicao.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows', empresaId] });
    }
  });

  const handleClose = () => {
    setShowForm(false);
    setWorkflowEdit(null);
  };

  if (!temPermissao('configuracoes', 'editar')) {
    return <div className="p-4 text-red-600">Acesso negado</div>;
  }

  return (
    <div className="w-full h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workflows</h1>
            <p className="text-gray-600 mt-2">Gerencie fluxos de trabalho e aprovações</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Novo Workflow
          </Button>
        </div>

        {/* Lista de Workflows */}
        <div className="bg-white rounded-lg border border-gray-200">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={5} />
          ) : workflows.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum workflow criado. Comece criando um novo!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Nome</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Tipo</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Etapas</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Status</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr key={workflow.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{workflow.nome}</p>
                        <p className="text-sm text-gray-600">{workflow.descricao}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 capitalize">{workflow.tipo}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">{workflow.etapas?.length || 0} etapas</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-sm px-3 py-1 rounded-full ${workflow.ativa ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {workflow.ativa ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setWorkflowEdit(workflow);
                              setShowForm(true);
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(workflow.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Deletar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de Formulário */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{workflowEdit ? 'Editar Workflow' : 'Novo Workflow'}</DialogTitle>
            <DialogDescription>
              Configure as etapas e aprovadores para este fluxo de trabalho
            </DialogDescription>
          </DialogHeader>
          <WorkflowForm workflow={workflowEdit} onClose={handleClose} />
        </DialogContent>
      </Dialog>
    </div>
  );
}