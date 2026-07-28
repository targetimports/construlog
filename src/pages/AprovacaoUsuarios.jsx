import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Ban, Loader2, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import UserAvatar from '@/components/shared/UserAvatar';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function AprovacaoUsuarios() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ 
    full_name: '', 
    role: 'user',
    telefone: '',
    cargo: '',
    empresa: '',
    observacoes: ''
  });

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === 'admin'
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      toast.success('Usuário atualizado com sucesso!');
      setEditingUser(null);
    },
    onError: (err) => {
      toast.error('Erro ao atualizar: ' + err.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['allUsers']);
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao excluir: ' + err.message);
    },
  });

  const handleApprove = (user) => {
    updateUserMutation.mutate({ 
      userId: user.id, 
      data: { status: 'ativo' }
    });
  };

  const handleReject = (user) => {
    updateUserMutation.mutate({ 
      userId: user.id, 
      data: { status: 'rejeitado' }
    });
  };

  const handleDelete = (user) => {
    if (confirm(`Tem certeza que deseja excluir o usuário ${user.full_name || user.email}?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const handleEditOpen = (user) => {
    setEditingUser(user);
    setEditForm({ 
      full_name: user.full_name || '', 
      role: user.role || 'user',
      telefone: user.telefone || '',
      cargo: user.cargo || '',
      empresa: user.empresa || '',
      observacoes: user.observacoes || ''
    });
  };

  const handleEditSave = () => {
    updateUserMutation.mutate({ 
      userId: editingUser.id, 
      data: { ...editForm, status: 'ativo' }
    });
  };

  if (!['admin', 'programador'].includes(currentUser?.role) && currentUser?.acesso_global !== true) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-600">Acesso restrito a administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <PageSkeleton kpis={0} rows={6} cols={7} />
      </div>
    );
  }

  const pendingUsers = users?.filter(user => user.status === 'aguardando_aprovacao') || [];
  const activeUsers = users?.filter(user => user.status === 'ativo') || [];
  const rejectedUsers = users?.filter(user => user.status === 'rejeitado') || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Aprovação de Usuários</h1>
        <p className="text-gray-600 mt-1">Gerencie as solicitações de novos usuários e seus status.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários Aguardando Aprovação ({pendingUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingUsers.length === 0 ? (
            <p className="text-gray-500">Nenhum usuário aguardando aprovação.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={user} size="sm" />
                        {user.full_name || 'Sem nome'}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.telefone || '-'}</TableCell>
                    <TableCell>{user.cargo || '-'}</TableCell>
                    <TableCell>{user.empresa || '-'}</TableCell>
                    <TableCell>{format(new Date(user.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditOpen(user)}
                          disabled={updateUserMutation.isPending}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApprove(user)}
                          disabled={updateUserMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleReject(user)}
                          disabled={updateUserMutation.isPending}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usuários Ativos ({activeUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {activeUsers.length === 0 ? (
            <p className="text-gray-500">Nenhum usuário ativo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={user} size="sm" />
                        {user.full_name || 'Sem nome'}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.cargo || '-'}</TableCell>
                    <TableCell>{format(new Date(user.created_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">
                        Ativo
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {rejectedUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Usuários Rejeitados ({rejectedUsers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de Criação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejectedUsers.map(user => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={user} size="sm" />
                        {user.full_name || 'Sem nome'}
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{format(new Date(user.created_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>
                      <Badge className="bg-red-100 text-red-800">
                        Rejeitado
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(user)}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar e Aprovar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo</Label>
              <Input
                id="full_name"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                placeholder="Digite o nome completo"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={editForm.telefone}
                  onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função</Label>
                <Select
                  value={editForm.cargo}
                  onValueChange={(value) => setEditForm({ ...editForm, cargo: value })}
                >
                  <SelectTrigger id="cargo">
                    <SelectValue placeholder="Selecione seu cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Engenheiro Civil">Engenheiro Civil</SelectItem>
                    <SelectItem value="Arquiteto">Arquiteto</SelectItem>
                    <SelectItem value="Mestre de Obras">Mestre de Obras</SelectItem>
                    <SelectItem value="Encarregado">Encarregado</SelectItem>
                    <SelectItem value="Gerente de Projetos">Gerente de Projetos</SelectItem>
                    <SelectItem value="Orçamentista">Orçamentista</SelectItem>
                    <SelectItem value="Comprador">Comprador</SelectItem>
                    <SelectItem value="Almoxarife">Almoxarife</SelectItem>
                    <SelectItem value="Fiscal de Obra">Fiscal de Obra</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Motorista">Motorista</SelectItem>
                    <SelectItem value="Diretor">Diretor</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={editForm.empresa}
                onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações / Motivo do Acesso</Label>
              <Textarea
                id="observacoes"
                value={editForm.observacoes}
                onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                placeholder="Motivo da solicitação"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Nível de Acesso</Label>
              <Select
                value={editForm.role}
                onValueChange={(value) => setEditForm({ ...editForm, role: value })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button onClick={handleEditSave} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar e Aprovar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}