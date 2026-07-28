import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, Search, User, Phone, Mail, Calendar, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import SupervisorIAFuncao from '../components/ia/SupervisorIAFuncao';

const statusConfig = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  ferias: { label: 'Férias', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  afastado: { label: 'Afastado', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  desligado: { label: 'Desligado', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

export default function Motoristas() {
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState(null);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    cnh: '',
    categoria_cnh: 'D',
    validade_cnh: '',
    telefone: '',
    email: '',
    user_id: '',
    data_admissao: '',
    status: 'ativo',
    observacoes: ''
  });

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const isMotorista = currentUser?.cargo?.toLowerCase() === 'motorista' || currentUser?.perfil_acesso?.toLowerCase() === 'motorista';
  const isAdmin = !isMotorista && (currentUser?.role === 'admin' || currentUser?.cargo === 'admin_empresa' || currentUser?.perfil_acesso === 'logistica');

  const { data: motoristas = [], isLoading } = useQuery({
    queryKey: ['motoristas'],
    queryFn: () => base44.entities.Motorista.list('-created_date', 100)
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Motorista.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motoristas'] });
      toast.success('Motorista cadastrado!');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Motorista.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['motoristas'] });
      toast.success('Motorista atualizado!');
      resetForm();
    }
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      cpf: '',
      cnh: '',
      categoria_cnh: 'D',
      validade_cnh: '',
      telefone: '',
      email: '',
      user_id: '',
      data_admissao: '',
      status: 'ativo',
      observacoes: ''
    });
    setEditingMotorista(null);
    setDialogOpen(false);
  };

  const handleEdit = (motorista) => {
    setEditingMotorista(motorista);
    setFormData({
      nome: motorista.nome || '',
      cpf: motorista.cpf || '',
      cnh: motorista.cnh || '',
      categoria_cnh: motorista.categoria_cnh || 'D',
      validade_cnh: motorista.validade_cnh || '',
      telefone: motorista.telefone || '',
      email: motorista.email || '',
      user_id: motorista.user_id || '',
      data_admissao: motorista.data_admissao || '',
      status: motorista.status || 'ativo',
      observacoes: motorista.observacoes || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.user_id) {
      toast.error('Usuário do sistema é obrigatório');
      return;
    }
    if (editingMotorista) {
      updateMutation.mutate({ id: editingMotorista.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  // Usuários já associados a motoristas
  const usuariosAssociados = motoristas
    .filter(m => m.user_id && m.id !== editingMotorista?.id)
    .map(m => m.user_id);

  // Usuários disponíveis
  const usuariosDisponiveis = usuarios.filter(u => !usuariosAssociados.includes(u.email));

  const isCadastroPendente = (motorista) => {
    return !motorista.nome || !motorista.cpf || !motorista.cnh || !motorista.user_id;
  };

  const filteredMotoristas = motoristas.filter(m => 
    m.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.cpf?.includes(searchTerm) ||
    m.cnh?.includes(searchTerm)
  );

  // Separar motoristas com cadastro completo e pendente
  const motoristasCadastroCompleto = filteredMotoristas.filter(m => !isCadastroPendente(m));
  const motoristasCadastroPendente = filteredMotoristas.filter(m => isCadastroPendente(m));

  // CNH vencendo em 30 dias
  const trintaDias = new Date();
  trintaDias.setDate(trintaDias.getDate() + 30);
  const cnhsVencendo = motoristas.filter(m => 
    m.status === 'ativo' && 
    m.validade_cnh && 
    new Date(m.validade_cnh) <= trintaDias
  );

  const ativos = motoristas.filter(m => m.status === 'ativo').length;

  if (isMotorista) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">Acesso Restrito</h3>
          <p className="text-gray-500 mt-1">Você não tem permissão para acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        subtitle="Cadastro de motoristas da frota"
        action={isAdmin ? () => { resetForm(); setDialogOpen(true); } : undefined}
        actionLabel="Novo Motorista"
      />

      {/* Supervisor */}
      <SupervisorIAFuncao funcao="motorista" />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Motoristas"
          value={motoristas.length}
          icon={User}
          iconBg="bg-blue-500/10"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Ativos"
          value={ativos}
          icon={User}
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="CNH Vencendo"
          value={cnhsVencendo.length}
          icon={AlertTriangle}
          iconBg="bg-amber-500/10"
          iconColor="text-amber-500"
        />
      </div>

      {/* Alertas */}
      {cnhsVencendo.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-amber-400 font-medium mb-2">
                  {cnhsVencendo.length} CNH(s) vencendo nos próximos 30 dias
                </p>
                <div className="space-y-1">
                  {cnhsVencendo.map(m => (
                    <p key={m.id} className="text-amber-300 text-sm">
                      • {m.nome} - Vence em {new Date(m.validade_cnh).toLocaleDateString('pt-BR')}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtro */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          placeholder="Buscar por nome, CPF ou CNH..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : filteredMotoristas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nenhum motorista</h3>
            <p className="text-gray-600 mb-6">Nenhum motorista cadastrado</p>
            {isAdmin && (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Motorista
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Motoristas com Cadastro Completo */}
          {motoristasCadastroCompleto.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-gray-900">Cadastro Completo</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {motoristasCadastroCompleto.map(motorista => {
                  const status = statusConfig[motorista.status];
                  const cnhVencendo = motorista.validade_cnh && new Date(motorista.validade_cnh) <= trintaDias;

                  return (
                    <Card
                      key={motorista.id}
                      className={cn("shadow-sm transition-all", isAdmin ? "hover:shadow-md cursor-pointer" : "")}
                      onClick={isAdmin ? () => handleEdit(motorista) : undefined}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-gray-900 font-semibold">{motorista.nome}</h3>
                            <p className="text-gray-600 text-sm">CNH: {motorista.cnh} ({motorista.categoria_cnh})</p>
                          </div>
                          <Badge className={cn("border", status.color)}>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          {motorista.telefone && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4" />
                              <span>{motorista.telefone}</span>
                            </div>
                          )}
                          {motorista.email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span className="truncate">{motorista.email}</span>
                            </div>
                          )}
                          {motorista.validade_cnh && (
                            <div className={cn(
                              "flex items-center gap-2",
                              cnhVencendo ? "text-amber-600" : "text-gray-600"
                            )}>
                              <Calendar className="w-4 h-4" />
                              <span>CNH válida até {new Date(motorista.validade_cnh).toLocaleDateString('pt-BR')}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Motoristas com Cadastro Pendente */}
          {motoristasCadastroPendente.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-amber-900">Cadastro Pendente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {motoristasCadastroPendente.map(motorista => {
                  return (
                    <Card
                      key={motorista.id}
                      className={cn("shadow-sm transition-all border-amber-200 bg-amber-50", isAdmin ? "hover:shadow-md cursor-pointer" : "")}
                      onClick={isAdmin ? () => handleEdit(motorista) : undefined}
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-gray-900 font-semibold">{motorista.nome || 'Nome não preenchido'}</h3>
                            <p className="text-gray-600 text-sm">CNH: {motorista.cnh || '-'} ({motorista.categoria_cnh || '-'})</p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 border">
                            Pendente
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="text-amber-700 font-medium">Campos a preencher:</div>
                          <ul className="text-amber-600 text-xs space-y-1 pl-4 list-disc">
                            {!motorista.nome && <li>Nome</li>}
                            {!motorista.cpf && <li>CPF</li>}
                            {!motorista.cnh && <li>CNH</li>}
                            {!motorista.user_id && <li>Usuário do Sistema</li>}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingMotorista ? 'Editar Motorista' : 'Novo Motorista'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>CPF *</Label>
                <Input
                  mask="cpf"
                  placeholder="000.000.000-00"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>CNH *</Label>
                <Input
                  value={formData.cnh}
                  onChange={(e) => setFormData({ ...formData, cnh: e.target.value })}
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Categoria CNH</Label>
                <Select value={formData.categoria_cnh} onValueChange={(v) => setFormData({ ...formData, categoria_cnh: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'].map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Validade CNH</Label>
                <Input
                  type="date"
                  value={formData.validade_cnh}
                  onChange={(e) => setFormData({ ...formData, validade_cnh: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  mask="telefone"
                  placeholder="(00) 00000-0000"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="col-span-2">
                <Label>Usuário do Sistema *</Label>
                <Select value={formData.user_id} onValueChange={(v) => setFormData({ ...formData, user_id: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosDisponiveis.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">Nenhum usuário disponível</div>
                    ) : (
                      usuariosDisponiveis.map(u => (
                        <SelectItem key={u.email} value={u.email}>
                          {u.full_name} ({u.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-gray-500 text-xs mt-1">Usuário do sistema para acesso à aplicação</p>
              </div>
              <div>
                <Label>Data Admissão</Label>
                <Input
                  type="date"
                  value={formData.data_admissao}
                  onChange={(e) => setFormData({ ...formData, data_admissao: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="afastado">Afastado</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}