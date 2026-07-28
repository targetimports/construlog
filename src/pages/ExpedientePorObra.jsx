import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Clock, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function ExpedientePorObra() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    obra_id: '',
    segunda: '08:00',
    segunda_saida: '17:00',
    terca: '08:00',
    terca_saida: '17:00',
    quarta: '08:00',
    quarta_saida: '17:00',
    quinta: '08:00',
    quinta_saida: '17:00',
    sexta: '08:00',
    sexta_saida: '17:00',
    sabado: '',
    sabado_saida: '',
    domingo: '',
    domingo_saida: ''
  });

  const queryClient = useQueryClient();

  const { data: expedientes = [] } = useQuery({
    queryKey: ['expedientes-obra'],
    queryFn: () => base44.entities.Expediente.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Expediente.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedientes-obra'] });
      toast.success('Expediente criado com sucesso');
      resetForm();
      setDialogOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Expediente.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedientes-obra'] });
      toast.success('Expediente atualizado com sucesso');
      resetForm();
      setDialogOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Expediente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expedientes-obra'] });
      toast.success('Expediente removido');
      setDeleteId(null);
    }
  });

  const resetForm = () => {
    setFormData({
      obra_id: '',
      segunda: '08:00',
      segunda_saida: '17:00',
      terca: '08:00',
      terca_saida: '17:00',
      quarta: '08:00',
      quarta_saida: '17:00',
      quinta: '08:00',
      quinta_saida: '17:00',
      sexta: '08:00',
      sexta_saida: '17:00',
      sabado: '',
      sabado_saida: '',
      domingo: '',
      domingo_saida: ''
    });
    setEditingId(null);
  };

  const handleEdit = (expediente) => {
    setFormData(expediente);
    setEditingId(expediente.id);
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.obra_id) {
      toast.error('Selecione uma obra');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getObraName = (id) => obras.find(o => o.id === id)?.nome || 'Obra não encontrada';

  const dias = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expedientes por Obra"
        subtitle="Configure horários de trabalho para cada obra"
        action={() => {
          resetForm();
          setDialogOpen(true);
        }}
        actionLabel="Novo Expediente"
      />

      <div className="grid gap-4">
        {expedientes.length === 0 ? (
          <Card className="p-12 text-center">
            <Clock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum expediente cadastrado</h3>
            <Button onClick={() => setDialogOpen(true)} className="mt-4">
              <Plus className="w-4 h-4 mr-2" /> Criar Expediente
            </Button>
          </Card>
        ) : (
          expedientes.map(expediente => (
            <Card key={expediente.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <CardTitle>{getObraName(expediente.obra_id)}</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(expediente)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => setDeleteId(expediente.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {dias.map(dia => (
                    <div key={dia.key} className="text-sm">
                      <p className="font-medium text-gray-700">{dia.label}</p>
                      <p className="text-gray-500">
                        {expediente[dia.key] ? `${expediente[dia.key]} - ${expediente[`${dia.key}_saida`]}` : 'Não trabalha'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Expediente' : 'Novo Expediente'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label>Obra *</Label>
              <Select
                value={formData.obra_id}
                onValueChange={(value) => setFormData({ ...formData, obra_id: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecione uma obra" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map(obra => (
                    <SelectItem key={obra.id} value={obra.id}>
                      {obra.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">Horários</h3>
              {dias.map(dia => (
                <div key={dia.key} className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <Label className="text-sm">{dia.label}</Label>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Entrada</Label>
                    <Input
                      type="time"
                      value={formData[dia.key]}
                      onChange={(e) => setFormData({ ...formData, [dia.key]: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Saída</Label>
                    <Input
                      type="time"
                      value={formData[`${dia.key}_saida`]}
                      onChange={(e) => setFormData({ ...formData, [`${dia.key}_saida`]: e.target.value })}
                      className="mt-1"
                      disabled={!formData[dia.key]}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingId ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Deletar */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Expediente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este expediente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}