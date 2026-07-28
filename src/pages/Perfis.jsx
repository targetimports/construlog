import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useEmpresa, usePermissoes } from '@/components/shared/useEmpresaContext';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2, MoreVertical } from 'lucide-react';
import PerfilForm from '@/components/perfis/PerfilForm';
import { TableSkeleton } from '@/components/shared/Skeletons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export default function Perfis() {
  const { empresaId } = useEmpresa();
  const { temPermissao } = usePermissoes();
  const [showForm, setShowForm] = useState(false);
  const [perfilEdit, setPerfilEdit] = useState(null);
  const queryClient = useQueryClient();

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['perfis', empresaId],
    queryFn: () => base44.entities.Perfil.filter({ empresa_id: empresaId }),
    enabled: !!empresaId
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Perfil.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis'] });
    }
  });

  const handleClose = () => {
    setShowForm(false);
    setPerfilEdit(null);
  };

  if (!temPermissao('configuracoes', 'editar')) {
    return <div className="p-4 text-red-600">Acesso negado</div>;
  }

  return (
    <div className="w-full h-full bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Perfis de Acesso</h1>
            <p className="text-gray-600 mt-2">Defina permissões e níveis de acesso</p>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Perfil
          </Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <TableSkeleton bare rows={6} cols={4} />
          ) : perfis.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum perfil criado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Nome</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Nível</th>
                    <th className="text-left px-6 py-3 text-sm font-semibold text-gray-900">Permissões</th>
                    <th className="text-right px-6 py-3 text-sm font-semibold text-gray-900">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {perfis.map((perfil) => (
                    <tr key={perfil.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{perfil.nome}</p>
                        <p className="text-sm text-gray-600">{perfil.descricao}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 capitalize">{perfil.nivel_acesso}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {perfil.permissoes?.length || 0} recurso(s)
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
                              setPerfilEdit(perfil);
                              setShowForm(true);
                            }}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(perfil.id)}
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

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{perfilEdit ? 'Editar Perfil' : 'Novo Perfil'}</DialogTitle>
          </DialogHeader>
          <PerfilForm perfil={perfilEdit} onClose={handleClose} />
        </DialogContent>
      </Dialog>
    </div>
  );
}