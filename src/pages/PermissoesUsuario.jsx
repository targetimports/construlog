import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import PageHeader from '../components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { menuItems } from '../components/layout/navigation';
import { ListSkeleton } from '@/components/shared/Skeletons';

const ROLES = [
  { key: 'admin', label: 'Administrador' },
  { key: 'user', label: 'Usuário' }
];

export default function PermissoesUsuario() {
  const queryClient = useQueryClient();
  const [permissoes, setPermissoes] = useState({});

  const { data: usuarios, isLoading: usuariosLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const saveMutation = useMutation({
    mutationFn: async (email) => {
      const novoRole = permissoes[email]?.role;
      return base44.auth.updateMe({ role: novoRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    }
  });

  React.useEffect(() => {
    if (usuarios) {
      const novasPermissoes = {};
      usuarios.forEach(user => {
        novasPermissoes[user.email] = {
          role: user.role || 'user'
        };
      });
      setPermissoes(novasPermissoes);
    }
  }, [usuarios]);

  const toggleRole = (email, role) => {
    setPermissoes(prev => ({
      ...prev,
      [email]: {
        ...prev[email],
        role: role
      }
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permissões de Usuários"
        subtitle="Gerencie o acesso de cada usuário aos módulos do sistema"
      />

      {usuariosLoading ? (
        <ListSkeleton rows={6} />
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>Configurar Acessos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {usuarios?.map(user => (
              <div key={user.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-semibold text-gray-900">{user.full_name}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveMutation.mutate(user.email)}
                    disabled={saveMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>

                <div className="flex gap-4">
                  {ROLES.map(role => (
                    <div key={role.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${user.email}-${role.key}`}
                        checked={permissoes[user.email]?.role === role.key}
                        onCheckedChange={() => toggleRole(user.email, role.key)}
                      />
                      <Label
                        htmlFor={`${user.email}-${role.key}`}
                        className="cursor-pointer text-sm"
                      >
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}