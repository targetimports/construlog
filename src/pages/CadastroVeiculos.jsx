import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Truck, Search, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

const statusColors = {
  ativo: 'bg-green-100 text-green-700',
  manutencao: 'bg-yellow-100 text-yellow-700',
  inativo: 'bg-red-100 text-red-700'
};

const emptyForm = {
  placa: '', modelo: '', marca: '', ano: '', tipo: 'carro',
  combustivel: 'gasolina', status: 'ativo', km_atual: '',
  cor: '', chassis: '', renavam: '', observacoes: ''
};

export default function CadastroVeiculos() {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: veiculos = [], isLoading } = useQuery({
    queryKey: ['veiculos'],
    queryFn: () => base44.entities.Veiculo.list('-created_date', 200)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Veiculo.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos'] }); toast.success('Veículo cadastrado!'); closeDialog(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Veiculo.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos'] }); toast.success('Veículo atualizado!'); closeDialog(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.functions.invoke('excluirVeiculoComAtivo', { veiculo_id: id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['veiculos'] }); queryClient.invalidateQueries({ queryKey: ['ativos'] }); toast.success('Veículo removido!'); }
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...emptyForm, ...v }); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(emptyForm); };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.placa || !form.modelo) { toast.error('Placa e modelo são obrigatórios'); return; }
    const data = { ...form, km_atual: form.km_atual ? parseFloat(form.km_atual) : 0 };
    if (editing) updateMutation.mutate({ id: editing.id, data });
    else createMutation.mutate(data);
  };

  const filtered = veiculos.filter(v =>
    v.placa?.toLowerCase().includes(search.toLowerCase()) ||
    v.modelo?.toLowerCase().includes(search.toLowerCase()) ||
    v.marca?.toLowerCase().includes(search.toLowerCase())
  );

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastro de Veículos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os veículos da frota</p>
        </div>
        <Button onClick={openNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Novo Veículo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {['ativo', 'manutencao', 'inativo'].map(s => (
          <Card key={s}>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{veiculos.filter(v => v.status === s).length}</p>
              <p className="text-sm text-gray-500 capitalize">{s === 'manutencao' ? 'Em Manutenção' : s === 'ativo' ? 'Ativos' : 'Inativos'}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input placeholder="Buscar por placa, modelo ou marca..." value={search}
          onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Lista */}
      {isLoading ? (
        <CardGridSkeleton count={6} cols="" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum veículo encontrado</p>
            <Button className="mt-4" onClick={openNew}><Plus className="w-4 h-4 mr-2" />Cadastrar Veículo</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(v => (
            <Card key={v.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                      <Truck className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{v.placa}</span>
                        <span className="text-gray-600">—</span>
                        <span className="font-medium text-gray-800">{v.marca} {v.modelo}</span>
                        <Badge className={statusColors[v.status] || 'bg-gray-100 text-gray-700'}>
                          {v.status === 'manutencao' ? 'Em Manutenção' : v.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm text-gray-500">
                        {v.ano && <span>Ano: {v.ano}</span>}
                        {v.tipo && <span>Tipo: {v.tipo}</span>}
                        {v.combustivel && <span>Comb: {v.combustivel}</span>}
                        {v.km_atual > 0 && <span>KM: {v.km_atual?.toLocaleString('pt-BR')}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(v)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700"
                      onClick={() => { if (confirm('Excluir este veículo?')) deleteMutation.mutate(v.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Veículo' : 'Novo Veículo'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Placa *</Label>
                <Input value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
                  placeholder="ABC-1234" className="mt-1.5" required />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="manutencao">Em Manutenção</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Marca</Label>
                <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}
                  placeholder="Ex: Ford, Volkswagen..." className="mt-1.5" />
              </div>
              <div>
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })}
                  placeholder="Ex: Ranger, Gol..." className="mt-1.5" required />
              </div>
              <div>
                <Label>Ano</Label>
                <Input value={form.ano} onChange={(e) => setForm({ ...form, ano: e.target.value })}
                  placeholder="2022" className="mt-1.5" />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })}
                  placeholder="Branco" className="mt-1.5" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="carro">Carro</SelectItem>
                    <SelectItem value="caminhonete">Caminhonete</SelectItem>
                    <SelectItem value="caminhao">Caminhão</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="moto">Moto</SelectItem>
                    <SelectItem value="onibus">Ônibus</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Combustível</Label>
                <Select value={form.combustivel} onValueChange={(v) => setForm({ ...form, combustivel: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gasolina">Gasolina</SelectItem>
                    <SelectItem value="etanol">Etanol</SelectItem>
                    <SelectItem value="flex">Flex</SelectItem>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="gnv">GNV</SelectItem>
                    <SelectItem value="eletrico">Elétrico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>KM Atual</Label>
                <Input type="number" value={form.km_atual} onChange={(e) => setForm({ ...form, km_atual: e.target.value })}
                  placeholder="0" className="mt-1.5" />
              </div>
              <div>
                <Label>RENAVAM</Label>
                <Input value={form.renavam} onChange={(e) => setForm({ ...form, renavam: e.target.value })}
                  placeholder="00000000000" className="mt-1.5" />
              </div>
              <div className="col-span-2">
                <Label>Chassis</Label>
                <Input value={form.chassis} onChange={(e) => setForm({ ...form, chassis: e.target.value })}
                  placeholder="9BWZZZ377VT004251" className="mt-1.5" />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Informações adicionais..." className="mt-1.5" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}