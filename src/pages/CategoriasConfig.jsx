import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Trash2, Edit2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

export default function CategoriasConfig() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    cor: '#3B82F6'
  });

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => base44.entities.Categoria.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Categoria.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
      setOpenDialog(false);
      toast.success('Categoria criada com sucesso!');
    },
    onError: (error) => toast.error('Erro ao criar: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Categoria.update(editingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
      setEditingId(null);
      setOpenDialog(false);
      toast.success('Categoria atualizada com sucesso!');
    },
    onError: (error) => toast.error('Erro ao atualizar: ' + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Categoria.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias'] });
      toast.success('Categoria deletada com sucesso!');
    },
    onError: (error) => toast.error('Erro ao deletar: ' + error.message)
  });

  const handleOpenDialog = (categoria = null) => {
    if (categoria) {
      setEditingId(categoria.id);
      setFormData({
        nome: categoria.nome,
        descricao: categoria.descricao || '',
        cor: categoria.cor || '#3B82F6'
      });
    } else {
      setEditingId(null);
      setFormData({ nome: '', descricao: '', cor: '#3B82F6' });
    }
    setOpenDialog(true);
  };

  const handleSubmit = () => {
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (editingId) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuração de Categorias"
        subtitle="Gerenciar categorias de materiais e serviços"
        action={() => handleOpenDialog()}
        actionLabel="Adicionar Categoria"
      />

      {/* Dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Categoria' : 'Nova Categoria'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                placeholder="Nome da categoria"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                placeholder="Descrição da categoria"
                className="mt-1.5"
                rows={3}
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Cor</Label>
              <div className="flex gap-2 mt-1.5">
                <input
                  type="color"
                  value={formData.cor}
                  onChange={(e) => setFormData({...formData, cor: e.target.value})}
                  className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                />
                <Input
                  value={formData.cor}
                  onChange={(e) => setFormData({...formData, cor: e.target.value})}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingId ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lista de Categorias */}
      {isLoading ? (
        <CardGridSkeleton count={6} cols="md:grid-cols-2 lg:grid-cols-3" />
      ) : categorias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Nenhuma categoria criada ainda. Clique em "Adicionar Categoria" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categorias.map((categoria) => (
            <Card key={categoria.id} className="border-l-4" style={{borderLeftColor: categoria.cor}}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{categoria.nome}</h3>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(categoria)}
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(categoria.id)}
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                {categoria.descricao && (
                  <p className="text-sm text-gray-600">{categoria.descricao}</p>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{backgroundColor: categoria.cor}}
                  />
                  <span className="text-xs text-gray-500">{categoria.cor}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}