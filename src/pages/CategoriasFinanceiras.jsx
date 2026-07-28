import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function CategoriasFinanceiras() {
  const [busca, setBusca] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [formData, setFormData] = useState({ nome: '', tipo: 'custo', grupo: 'outros' });
  const queryClient = useQueryClient();

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias-financeiras'],
    queryFn: () => base44.entities.CategoriaFinanceira.list()
  });

  const criar = useMutation({
    mutationFn: (data) => base44.entities.CategoriaFinanceira.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
      setFormData({ nome: '', tipo: 'custo', grupo: 'outros' });
      setShowForm(false);
    }
  });

  const atualizar = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CategoriaFinanceira.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] });
      setEditando(null);
    }
  });

  const deletar = useMutation({
    mutationFn: (id) => base44.entities.CategoriaFinanceira.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categorias-financeiras'] })
  });

  const filtradas = categorias.filter(c => 
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  const handleSubmit = () => {
    if (!formData.nome.trim()) return;
    
    if (editando) {
      atualizar.mutate({ id: editando.id, data: formData });
    } else {
      criar.mutate(formData);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="page-title">Categorias Financeiras</h1>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editando ? 'Editar' : 'Nova'} Categoria</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Nome</label>
                <Input 
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Serviço"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tipo</label>
                <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custo">Custo</SelectItem>
                    <SelectItem value="receita">Receita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Grupo</label>
                <Select value={formData.grupo} onValueChange={(v) => setFormData({ ...formData, grupo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                    <SelectItem value="mao_obra">Mão de Obra</SelectItem>
                    <SelectItem value="imposto">Imposto</SelectItem>
                    <SelectItem value="adm">Administrativo</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
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
          placeholder="Buscar categoria..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="grid gap-4">
        {filtradas.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{cat.nome}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="outline">{cat.tipo}</Badge>
                  <Badge>{cat.grupo}</Badge>
                  {cat.ativo && <Badge className="bg-green-100 text-green-800">Ativo</Badge>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => {
                    setEditando(cat);
                    setFormData(cat);
                    setShowForm(true);
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={() => deletar.mutate(cat.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}