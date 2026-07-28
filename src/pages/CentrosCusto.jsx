import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CentrosCusto() {
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ nome: '', codigo: '', obra_id: '' });
  const queryClient = useQueryClient();

  const { data: centros = [] } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: () => base44.entities.CentroCusto.list()
  });

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const criar = useMutation({
    mutationFn: (data) => base44.entities.CentroCusto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      setFormData({ nome: '', codigo: '', obra_id: '' });
      setShowForm(false);
    }
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CentroCusto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      setEditando(null);
    }
  });

  const deletar = useMutation({
    mutationFn: (id) => base44.entities.CentroCusto.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['centros-custo'] })
  });

  const filtrados = centros.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSubmit = () => {
    if (!formData.nome.trim()) return;
    
    const data = {
      nome: formData.nome,
      codigo: formData.codigo || undefined,
      obra_id: formData.obra_id || undefined
    };

    if (editando) {
      atualizar.mutate({ id: editando.id, data });
    } else {
      criar.mutate(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Centros de Custo</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Centro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar' : 'Novo'} Centro de Custo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input 
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: ADM Geral"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Código (opcional)</label>
                <Input 
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: CC001"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Obra (opcional)</label>
                <Select 
                  value={formData.obra_id} 
                  onValueChange={(v) => setFormData({ ...formData, obra_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione obra" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Sem obra específica</SelectItem>
                    {obras.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editando ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Input 
          placeholder="Buscar centro de custo..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filtrados.map((cc) => {
          const obra = obras.find(o => o.id === cc.obra_id);
          return (
            <Card key={cc.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold">{cc.nome}</p>
                  <div className="flex gap-2 mt-2">
                    {cc.codigo && <Badge variant="outline">{cc.codigo}</Badge>}
                    {obra && <Badge>{obra.nome}</Badge>}
                    {cc.ativo && <Badge className="bg-green-100 text-green-800">Ativo</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => {
                      setEditando(cc);
                      setFormData(cc);
                      setShowForm(true);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    onClick={() => deletar.mutate(cc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}