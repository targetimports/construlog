import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Settings, Package } from 'lucide-react';
import { toast } from 'sonner';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

export default function ConfiguracaoBeneficios() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();

  const { data: catalogo = [], isLoading } = useQuery({
    queryKey: ['beneficio-catalogo-admin'],
    queryFn: () => base44.entities.BeneficioCatalogo.list()
  });

  const salvar = useMutation({
    mutationFn: async (data) => {
      if (editing?.id) {
        return base44.entities.BeneficioCatalogo.update(editing.id, data);
      } else {
        return base44.entities.BeneficioCatalogo.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficio-catalogo-admin'] });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Benefício salvo no catálogo');
    },
    onError: () => toast.error('Erro ao salvar')
  });

  const remover = useMutation({
    mutationFn: (id) => base44.entities.BeneficioCatalogo.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beneficio-catalogo-admin'] });
      toast.success('Benefício removido');
    }
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Benefícios</h1>
          <p className="text-sm text-gray-600 mt-1">Configure os benefícios disponíveis para os colaboradores</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Benefício
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar' : 'Novo'} Benefício</DialogTitle>
            </DialogHeader>
            <BeneficioFormAdmin
              beneficio={editing}
              onSave={(data) => salvar.mutate(data)}
              onCancel={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <CardGridSkeleton count={4} cols="md:grid-cols-2" />
      ) : catalogo.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Nenhum benefício cadastrado</p>
          <p className="text-sm text-gray-500 mt-1">Crie benefícios padrão como VR, VT, Plano Saúde</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {catalogo.map(ben => (
            <div key={ben.id} className="bg-white border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{ben.nome}</h3>
                  <Badge variant={ben.ativo ? 'default' : 'outline'} className="mt-1">
                    {ben.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                    setEditing(ben);
                    setDialogOpen(true);
                  }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => remover.mutate(ben.id)}>
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </div>

              <div className="text-sm space-y-1">
                <p><strong>Tipo:</strong> {ben.tipo_calculo}</p>
                <p><strong>Quem paga:</strong> {ben.quem_paga_padrao}</p>
                <p><strong>Valor padrão:</strong> R$ {(ben.valor_padrao || 0).toFixed(2)}</p>
                {ben.categoria && <Badge variant="outline">{ben.categoria}</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BeneficioFormAdmin({ beneficio, onSave, onCancel }) {
  const [form, setForm] = useState(beneficio || {
    nome: '',
    ativo: true,
    tipo_calculo: 'FIXO',
    valor_padrao: 0,
    quem_paga_padrao: 'EMPRESA',
    percentual_empresa_padrao: 100,
    percentual_funcionario_padrao: 0,
    categoria: 'outros'
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nome do Benefício</Label>
          <Input
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex: Vale Refeição"
            required
          />
        </div>

        <div>
          <Label>Categoria</Label>
          <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="alimentacao">Alimentação</SelectItem>
              <SelectItem value="transporte">Transporte</SelectItem>
              <SelectItem value="saude">Saúde</SelectItem>
              <SelectItem value="seguro">Seguro</SelectItem>
              <SelectItem value="outros">Outros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Tipo de Cálculo</Label>
          <Select value={form.tipo_calculo} onValueChange={(v) => setForm({ ...form, tipo_calculo: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="FIXO">Fixo Mensal</SelectItem>
              <SelectItem value="POR_DIA">Por Dia</SelectItem>
              <SelectItem value="PERCENTUAL">% Salário</SelectItem>
              <SelectItem value="MANUAL">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Valor Padrão (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor_padrao}
            onChange={(e) => setForm({ ...form, valor_padrao: parseFloat(e.target.value) || 0 })}
          />
        </div>

        <div>
          <Label>Quem Paga</Label>
          <Select value={form.quem_paga_padrao} onValueChange={(v) => setForm({ ...form, quem_paga_padrao: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EMPRESA">Empresa</SelectItem>
              <SelectItem value="FUNCIONARIO">Funcionário</SelectItem>
              <SelectItem value="COMPARTILHADO">Compartilhado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}