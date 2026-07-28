import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Warehouse, Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';

export default function Depositos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [depositoEdit, setDepositoEdit] = useState(null);
  const [statusDeposito, setStatusDeposito] = useState('ativo');

  const queryClient = useQueryClient();

  const openDialog = (dep = null) => {
    setDepositoEdit(dep);
    setStatusDeposito(dep?.status || 'ativo');
    setDialogOpen(true);
  };

  const { data: depositos = [] } = useQuery({
    queryKey: ['depositos'],
    queryFn: () => base44.entities.Deposito.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => depositoEdit 
      ? base44.entities.Deposito.update(depositoEdit.id, data)
      : base44.entities.Deposito.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['depositos']);
      toast.success(depositoEdit ? 'Depósito atualizado' : 'Depósito criado');
      setDialogOpen(false);
      setDepositoEdit(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Deposito.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['depositos']);
      toast.success('Depósito excluído');
    }
  });

  const handleExcluir = (id) => {
    if (window.confirm('Excluir este depósito? Esta ação não pode ser desfeita.')) {
      deleteMutation.mutate(id);
    }
  };

  const depositosAtivos = depositos.filter(d => d.status === 'ativo');
  const depositosInativos = depositos.filter(d => d.status === 'inativo');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Depósitos"
        subtitle="Gestão de depósitos e almoxarifados"
        action={() => openDialog(null)}
        actionLabel="Novo Depósito"
      />

      <Tabs defaultValue="ativos">
        <TabsList>
          <TabsTrigger value="ativos">Ativos ({depositosAtivos.length})</TabsTrigger>
          <TabsTrigger value="inativos">Inativos ({depositosInativos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="space-y-3 mt-6">
          {depositosAtivos.map(dep => (
            <Card key={dep.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Warehouse className="w-6 h-6 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-gray-900 font-semibold">{dep.nome}</h3>
                        {dep.codigo && <Badge>{dep.codigo}</Badge>}
                      </div>
                      <div className="text-sm text-gray-600">
                        {dep.responsavel && <p>Responsável: {dep.responsavel}</p>}
                        {dep.endereco && <p>{dep.endereco} - {dep.cidade}/{dep.estado}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDialog(dep)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExcluir(dep.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="inativos" className="space-y-3 mt-6">
          {depositosInativos.map(dep => (
            <Card key={dep.id} className="opacity-70">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Warehouse className="w-6 h-6 text-gray-400" />
                    <div>
                      <h3 className="text-gray-600 font-semibold">{dep.nome}</h3>
                      <Badge className="bg-gray-500 mt-1">Inativo</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openDialog(dep)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExcluir(dep.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{depositoEdit ? 'Editar Depósito' : 'Novo Depósito'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome *" defaultValue={depositoEdit?.nome} id="nome" />
            <Input placeholder="Código" defaultValue={depositoEdit?.codigo} id="codigo" />
            <Input placeholder="Responsável" defaultValue={depositoEdit?.responsavel} id="responsavel" />
            <Input placeholder="Endereço" defaultValue={depositoEdit?.endereco} id="endereco" />
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder="Cidade" defaultValue={depositoEdit?.cidade} id="cidade" />
              <Input placeholder="Estado" defaultValue={depositoEdit?.estado} id="estado" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <Select value={statusDeposito} onValueChange={setStatusDeposito}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={createMutation.isPending}
              onClick={() => {
                const nome = document.getElementById('nome').value.trim();
                if (!nome) { toast.error('Informe o nome do depósito'); return; }
                const data = {
                  nome,
                  codigo: document.getElementById('codigo').value,
                  responsavel: document.getElementById('responsavel').value,
                  endereco: document.getElementById('endereco').value,
                  cidade: document.getElementById('cidade').value,
                  estado: document.getElementById('estado').value,
                  status: statusDeposito
                };
                createMutation.mutate(data);
              }}
              className="w-full bg-gray-900 hover:bg-gray-800"
            >
              {depositoEdit ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}