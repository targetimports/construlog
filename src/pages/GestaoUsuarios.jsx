import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, UserCheck, UserX, Clock, TrendingUp, CheckCircle, XCircle, 
  Edit, Loader2, Shield, UserCog, Save, Trash2, Ban, Check, Plus
} from 'lucide-react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import UserAvatar from '@/components/shared/UserAvatar';
import { menuItems } from '@/components/layout/navigation';
import { PageSkeleton } from '@/components/shared/Skeletons';

export default function GestaoUsuarios() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editingUser, setEditingUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [fromApprovalTab, setFromApprovalTab] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    telefone: '',
    cargo: '',
    empresa: '',
    observacoes: '',
    role: 'user',
    perfil_acesso: 'campo',
    status_acesso: 'pendente',
    permissoes_customizadas: false,
    modulos_customizados: []
  });
  const [usuarioPermissoes, setUsuarioPermissoes] = useState(null);
  const [menusSelecionados, setMenusSelecionados] = useState([]);
  const [configuracoesPadrao, setConfiguracoesPadrao] = useState(null);
  const [editandoConfigPadrao, setEditandoConfigPadrao] = useState(false);
  const [perfilSelecionado, setPerfilSelecionado] = useState(null);
  const [menusPerfil, setMenusPerfil] = useState([]);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'programador';
  const isCompanyAdmin = currentUser?.isCompanyAdmin || currentUser?.perfil_acesso === 'admin' || currentUser?.cargo === 'admin_empresa';
  
  const { data: usuariosBrutos = [], isLoading } = useQuery({
    queryKey: ['todos-usuarios'],
    queryFn: async () => {
      // Busca aprovações sempre via SDK (direto, sem função backend)
      const aprovacoes = await base44.entities.AprovacaoUsuario.list();
      const mapAprovacoes = {};
      if (aprovacoes) {
        aprovacoes.forEach(a => { mapAprovacoes[a.user_email] = a; });
      }

      // Colaboradores (geridos em /Colaboradores) guardam telefone/nome, casados por e-mail.
      const mapColaboradores = {};
      try {
        const colaboradores = await base44.entities.Colaborador.list();
        (colaboradores || []).forEach(c => {
          if (c.email) mapColaboradores[String(c.email).toLowerCase()] = c;
        });
      } catch { /* sem colaboradores: segue sem telefone extra */ }

      // Tenta buscar usuários via função backend; se falhar, usa SDK direto
      let usuariosList = [];
      try {
        const { data } = await base44.functions.invoke('listarTodosUsuarios');
        usuariosList = data || [];
      } catch (err) {
        console.warn('[GestaoUsuarios] Função backend falhou, usando SDK direto:', err.message);
        try {
          usuariosList = await base44.entities.User.list();
        } catch (err2) {
          console.error('[GestaoUsuarios] SDK também falhou:', err2.message);
          usuariosList = [];
        }
      }

      // Merge dos dados
      let usuariosMerged = usuariosList.map(u => {
        const ap = mapAprovacoes[u.email] || {};
        const d = u.data || {}; // dados do usuário ficam no JSONB auth_users.data
        const col = mapColaboradores[String(u.email || '').toLowerCase()] || {}; // /Colaboradores
        return {
          ...u,
          ...d,
          // Usuário com conta real (auth_users) já é ativo; a fila de Aprovação só
          // sobrepõe quando existir registro. Sem isso, todos caíam em "pendente".
          status: ap.status || u.status || d.status || 'ativo',
          status_acesso: ap.status_acesso || u.status_acesso || d.status_acesso || 'ativo',
          full_name: u.full_name || ap.full_name || d.full_name || col.nome || '',
          telefone: ap.telefone || u.telefone || d.telefone || col.telefone || '',
          cargo: ap.cargo || u.cargo || d.cargo || '',
          empresa: ap.empresa || u.empresa || d.empresa || '',
          perfil_acesso: ap.perfil_acesso || u.perfil_acesso || d.perfil_acesso || 'campo',
          observacoes: ap.observacoes || u.observacoes || d.observacoes || ''
        };
      });

      // Adiciona aprovações que não têm User criado ainda
      const usuariosOrfaos = aprovacoes.filter(a => !usuariosList.find(u => u.email === a.user_email)).map(a => ({
        id: `orphan-${a.id}`,
        email: a.user_email,
        full_name: a.full_name,
        role: 'user',
        status: a.status,
        status_acesso: a.status_acesso,
        telefone: a.telefone,
        cargo: a.cargo,
        empresa: a.empresa,
        perfil_acesso: a.perfil_acesso,
        observacoes: a.observacoes,
        created_date: a.created_date,
        is_orphan: true
      }));

      usuariosMerged = [...usuariosMerged, ...usuariosOrfaos];
      console.log('[GestaoUsuarios] Usuarios carregados:', usuariosMerged.length);
      return usuariosMerged;
    },
    enabled: isAdmin || isCompanyAdmin,
    staleTime: 0,
    cacheTime: 0,
    retry: 2
  });

  // Admin da empresa vê TODOS os usuários (inclusive pendentes)
  // O filtro de programadores é apenas para usuários já ativos
  const usuarios = usuariosBrutos;

  const { data: permissoes } = useQuery({
    queryKey: ['permissoes-usuario', usuarioPermissoes?.email],
    queryFn: () => base44.entities.PermissaoUsuario.filter({ user_email: usuarioPermissoes.email }),
    enabled: !!usuarioPermissoes?.email
  });

  const { data: configPadrao } = useQuery({
    queryKey: ['config-padrao-novos-usuarios'],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoSistema.filter({ chave: 'perfil_padrao_novos_usuarios' });
      return configs?.[0] || null;
    }
  });

  const { data: configMenusPerfis } = useQuery({
    queryKey: ['config-menus-perfis'],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoSistema.filter({ chave: 'menus_por_perfil' });
      return configs?.[0] || null;
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }) => {
      console.log('[updateUserMutation] Enviando:', { userId, data });
      
      // Buscar e atualizar AprovacaoUsuario
      const aprovacoes = await base44.entities.AprovacaoUsuario.filter({ user_email: editingUser?.email });
      
      if (aprovacoes && aprovacoes.length > 0) {
        const result = await base44.entities.AprovacaoUsuario.update(aprovacoes[0].id, {
          full_name: data.full_name,
          telefone: data.telefone,
          cargo: data.cargo,
          empresa: data.empresa,
          observacoes: data.observacoes,
          perfil_acesso: data.perfil_acesso,
          status_acesso: data.status_acesso,
          status: data.status
        });
        console.log('[updateUserMutation] Resposta:', result);
        return result;
      } else {
        throw new Error('Registro de aprovação não encontrado');
      }
    },
    onSuccess: async (result, variables) => {
      console.log('[updateUserMutation] Success');
      toast.success('Usuário atualizado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['todos-usuarios'], refetchType: 'all' });
      setEditingUser(null);
    },
    onError: (err) => {
      console.error('[updateUserMutation] Error:', err);
      toast.error('Erro ao atualizar: ' + err.message);
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ id, email, isOrphan }) => {
      console.log('[deleteUserMutation] Deletando:', { id, email, isOrphan });
      
      // Deletar sempre da AprovacaoUsuario (pelo email)
      try {
        const aprovacoes = await base44.entities.AprovacaoUsuario.filter({ user_email: email });
        if (aprovacoes && aprovacoes.length > 0) {
          await base44.entities.AprovacaoUsuario.delete(aprovacoes[0].id);
          console.log('[deleteUserMutation] AprovacaoUsuario deletada');
        }
      } catch (e) {
        console.warn('[deleteUserMutation] Sem AprovacaoUsuario para deletar:', e.message);
      }

      // Se for órfão, não tem User entity para deletar
      if (isOrphan) return { success: true };
      
      // Deletar User entity
      const result = await base44.entities.User.delete(id);
      console.log('[deleteUserMutation] User deletado:', result);
      return result;
    },
    onSuccess: () => {
      console.log('[deleteUserMutation] Success');
      queryClient.invalidateQueries({ queryKey: ['todos-usuarios'] });
      toast.success('Usuário excluído com sucesso!');
    },
    onError: (err) => {
      console.error('[deleteUserMutation] Error:', err);
      toast.error('Erro ao excluir: ' + (err.response?.data?.message || err.message));
    }
  });

  const salvarPermissoesMutation = useMutation({
    mutationFn: async ({ userEmail, menus }) => {
      const permissoesExistentes = await base44.entities.PermissaoUsuario.filter({ user_email: userEmail });
      if (permissoesExistentes && permissoesExistentes.length > 0) {
        return base44.entities.PermissaoUsuario.update(permissoesExistentes[0].id, { menus_visiveis: menus });
      } else {
        return base44.entities.PermissaoUsuario.create({ user_email: userEmail, menus_visiveis: menus });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['permissoes-usuario']);
      toast.success('Permissões salvas!');
    },
    onError: (err) => toast.error('Erro ao salvar: ' + err.message)
  });

  const approveUserMutation = useMutation({
    mutationFn: async ({ userId, userEmail, cargo, role }) => {
      console.log('[approveUserMutation] Aprovando:', { userId, userEmail, cargo, role });
      
      // Chamar função backend com retry automático
      try {
        const { data } = await base44.functions.invoke('aprovarUsuarioV2', {
          userId,
          cargo: cargo || editForm.cargo,
          role: role || editForm.role
        });
        console.log('[approveUserMutation] Backend response:', data);
        return data;
      } catch (err) {
        console.error('[approveUserMutation] Backend error:', err);
        throw err;
      }
    },
    onSuccess: async (data) => {
      toast.success('Usuário aprovado com sucesso!');
      console.log('[approveUserMutation] Snapshot após aprovação:', data);
      setEditingUser(null);
      
      // Aguardar um pouco antes de invalidar para banco processar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Invalidar e fazer refetch imediato
      await queryClient.invalidateQueries({ queryKey: ['todos-usuarios'] });
      await queryClient.refetchQueries({ queryKey: ['todos-usuarios'] });
      
      // Se tiverem permissões, também refrescar menu
      try {
        await base44.functions.invoke('getMenuForBootstrap', {});
      } catch (e) {
        console.warn('[approveUserMutation] Menu refresh failed:', e.message);
      }
    },
    onError: (err) => {
      console.error('[approveUserMutation] Error:', err);
      toast.error('Erro ao aprovar: ' + (err.message || 'Erro desconhecido'));
    }
  });

  const rejectUserMutation = useMutation({
    mutationFn: async ({ userEmail, motivo }) => {
      console.log('[rejectUserMutation] Rejeitando:', userEmail, motivo);
      
      // Buscar AprovacaoUsuario pelo email
      const aprovacoes = await base44.entities.AprovacaoUsuario.filter({ user_email: userEmail });
      
      if (aprovacoes && aprovacoes.length > 0) {
        const result = await base44.entities.AprovacaoUsuario.update(aprovacoes[0].id, {
          status_acesso: 'bloqueado',
          status: 'rejeitado',
          observacoes: motivo || aprovacoes[0].observacoes
        });
        console.log('[rejectUserMutation] Rejeitado:', result);
        return result;
      } else {
        // Criar AprovacaoUsuario se não existir (usuário órfão)
        console.log('[rejectUserMutation] Criando novo registro para:', userEmail);
        const result = await base44.entities.AprovacaoUsuario.create({
          user_email: userEmail,
          status_acesso: 'bloqueado',
          status: 'rejeitado',
          observacoes: motivo || ''
        });
        console.log('[rejectUserMutation] Criado e rejeitado:', result);
        return result;
      }
    },
    onSuccess: async () => {
      toast.success('Usuário rejeitado com sucesso!');
      await queryClient.invalidateQueries({ queryKey: ['todos-usuarios'], refetchType: 'all' });
    },
    onError: (err) => {
      console.error('[rejectUserMutation] Error:', err);
      toast.error('Erro ao rejeitar: ' + (err.message || 'Erro desconhecido'));
    }
  });

  const handleApprove = (user) => {
    approveUserMutation.mutate({ 
      userId: user.id, 
      userEmail: user.email,
      cargo: editForm.cargo,
      role: editForm.role
    });
  };
  const handleReject = (user) => {
    const motivo = prompt('Motivo da rejeição (opcional):');
    rejectUserMutation.mutate({ userEmail: user.email, motivo: motivo || '' });
  };
  const handleDelete = (user) => setUserToDelete(user);
  const confirmarExclusao = () => {
    if (!userToDelete) return;
    deleteUserMutation.mutate({ id: userToDelete.id, email: userToDelete.email, isOrphan: !!userToDelete.is_orphan });
    setUserToDelete(null);
  };

  const handleEditOpen = async (user, fromApproval = false) => {
    setEditingUser(user);
    setFromApprovalTab(fromApproval);
    // Cargo cai pro role quando não houver cargo gravado (ex.: financeiro, motorista).
    const cargoInicial = user.cargo || user.role || '';
    // Status do Acesso só aceita aprovado/pendente/bloqueado; mapeia o status real.
    const statusAcesso = ['aprovado', 'pendente', 'bloqueado'].includes(user.status_acesso)
      ? user.status_acesso
      : (user.status === 'ativo' ? 'aprovado' : (user.status === 'rejeitado' ? 'bloqueado' : 'pendente'));
    setEditForm({
      full_name: user.full_name || '',
      telefone: user.telefone || '',
      cargo: cargoInicial,
      empresa: user.empresa || '',
      observacoes: user.observacoes || '',
      role: user.role || 'user',
      perfil_acesso: user.perfil_acesso || user.perfil_sistema || cargoInicial || 'campo',
      status_acesso: statusAcesso,
      permissoes_customizadas: user.permissoes_customizadas || false,
      modulos_customizados: user.modulos_customizados || []
    });
  };

  const handleEditSave = async (aprovar = false) => {
    // Admin da empresa não pode modificar/criar programadores
    if (isCompanyAdmin && !isAdmin) {
      const isProgramador = editForm.cargo === 'programador' || 
                           editForm.perfil_acesso === 'programador';
      
      if (isProgramador) {
        toast.error('Você não tem permissão para atribuir cargo de programador');
        return;
      }
    }
    
    // Salvar IDs ANTES de fechar
    const userId = editingUser.id;
    const userEmail = editingUser.email;
    
    if (aprovar) {
      // Usar mutation de aprovação
      approveUserMutation.mutate({ userId, userEmail });
    } else {
      // Usar mutation de atualização.
      // Telefone tem fonte única no Colaborador (/Colaboradores) — não duplicar no User.
      const { telefone, ...semTelefone } = editForm;
      const dataToSave = {
        ...semTelefone,
        status: editForm.status_acesso === 'aprovado' ? 'ativo' : 'pendente',
        status_acesso: editForm.status_acesso
      };
      
      updateUserMutation.mutate({
        userId,
        userEmail,
        data: dataToSave
      });
    }
  };

  const handleEditarPermissoes = async (usuario) => {
    setUsuarioPermissoes(usuario);
    const perms = await base44.entities.PermissaoUsuario.filter({ user_email: usuario.email });
    if (perms?.[0]?.menus_visiveis) {
      setMenusSelecionados(perms[0].menus_visiveis);
    } else {
      const cargo = usuario?.cargo?.toLowerCase() || 'default';
      const template = MENUS_POR_CARGO[cargo] || MENUS_POR_CARGO.default;
      setMenusSelecionados(template);
    }
    setActiveTab('permissoes');
  };

  const handleMenuToggle = (menuName) => {
    setMenusSelecionados(prev => 
      prev.includes(menuName) ? prev.filter(m => m !== menuName) : [...prev, menuName]
    );
  };

  const handleAplicarTemplate = () => {
    if (!usuarioPermissoes) return;
    const cargo = usuarioPermissoes?.cargo?.toLowerCase() || 'default';
    const template = MENUS_POR_CARGO[cargo] || MENUS_POR_CARGO.default;
    setMenusSelecionados(template);
    toast.info(`Template "${cargo}" aplicado`);
  };

  const handleSalvarPermissoes = () => {
    if (!usuarioPermissoes) return;
    salvarPermissoesMutation.mutate({
      userEmail: usuarioPermissoes.email,
      menus: menusSelecionados
    });
  };

  const salvarConfigPadraoMutation = useMutation({
    mutationFn: async (novoPerfil) => {
      if (configPadrao) {
        return base44.entities.ConfiguracaoSistema.update(configPadrao.id, { valor: novoPerfil });
      } else {
        return base44.entities.ConfiguracaoSistema.create({
          chave: 'perfil_padrao_novos_usuarios',
          valor: novoPerfil,
          descricao: 'Perfil padrão aplicado a novos usuários'
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['config-padrao-novos-usuarios']);
      toast.success('Perfil padrão atualizado!');
      setEditandoConfigPadrao(false);
    },
    onError: (err) => toast.error('Erro ao salvar: ' + err.message)
  });

  const salvarMenusPerfilMutation = useMutation({
    mutationFn: async ({ perfil, menus }) => {
      try {
        const menusAtuaisStr = configMenusPerfis?.valor || '{}';
        const menusAtuais = typeof menusAtuaisStr === 'string' ? JSON.parse(menusAtuaisStr) : menusAtuaisStr;
        const novosMenus = { ...menusAtuais, [perfil]: menus };
        
        console.log('Salvando menus:', { perfil, menus, novosMenus });
        
        if (configMenusPerfis?.id) {
          const res = await base44.entities.ConfiguracaoSistema.update(configMenusPerfis.id, { 
            valor: JSON.stringify(novosMenus),
            tipo: 'json'
          });
          console.log('Update response:', res);
          return res;
        } else {
          const res = await base44.entities.ConfiguracaoSistema.create({
            chave: 'menus_por_perfil',
            valor: JSON.stringify(novosMenus),
            tipo: 'json',
            descricao: 'Menus permitidos por perfil'
          });
          console.log('Create response:', res);
          return res;
        }
      } catch (error) {
        console.error('Erro ao salvar menus:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success('Menus do perfil salvos!');
      queryClient.invalidateQueries(['config-menus-perfis']);
    },
    onError: (err) => {
      console.error('Mutation error:', err);
      toast.error('Erro ao salvar: ' + err.message);
    }
  });

  const handleSelecionarPerfil = (perfil) => {
    setPerfilSelecionado(perfil);
    const menusConfigStr = configMenusPerfis?.valor || '{}';
    const menusConfig = typeof menusConfigStr === 'string' ? JSON.parse(menusConfigStr) : menusConfigStr;
    setMenusPerfil(menusConfig[perfil] || []);
  };

  const handleToggleMenuPerfil = (menuName) => {
    setMenusPerfil(prev => 
      prev.includes(menuName) ? prev.filter(m => m !== menuName) : [...prev, menuName]
    );
  };

  const handleSalvarMenusPerfil = () => {
    if (!perfilSelecionado) {
      toast.error('Nenhum perfil selecionado');
      return;
    }
    if (menusPerfil.length === 0) {
      toast.warning('Selecione pelo menos um menu');
      return;
    }
    console.log('handleSalvarMenusPerfil called with:', { perfilSelecionado, menusPerfil });
    salvarMenusPerfilMutation.mutate({
      perfil: perfilSelecionado,
      menus: menusPerfil
    });
  };

  if (!isAdmin && !isCompanyAdmin) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
        <p className="text-gray-600">Apenas administradores podem acessar esta página.</p>
      </div>
    );
  }

  if (isLoading) {
    return <PageSkeleton kpis={4} rows={6} cols={6} />;
  }

  const totalUsuarios = usuarios.length;
  const usuariosPendentes = usuarios.filter(u => 
    !u.status || u.status === 'aguardando_aprovacao' || u.status === 'pendente' || 
    u.status_acesso === 'pendente'
  ).length;
  const usuariosAtivos = usuarios.filter(u => u.status === 'ativo').length;
  const usuariosRejeitados = usuarios.filter(u => u.status === 'rejeitado').length;

  const ultimos30Dias = Array.from({ length: 30 }, (_, i) => {
    const data = subDays(new Date(), 29 - i);
    const dataStr = format(startOfDay(data), 'yyyy-MM-dd');
    const usuariosNoDia = usuarios.filter(u => {
      const criadoEm = format(startOfDay(new Date(u.created_date)), 'yyyy-MM-dd');
      return criadoEm === dataStr;
    }).length;
    return { data: format(data, 'dd/MM'), usuarios: usuariosNoDia };
  });

  const dadosPizza = [
    { name: 'Ativos', value: usuariosAtivos, color: '#10B981' },
    { name: 'Pendentes', value: usuariosPendentes, color: '#F59E0B' },
    { name: 'Rejeitados', value: usuariosRejeitados, color: '#EF4444' }
  ];

  const pendentes = usuarios.filter(u => 
    !u.status || u.status === 'aguardando_aprovacao' || u.status === 'pendente' || 
    u.status_acesso === 'pendente'
  );
  
  // Para ativos, aplica filtro de programadores se for admin_empresa
  let ativos = usuarios.filter(u => u.status === 'ativo');
  if (isCompanyAdmin && !isAdmin) {
    ativos = ativos.filter(u => {
      const isProgramador = u.role === 'programador' || 
                           u.cargo === 'programador' || 
                           u.perfil_acesso === 'programador';
      return !isProgramador;
    });
  }
  
  const rejeitados = usuarios.filter(u => u.status === 'rejeitado');
  const menusDisponiveis = menuItems.filter(m => m.visivel !== false);

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gestão de Usuários</h1>
        <p className="text-gray-500 text-sm mt-1">Dashboard, aprovações, listagem e permissões em um só lugar</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="dashboard" className="whitespace-nowrap">Dashboard</TabsTrigger>
          <TabsTrigger value="aprovacao" className="whitespace-nowrap">Aprovação ({usuariosPendentes})</TabsTrigger>
          <TabsTrigger value="usuarios" className="whitespace-nowrap">Usuários ({totalUsuarios})</TabsTrigger>
        </TabsList>

        {/* TAB: DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total</CardTitle>
                <Users className="w-5 h-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold tabular-nums">{totalUsuarios}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Pendentes</CardTitle>
                <Clock className="w-5 h-5 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-yellow-600 tabular-nums">{usuariosPendentes}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Ativos</CardTitle>
                <UserCheck className="w-5 h-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-green-600 tabular-nums">{usuariosAtivos}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Rejeitados</CardTitle>
                <UserX className="w-5 h-5 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-lg sm:text-2xl font-bold text-red-600 tabular-nums">{usuariosRejeitados}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Tendência (30 dias)
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
                    <Line type="monotone" dataKey="usuarios" stroke="#3B82F6" strokeWidth={2} name="Novos Usuários" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição</CardTitle>
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
        </TabsContent>

        {/* TAB: APROVAÇÃO */}
        <TabsContent value="aprovacao" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Aguardando Aprovação ({pendentes.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {pendentes.length === 0 ? (
                <p className="text-gray-500">Nenhum usuário aguardando aprovação.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cargo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendentes.map(user => (
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
                        <TableCell>{format(new Date(user.created_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                              <Button variant="outline" size="sm" onClick={() => handleEditOpen(user, true)}>
                                <Edit className="h-4 w-4 mr-1" />
                                Ver Informações
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleReject(user)} disabled={rejectUserMutation.isPending}>
                                {rejectUserMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Ban className="h-4 w-4 mr-1" />}
                                {rejectUserMutation.isPending ? 'Rejeitando...' : 'Rejeitar'}
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
        </TabsContent>

        {/* TAB: USUÁRIOS */}
        <TabsContent value="usuarios" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Usuários Ativos ({ativos.length})</CardTitle>
                <Badge className="bg-blue-100 text-blue-700">
                  Pessoas Temporárias gerenciadas via módulos
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Perfil Sistema</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ativos.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar user={user} size="sm" />
                          {user.full_name || 'Sem nome'}
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.cargo || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.perfil_acesso || user.perfil_sistema || 'campo'}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(user.created_date), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button variant="outline" size="sm" onClick={() => handleEditOpen(user)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                            <Trash2 className="h-4 w-4 mr-1" />
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {rejeitados.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Usuários Rejeitados ({rejeitados.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejeitados.map(user => (
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
                          <Badge className="bg-red-100 text-red-800">Rejeitado</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
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
        </TabsContent>

      </Tabs>

      {/* Confirmação de exclusão */}
      <AlertDialog open={!!userToDelete} onOpenChange={(o) => { if (!o) setUserToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <span className="font-medium text-gray-900">{userToDelete?.full_name || userToDelete?.email}</span> será
              excluído permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmarExclusao}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email_ro">E-mail</Label>
              <Input id="email_ro" value={editingUser?.email || ''} disabled className="bg-gray-50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" value={editForm.telefone} disabled className="bg-gray-50" placeholder="—" />
                <button
                  type="button"
                  onClick={() => navigate(createPageUrl('Colaboradores'))}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Gerenciado em Colaboradores →
                </button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo / Função</Label>
                <ComboboxBusca
                  options={[
                    ...(isAdmin ? [{ value: 'programador', label: 'Programador' }] : []),
                    { value: 'mestre_obras', label: 'Mestre de Obras' },
                    { value: 'campo', label: 'Campo/Obra' },
                    { value: 'engenharia', label: 'Engenharia' },
                    { value: 'compras', label: 'Compras' },
                    { value: 'almoxarifado', label: 'Almoxarifado' },
                    { value: 'logistica', label: 'Logística' },
                    { value: 'motorista', label: 'Motorista' },
                    { value: 'financeiro', label: 'Financeiro' },
                    { value: 'admin_empresa', label: 'Admin da Empresa' },
                    { value: 'rh', label: 'RH' },
                  ]}
                  value={editForm.cargo}
                  onSelect={(value) => setEditForm({ ...editForm, cargo: value, perfil_acesso: value })}
                  placeholder="Selecione o cargo"
                  searchPlaceholder="Buscar cargo..."
                />
                <p className="text-xs text-gray-500">Sincroniza com o Perfil de Sistema.</p>
              </div>
            </div>
            {/* Campo Empresa - oculto temporariamente
            <div className="space-y-2">
              <Label htmlFor="empresa">Empresa</Label>
              <Input
                id="empresa"
                value={editForm.empresa}
                onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
              />
            </div>
            */}
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={editForm.observacoes}
                onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status_acesso">Status do Acesso</Label>
              <ComboboxBusca
                options={[
                  { value: 'pendente', label: 'PENDENTE' },
                  { value: 'aprovado', label: 'APROVADO' },
                  { value: 'bloqueado', label: 'BLOQUEADO' },
                ]}
                value={editForm.status_acesso}
                onSelect={(value) => setEditForm({ ...editForm, status_acesso: value })}
                placeholder="Selecione o status"
                searchPlaceholder="Buscar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)} disabled={updateUserMutation.isPending}>Cancelar</Button>
            {fromApprovalTab ? (
              <Button onClick={() => handleEditSave(true)} disabled={approveUserMutation.isPending}>
                {approveUserMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Aprovando...</> : <>
                  <Check className="h-4 w-4 mr-2" />Aprovar
                </>}
              </Button>
            ) : (
              <Button onClick={() => handleEditSave(false)} disabled={updateUserMutation.isPending}>
                {updateUserMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : <>
                  <Save className="h-4 w-4 mr-2" />Salvar
                </>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
