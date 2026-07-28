import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserCheck, UserX, Clock, TrendingUp, CheckCircle, XCircle, Edit, Loader2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function DashboardAdmin() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    full_name: '',
    telefone: '',
    cargo: '',
    empresa: '',
    observacoes: '',
    role: 'user'
  });

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['todos-usuarios'],
    queryFn: () => base44.entities.User.list('-created_date', 1000),
    enabled: currentUser?.role === 'admin'
  });

  const aprovarMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { status: 'ativo' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['todos-usuarios']);
      toast.success('Usuário aprovado com sucesso!');
    },
    onError: (err) => toast.error('Erro ao aprovar usuário: ' + err.message)
  });

  const rejeitarMutation = useMutation({
    mutationFn: (userId) => base44.entities.User.update(userId, { status: 'rejeitado' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['todos-usuarios']);
      toast.success('Usuário rejeitado');
    },
    onError: (err) => toast.error('Erro ao rejeitar usuário: ' + err.message)
  });

  const atualizarMutation = useMutation({
    mutationFn: ({ userId, data }) => base44.entities.User.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['todos-usuarios']);
      toast.success('Usuário atualizado e aprovado!');
      setEditingUser(null);
    },
    onError: (err) => toast.error('Erro ao atualizar: ' + err.message)
  });

  const handleEditOpen = (user) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || '',
      telefone: user.telefone || '',
      cargo: user.cargo || '',
      empresa: user.empresa || '',
      observacoes: user.observacoes || '',
      role: user.role || 'user'
    });
  };

  const handleEditSave = () => {
    atualizarMutation.mutate({
      userId: editingUser.id,
      data: { ...editForm, status: 'ativo' }
    });
  };

  if (!['admin', 'programador'].includes(currentUser?.role) && currentUser?.acesso_global !== true) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6"><PageSkeleton /></div>;
  }

  // Métricas
  const totalUsuarios = usuarios.length;
  const usuariosPendentes = usuarios.filter(u => u.status === 'aguardando_aprovacao').length;
  const usuariosAtivos = usuarios.filter(u => u.status === 'ativo').length;
  const usuariosRejeitados = usuarios.filter(u => u.status === 'rejeitado').length;

  // Dados para gráfico de tendências (últimos 30 dias)
  const ultimos30Dias = Array.from({ length: 30 }, (_, i) => {
    const data = subDays(new Date(), 29 - i);
    const dataStr = format(startOfDay(data), 'yyyy-MM-dd');
    const usuariosNoDia = usuarios.filter(u => {
      const criadoEm = format(startOfDay(new Date(u.created_date)), 'yyyy-MM-dd');
      return criadoEm === dataStr;
    }).length;
    
    return {
      data: format(data, 'dd/MM'),
      usuarios: usuariosNoDia
    };
  });

  // Dados para gráfico de pizza
  const dadosPizza = [
    { name: 'Ativos', value: usuariosAtivos, color: '#10B981' },
    { name: 'Pendentes', value: usuariosPendentes, color: '#F59E0B' },
    { name: 'Rejeitados', value: usuariosRejeitados, color: '#EF4444' }
  ];

  // Usuários pendentes para ação rápida
  const pendentes = usuarios.filter(u => u.status === 'aguardando_aprovacao');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600 mt-1">Visão geral e gestão de usuários do sistema</p>
        </div>
        <Link to={createPageUrl('AprovacaoUsuarios')}>
          <Button>
            <Users className="w-4 h-4 mr-2" />
            Gerenciar Usuários
          </Button>
        </Link>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total de Usuários</CardTitle>
            <Users className="w-5 h-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalUsuarios}</div>
            <p className="text-xs text-gray-500 mt-1">Todos os usuários cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pendentes</CardTitle>
            <Clock className="w-5 h-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{usuariosPendentes}</div>
            <p className="text-xs text-gray-500 mt-1">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Ativos</CardTitle>
            <UserCheck className="w-5 h-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{usuariosAtivos}</div>
            <p className="text-xs text-gray-500 mt-1">Usuários com acesso ativo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Rejeitados</CardTitle>
            <UserX className="w-5 h-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{usuariosRejeitados}</div>
            <p className="text-xs text-gray-500 mt-1">Acesso não concedido</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Tendência de Novos Usuários (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ultimos30Dias}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="usuarios" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="Novos Usuários"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dadosPizza}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dadosPizza.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ações Rápidas - Usuários Pendentes */}
      {pendentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              Ações Rápidas - Usuários Pendentes ({pendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendentes.slice(0, 5).map((user) => (
                <div 
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{user.full_name || 'Nome não informado'}</h4>
                        <p className="text-sm text-gray-600">{user.email}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>
                    </div>
                    <div className="mt-2 flex gap-4 text-sm text-gray-600">
                      {user.cargo && <span>{user.cargo}</span>}
                      {user.empresa && <span>{user.empresa}</span>}
                      {user.telefone && <span>{user.telefone}</span>}
                    </div>
                    {user.observacoes && (
                      <p className="mt-2 text-sm text-gray-600 italic">"{user.observacoes}"</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditOpen(user)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => aprovarMutation.mutate(user.id)}
                      disabled={aprovarMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => rejeitarMutation.mutate(user.id)}
                      disabled={rejeitarMutation.isPending}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
              {pendentes.length > 5 && (
                <div className="text-center pt-2">
                  <Link to={createPageUrl('AprovacaoUsuarios')}>
                    <Button variant="outline">
                      Ver todos os {pendentes.length} usuários pendentes
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de Atividade Recente */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {usuarios.slice(0, 10).map((user) => (
              <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{user.full_name || user.email}</p>
                  <p className="text-sm text-gray-500">
                    {format(new Date(user.created_date), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge 
                  className={
                    user.status === 'ativo' ? 'bg-green-100 text-green-800' :
                    user.status === 'aguardando_aprovacao' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }
                >
                  {user.status === 'ativo' ? 'Ativo' : 
                   user.status === 'aguardando_aprovacao' ? 'Pendente' : 'Rejeitado'}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-2xl">
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
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={editForm.telefone}
                  onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função</Label>
                <Input
                  id="cargo"
                  value={editForm.cargo}
                  onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}
                  placeholder="Ex: Engenheiro"
                />
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
            <Button onClick={handleEditSave} disabled={atualizarMutation.isPending}>
              {atualizarMutation.isPending ? (
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