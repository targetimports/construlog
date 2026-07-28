import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Search, BarChart3, Calendar, Wrench, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import AgendamentoEquipamento from '../components/equipamentos/AgendamentoEquipamento';
import ManutencaoEquipamento from '../components/equipamentos/ManutencaoEquipamento';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const TIPO_LABEL = {
  veiculo: 'Veículo',
  maquinaria: 'Maquinaria',
  ferramenta: 'Ferramenta',
  equipamento_geral: 'Equipamento Geral',
};

const STATUS_BADGE = {
  ativo: 'bg-emerald-100 text-emerald-700 border-0',
  manutencao: 'bg-amber-100 text-amber-700 border-0',
  aposentado: 'bg-gray-100 text-gray-700 border-0',
};
const STATUS_LABEL = { ativo: 'Ativo', manutencao: 'Manutenção', aposentado: 'Aposentado' };

const ITENS_POR_PAGINA = 15;
const FORM_VAZIO = { nome: '', tipo: 'equipamento_geral', placa: '', custo_hora: 0, custo_diaria: 0, consumo_medio: 0, status: 'ativo', observacoes: '' };
const lbl = 'block text-sm font-medium text-gray-700 mb-1';

export default function Equipamentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [pagina, setPagina] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: equipamentos = [] } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: () => base44.entities.Equipamento.list()
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['equipamentos'] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Equipamento.create(data),
    onSuccess: () => { invalidar(); setShowForm(false); setFormData(FORM_VAZIO); toast.success('Equipamento criado com sucesso'); },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Equipamento.update(id, data),
    onSuccess: () => { invalidar(); setShowForm(false); setEditingId(null); setFormData(FORM_VAZIO); toast.success('Equipamento atualizado com sucesso'); },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Equipamento.delete(id),
    onSuccess: () => { invalidar(); queryClient.invalidateQueries({ queryKey: ['ativos'] }); toast.success('Equipamento removido'); setExcluir(null); },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const handleSubmit = () => {
    if (!formData.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = {
      ...formData,
      custo_hora: Number(formData.custo_hora) || 0,
      custo_diaria: Number(formData.custo_diaria) || 0,
      consumo_medio: Number(formData.consumo_medio) || 0,
    };
    if (editingId) updateMutation.mutate({ id: editingId, data: payload });
    else createMutation.mutate(payload);
  };

  const handleEdit = (equip) => {
    setFormData({ ...FORM_VAZIO, ...equip });
    setEditingId(equip.id);
    setShowForm(true);
  };

  const abrirNovo = () => { setFormData(FORM_VAZIO); setEditingId(null); setShowForm(true); };

  const filtered = useMemo(() => equipamentos.filter(e =>
    (e.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.placa || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [equipamentos, searchTerm]);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / ITENS_POR_PAGINA));
  const pClamp = Math.min(pagina, totalPaginas);
  const inicio = (pClamp - 1) * ITENS_POR_PAGINA;
  const pagaResultados = filtered.slice(inicio, inicio + ITENS_POR_PAGINA);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader title="Gestão de Equipamentos" subtitle="Cadastro, agendamento e manutenção de equipamentos" />
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(createPageUrl('DashboardEquipamentos'))} className="gap-2">
            <BarChart3 className="w-4 h-4" /> Dashboard
          </Button>
          <Button onClick={abrirNovo} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Novo Equipamento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="lista" className="w-full">
        <TabsList className="bg-white border border-gray-200">
          <TabsTrigger value="lista" className="gap-2"><Search className="w-4 h-4" /> Lista de Equipamentos</TabsTrigger>
          <TabsTrigger value="agendamento" className="gap-2"><Calendar className="w-4 h-4" /> Agendamento</TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-2"><Wrench className="w-4 h-4" /> Manutenção</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-4 mt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou placa..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPagina(1); }}
              className="pl-10 h-11"
            />
          </div>

          <Card className="bg-white border-gray-200">
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="py-16 text-center text-gray-500">Nenhum equipamento encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="p-3 text-left text-xs font-semibold text-gray-500">Nome</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-500">Tipo</th>
                        <th className="p-3 text-left text-xs font-semibold text-gray-500">Placa</th>
                        <th className="p-3 text-right text-xs font-semibold text-gray-500">Custo/h</th>
                        <th className="p-3 text-right text-xs font-semibold text-gray-500">Custo/dia</th>
                        <th className="p-3 text-center text-xs font-semibold text-gray-500">Status</th>
                        <th className="p-3 text-right text-xs font-semibold text-gray-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pagaResultados.map(equip => (
                        <tr key={equip.id} className="hover:bg-gray-50">
                          <td className="p-3">
                            <div className="flex items-center gap-2 font-medium text-gray-900">
                              {equip.nome}
                              {equip.ativo_id && <Link2 className="w-3.5 h-3.5 text-blue-400" title="Vinculado a um Ativo (patrimônio)" />}
                            </div>
                          </td>
                          <td className="p-3 text-gray-600">{TIPO_LABEL[equip.tipo] || equip.tipo}</td>
                          <td className="p-3 text-gray-600">{equip.placa || '—'}</td>
                          <td className="p-3 text-right text-gray-700">R$ {(Number(equip.custo_hora) || 0).toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-right text-gray-700">R$ {(Number(equip.custo_diaria) || 0).toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-center">
                            <Badge className={STATUS_BADGE[equip.status] || 'bg-gray-100 text-gray-700 border-0'}>
                              {STATUS_LABEL[equip.status] || equip.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(equip)} className="text-blue-600 hover:text-blue-700 h-8 w-8">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setExcluir(equip)} className="text-red-600 hover:text-red-700 h-8 w-8">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {filtered.length > ITENS_POR_PAGINA && (
                <div className="flex items-center justify-between p-3 border-t border-gray-100">
                  <span className="text-xs text-gray-500">Mostrando {inicio + 1}–{Math.min(inicio + ITENS_POR_PAGINA, filtered.length)} de {filtered.length}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pClamp <= 1} onClick={() => setPagina(Math.max(1, pClamp - 1))} className="h-8 gap-1 border-gray-300 text-gray-700"><ChevronLeft className="w-4 h-4" /> Anterior</Button>
                    <span className="text-xs text-gray-600">Página {pClamp} de {totalPaginas}</span>
                    <Button variant="outline" size="sm" disabled={pClamp >= totalPaginas} onClick={() => setPagina(Math.min(totalPaginas, pClamp + 1))} className="h-8 gap-1 border-gray-300 text-gray-700">Próxima <ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agendamento" className="mt-6">
          <AgendamentoEquipamento />
        </TabsContent>

        <TabsContent value="manutencao" className="mt-6">
          <ManutencaoEquipamento />
        </TabsContent>
      </Tabs>

      {/* Modal Novo / Editar — padrão do cadastro de Ativo, travado para equipamento */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
            <div>
              <Label className={lbl}>Nome *</Label>
              <Input className="h-11" placeholder="Ex.: Betoneira 400L" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className={lbl}>Tipo</Label>
                <Input className="h-11 bg-gray-50 text-gray-500" value={TIPO_LABEL[formData.tipo] || 'Equipamento Geral'} disabled />
                <p className="text-xs text-gray-400 mt-1">Cadastro exclusivo de equipamentos.</p>
              </div>
              <div>
                <Label className={lbl}>Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                    <SelectItem value="aposentado">Aposentado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className={lbl}>Placa (opcional)</Label>
              <Input className="h-11" placeholder="ABC-1234" value={formData.placa} onChange={(e) => setFormData({ ...formData, placa: e.target.value })} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className={lbl}>Custo/hora (R$)</Label>
                <Input className="h-11" type="number" step="0.01" value={formData.custo_hora} onChange={(e) => setFormData({ ...formData, custo_hora: e.target.value })} />
              </div>
              <div>
                <Label className={lbl}>Custo/dia (R$)</Label>
                <Input className="h-11" type="number" step="0.01" value={formData.custo_diaria} onChange={(e) => setFormData({ ...formData, custo_diaria: e.target.value })} />
              </div>
              <div>
                <Label className={lbl}>Consumo (L/h)</Label>
                <Input className="h-11" type="number" step="0.01" value={formData.consumo_medio} onChange={(e) => setFormData({ ...formData, consumo_medio: e.target.value })} />
              </div>
            </div>

            <div>
              <Label className={lbl}>Observações</Label>
              <Textarea className="min-h-20" placeholder="Observações adicionais" value={formData.observacoes} onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-700">
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (editingId ? 'Atualizar' : 'Criar') + ' Equipamento'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!excluir} onOpenChange={(open) => !open && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogTitle>Excluir equipamento?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir <span className="font-semibold">{excluir?.nome}</span>? Esta ação é irreversível.
            {excluir?.ativo_id && <span className="block mt-2 text-amber-600">Atenção: este equipamento está vinculado a um Ativo (patrimônio). O Ativo não será removido, mas o vínculo ficará desfeito.</span>}
          </AlertDialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(excluir.id)} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
