import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Edit2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { CardGridSkeleton } from '@/components/shared/Skeletons';
import { toast } from 'sonner';

const gruposObrigatorios = [
  {
    nome: 'Material',
    codigo: 'material',
    descricao: 'Materiais e insumos de construção',
    comportamento_calculo: 'Custo direto = quantidade × preço unitário'
  },
  {
    nome: 'Mão de Obra',
    codigo: 'mao_obra',
    descricao: 'Custos de mão de obra (salários, encargos, benefícios)',
    comportamento_calculo: 'Custo = (salário + encargos + benefícios) × quantidade'
  },
  {
    nome: 'Equipamento',
    codigo: 'equipamento',
    descricao: 'Máquinas e equipamentos',
    comportamento_calculo: 'Custo aluguel/hora = taxa diária ÷ 8 horas'
  },
  {
    nome: 'Serviço',
    codigo: 'servico',
    descricao: 'Serviços terceirizados',
    comportamento_calculo: 'Custo = valor do serviço'
  },
  {
    nome: 'Outros',
    codigo: 'outros',
    descricao: 'Insumos diversos',
    comportamento_calculo: 'Custo = quantidade × preço unitário'
  }
];

export default function GruposInsumos() {
  const [showModal, setShowModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    codigo: '',
    comportamento_calculo: '',
    ativo: true
  });

  const queryClient = useQueryClient();

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['grupos-insumos'],
    queryFn: () => base44.entities.GrupoInsumo.list('-created_date', 100)
  });

  const { mutate: saveGrupo, isPending } = useMutation({
    mutationFn: async (data) => {
      if (editingGrupo) {
        return base44.entities.GrupoInsumo.update(editingGrupo.id, data);
      } else {
        return base44.entities.GrupoInsumo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grupos-insumos'] });
      toast.success('Grupo salvo com sucesso');
      handleCloseModal();
    }
  });

  const handleOpenModal = (grupo = null) => {
    if (grupo) {
      setEditingGrupo(grupo);
      setFormData(grupo);
    } else {
      setEditingGrupo(null);
      setFormData({
        nome: '',
        descricao: '',
        codigo: '',
        comportamento_calculo: '',
        ativo: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingGrupo(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome || !formData.codigo) {
      toast.error('Nome e código são obrigatórios');
      return;
    }
    saveGrupo(formData);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-gray-50 p-6"><div className="max-w-4xl mx-auto"><CardGridSkeleton count={6} cols="md:grid-cols-2" /></div></div>;
  }

  const gruposExistentes = grupos.map(g => g.codigo);
  const gruposParaCriar = gruposObrigatorios.filter(g => !gruposExistentes.includes(g.codigo));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" asChild>
            <a href={createPageUrl('Insumos')}>
              <ArrowLeft className="w-4 h-4" />
            </a>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Grupos de Insumos</h1>
            <p className="text-gray-600 mt-1">Gerencie categorias de insumos</p>
          </div>
        </div>

        {/* Grupos Obrigatórios */}
        {gruposParaCriar.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-900">Criar Grupos Obrigatórios</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-amber-800 mb-4">
                Os seguintes grupos ainda não foram criados no sistema:
              </p>
              <div className="space-y-2">
                {gruposParaCriar.map(grupo => (
                  <div key={grupo.codigo} className="flex justify-between items-center p-3 bg-white rounded border border-amber-200">
                    <div>
                      <p className="font-medium text-gray-900">{grupo.nome}</p>
                      <p className="text-sm text-gray-600">{grupo.descricao}</p>
                    </div>
                    <Button
                      onClick={() => {
                        setFormData(grupo);
                        handleOpenModal();
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Criar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de Grupos Existentes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {grupos.map(grupo => (
            <Card key={grupo.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{grupo.nome}</CardTitle>
                    <p className="text-xs font-mono text-gray-500 mt-1">{grupo.codigo}</p>
                  </div>
                  <Badge className={grupo.ativo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                    {grupo.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Descrição</p>
                  <p className="text-sm text-gray-600">{grupo.descricao}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Comportamento de Cálculo</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {grupo.comportamento_calculo}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => handleOpenModal(grupo)}
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Material"
                  required
                />
              </div>
              <div>
                <Label htmlFor="codigo">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  placeholder="Ex: material"
                  disabled={editingGrupo}
                  required
                />
              </div>
              <div>
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva este grupo"
                />
              </div>
              <div>
                <Label htmlFor="comportamento">Comportamento de Cálculo</Label>
                <Input
                  id="comportamento"
                  value={formData.comportamento_calculo}
                  onChange={(e) => setFormData({ ...formData, comportamento_calculo: e.target.value })}
                  placeholder="Como este insumo é calculado"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="w-4 h-4"
                />
                <Label htmlFor="ativo" className="mb-0">Ativo</Label>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button variant="outline" type="button" onClick={handleCloseModal}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700">
                  {isPending ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}