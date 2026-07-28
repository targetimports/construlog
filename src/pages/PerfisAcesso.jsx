import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { 
  Plus, 
  Search, 
  Shield,
  Edit,
  Trash2,
  Users,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import PageHeader from '../components/ui/PageHeader';
import { CardGridSkeleton } from '@/components/shared/Skeletons';

const permissoesDisponiveis = [
  { id: 'obras_visualizar', label: 'Visualizar Obras', categoria: 'Obras' },
  { id: 'obras_criar', label: 'Criar Obras', categoria: 'Obras' },
  { id: 'obras_editar', label: 'Editar Obras', categoria: 'Obras' },
  { id: 'obras_excluir', label: 'Excluir Obras', categoria: 'Obras' },
  
  { id: 'orcamentos_visualizar', label: 'Visualizar Orçamentos', categoria: 'Orçamentos' },
  { id: 'orcamentos_criar', label: 'Criar Orçamentos', categoria: 'Orçamentos' },
  { id: 'orcamentos_editar', label: 'Editar Orçamentos', categoria: 'Orçamentos' },
  { id: 'orcamentos_aprovar', label: 'Aprovar Orçamentos', categoria: 'Orçamentos' },
  
  { id: 'financeiro_visualizar', label: 'Visualizar Financeiro', categoria: 'Financeiro' },
  { id: 'financeiro_criar', label: 'Criar Lançamentos', categoria: 'Financeiro' },
  { id: 'financeiro_editar', label: 'Editar Lançamentos', categoria: 'Financeiro' },
  { id: 'financeiro_aprovar', label: 'Aprovar Pagamentos', categoria: 'Financeiro' },
  
  { id: 'compras_visualizar', label: 'Visualizar Compras', categoria: 'Compras' },
  { id: 'compras_solicitar', label: 'Solicitar Compras', categoria: 'Compras' },
  { id: 'compras_aprovar', label: 'Aprovar Compras', categoria: 'Compras' },
  { id: 'compras_comprar', label: 'Efetuar Compras', categoria: 'Compras' },
  
  { id: 'estoque_visualizar', label: 'Visualizar Estoque', categoria: 'Estoque' },
  { id: 'estoque_movimentar', label: 'Movimentar Estoque', categoria: 'Estoque' },
  
  { id: 'colaboradores_visualizar', label: 'Visualizar Colaboradores', categoria: 'RH' },
  { id: 'colaboradores_gerenciar', label: 'Gerenciar Colaboradores', categoria: 'RH' },
  
  { id: 'relatorios_visualizar', label: 'Visualizar Relatórios', categoria: 'Relatórios' },
  { id: 'relatorios_exportar', label: 'Exportar Relatórios', categoria: 'Relatórios' },
  
  { id: 'configuracoes_acessar', label: 'Acessar Configurações', categoria: 'Sistema' },
  { id: 'usuarios_gerenciar', label: 'Gerenciar Usuários', categoria: 'Sistema' }
];

export default function PerfisAcesso() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPerfil, setEditingPerfil] = useState(null);
  const [perfilToDelete, setPerfilToDelete] = useState(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    permissoes: []
  });

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['perfis-acesso'],
    queryFn: () => base44.entities.PerfilAcesso.list('-created_date', 100)
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: () => base44.entities.Colaborador.list('-created_date', 500)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PerfilAcesso.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso'] });
      toast.success('Perfil de acesso criado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao criar perfil: ' + (error?.message || 'Tente novamente'));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PerfilAcesso.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso'] });
      toast.success('Perfil de acesso atualizado!');
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('Erro ao atualizar perfil: ' + (error?.message || 'Tente novamente'));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PerfilAcesso.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['perfis-acesso'] });
      toast.success('Perfil de acesso excluído!');
      setDeleteDialogOpen(false);
      setPerfilToDelete(null);
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      permissoes: []
    });
    setEditingPerfil(null);
  };

  const handleEdit = (perfil) => {
    setEditingPerfil(perfil);
    setFormData({
      nome: perfil.nome || '',
      descricao: perfil.descricao || '',
      permissoes: perfil.permissoes || []
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Nome do perfil é obrigatório');
      return;
    }
    if (editingPerfil) {
      updateMutation.mutate({ id: editingPerfil.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const togglePermissao = (permissaoId) => {
    setFormData(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(permissaoId)
        ? prev.permissoes.filter(p => p !== permissaoId)
        : [...prev.permissoes, permissaoId]
    }));
  };

  const filteredPerfis = perfis.filter(p => 
    p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descricao?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getColaboradoresCount = (perfilId) => {
    return colaboradores.filter(c => c.perfil_acesso_id === perfilId).length;
  };

  const categorias = [...new Set(permissoesDisponiveis.map(p => p.categoria))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Perfis de Acesso"
        subtitle={`${perfis.length} perfis cadastrados`}
        action={() => { resetForm(); setDialogOpen(true); }}
        actionLabel="Novo Perfil"
      />

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          placeholder="Buscar perfis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <CardGridSkeleton count={6} cols="md:grid-cols-2 xl:grid-cols-3" />
      ) : filteredPerfis.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum perfil encontrado</h3>
            <p className="text-gray-600 mb-6">Crie perfis de acesso para controlar permissões dos colaboradores</p>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Perfil
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPerfis.map(perfil => (
            <Card key={perfil.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{perfil.nome}</CardTitle>
                      <CardDescription className="mt-1">
                        {perfil.permissoes?.length || 0} permissões
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {perfil.descricao && (
                  <p className="text-sm text-gray-600">{perfil.descricao}</p>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="w-4 h-4" />
                  <span>{getColaboradoresCount(perfil.id)} colaboradores</span>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(perfil)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPerfilToDelete(perfil);
                      setDeleteDialogOpen(true);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Criar/Editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPerfil ? 'Editar Perfil de Acesso' : 'Novo Perfil de Acesso'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Nome do Perfil *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Engenheiro, Administrativo, Gestor"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Descreva as responsabilidades deste perfil..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold">Permissões</Label>
              <p className="text-sm text-gray-600 mt-1">Selecione as permissões para este perfil</p>
              
              <div className="mt-4 space-y-6">
                {categorias.map(categoria => {
                  const permissoesCategoria = permissoesDisponiveis.filter(p => p.categoria === categoria);
                  return (
                    <div key={categoria} className="border rounded-lg p-4">
                      <h4 className="font-semibold text-sm text-gray-900 mb-3">{categoria}</h4>
                      <div className="space-y-3">
                        {permissoesCategoria.map(permissao => (
                          <div key={permissao.id} className="flex items-center justify-between">
                            <label htmlFor={permissao.id} className="text-sm text-gray-700 cursor-pointer flex-1">
                              {permissao.label}
                            </label>
                            <Switch
                              id={permissao.id}
                              checked={formData.permissoes.includes(permissao.id)}
                              onCheckedChange={() => togglePermissao(permissao.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || !formData.nome.trim()}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Perfil de Acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o perfil "{perfilToDelete?.nome}"? 
              {getColaboradoresCount(perfilToDelete?.id) > 0 && (
                <span className="block mt-2 text-amber-600 font-medium">
                  Atenção: {getColaboradoresCount(perfilToDelete?.id)} colaborador(es) estão usando este perfil.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(perfilToDelete.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}