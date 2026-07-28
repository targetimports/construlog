import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Save, Shield, UserCog, Edit, X } from 'lucide-react';
import { toast } from 'sonner';
import { menuItems } from '@/components/layout/navigation';
import UserAvatar from '@/components/shared/UserAvatar';

export default function GerenciarPermissoes() {
  const queryClient = useQueryClient();
  const [usuarioSelecionado, setUsuarioSelecionado] = useState(null);
  const [menusSelecionados, setMenusSelecionados] = useState([]);

  const { data: currentUser } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: usuarios } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: currentUser?.role === 'admin'
  });

  const { data: permissoesUsuario } = useQuery({
    queryKey: ['permissoes-usuario', usuarioSelecionado?.email],
    queryFn: () => base44.entities.PermissaoUsuario.filter({ user_email: usuarioSelecionado.email }),
    enabled: !!usuarioSelecionado?.email
  });

  const salvarPermissoesMutation = useMutation({
    mutationFn: async ({ userEmail, menus }) => {
      const permissoesExistentes = await base44.entities.PermissaoUsuario.filter({ user_email: userEmail });
      
      if (permissoesExistentes && permissoesExistentes.length > 0) {
        return base44.entities.PermissaoUsuario.update(permissoesExistentes[0].id, {
          menus_visiveis: menus
        });
      } else {
        return base44.entities.PermissaoUsuario.create({
          user_email: userEmail,
          menus_visiveis: menus
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['permissoes-usuario']);
      toast.success('Permissões salvas com sucesso!');
    },
    onError: (err) => {
      toast.error('Erro ao salvar permissões: ' + err.message);
    }
  });

  const handleUsuarioChange = (userId) => {
    const usuario = usuarios.find(u => u.id === userId);
    handleEditarUsuario(usuario);
  };

  const handleEditarUsuario = async (usuario) => {
    setUsuarioSelecionado(usuario);
    
    // Buscar permissões do usuário
    const permissoes = await base44.entities.PermissaoUsuario.filter({ user_email: usuario.email });
    
    // Carregar menus já salvos ou usar template do cargo
    if (permissoes?.[0]?.menus_visiveis) {
      setMenusSelecionados(permissoes[0].menus_visiveis);
    } else {
      const cargo = usuario?.cargo?.toLowerCase() || 'default';
      const template = MENUS_POR_CARGO[cargo] || MENUS_POR_CARGO.default;
      setMenusSelecionados(template);
    }
  };

  const handleMenuToggle = (menuName) => {
    setMenusSelecionados(prev => {
      if (prev.includes(menuName)) {
        return prev.filter(m => m !== menuName);
      } else {
        return [...prev, menuName];
      }
    });
  };

  const handleAplicarTemplate = () => {
    if (!usuarioSelecionado) return;
    const cargo = usuarioSelecionado?.cargo?.toLowerCase() || 'default';
    const template = MENUS_POR_CARGO[cargo] || MENUS_POR_CARGO.default;
    setMenusSelecionados(template);
    toast.info(`Template do cargo "${cargo}" aplicado`);
  };

  const handleSalvar = () => {
    if (!usuarioSelecionado) return;
    salvarPermissoesMutation.mutate({
      userEmail: usuarioSelecionado.email,
      menus: menusSelecionados
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

  const usuariosAtivos = usuarios?.filter(u => u.status === 'ativo') || [];
  const menusDisponiveis = menuItems.filter(m => m.visivel !== false);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gerenciar Permissões de Acesso</h1>
        <p className="text-gray-600 mt-1">Configure quais menus cada usuário pode visualizar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Selecionar Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleUsuarioChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuário" />
            </SelectTrigger>
            <SelectContent>
              {usuariosAtivos.map(usuario => (
                <SelectItem key={usuario.id} value={usuario.id}>
                  {usuario.full_name} - {usuario.email} {usuario.cargo && `(${usuario.cargo})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {usuarioSelecionado && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Permissões de {usuarioSelecionado.full_name}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Cargo: <Badge variant="outline">{usuarioSelecionado.cargo || 'Não definido'}</Badge>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleAplicarTemplate}>
                  Aplicar Template do Cargo
                </Button>
                <Button onClick={handleSalvar} disabled={salvarPermissoesMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Permissões
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menusDisponiveis.map(menu => (
                <div key={menu.name} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                  <Checkbox
                    id={menu.name}
                    checked={menusSelecionados.includes(menu.name)}
                    onCheckedChange={() => handleMenuToggle(menu.name)}
                  />
                  <Label htmlFor={menu.name} className="cursor-pointer flex-1">
                    {menu.name}
                  </Label>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900 font-medium mb-2">
                {menusSelecionados.length} menus selecionados
              </p>
              <p className="text-xs text-blue-700">
                Se nenhuma permissão personalizada for salva, o sistema usará automaticamente o template padrão do cargo.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Todos os Usuários e Permissões</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Menus Permitidos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuariosAtivos.map(usuario => {
                const permissoes = permissoesUsuario?.user_email === usuario.email ? permissoesUsuario : null;
                const cargo = usuario?.cargo?.toLowerCase() || 'default';
                const menusAtivos = permissoes?.[0]?.menus_visiveis?.length || MENUS_POR_CARGO[cargo]?.length || 0;
                
                return (
                  <TableRow key={usuario.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar user={usuario} size="sm" />
                        {usuario.full_name}
                      </div>
                    </TableCell>
                    <TableCell>{usuario.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{usuario.cargo || 'Não definido'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge>{menusAtivos} menus</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditarUsuario(usuario)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar Permissões
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Templates por Cargo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(MENUS_POR_CARGO).map(([cargo, menus]) => (
              <div key={cargo} className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2 capitalize">{cargo}</h3>
                <div className="flex flex-wrap gap-2">
                  {menus.map(menu => (
                    <Badge key={menu} variant="secondary">{menu}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}