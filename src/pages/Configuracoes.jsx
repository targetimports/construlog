import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Lock, Bell } from 'lucide-react';
import { toast } from 'sonner';
import ComboboxBusca from '@/components/shared/ComboboxBusca';
import PermissaoGuard from '../components/shared/PermissaoGuard';

export default function Configuracoes() {
  const queryClient = useQueryClient();
  const [configForm, setConfigForm] = useState({
    nomeEmpresa: 'Construlog Construlog',
    moedaPadrao: 'BRL',
    requerAprovacaoMedicoes: true,
    requerAprovacaoCompras: true,
    ativarWorkflows: false,
    requerAuditoria: true
  });

  const [novoUsuario, setNovoUsuario] = useState({ email: '', role: 'user' });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      try {
        return await base44.entities.User?.list() || [];
      } catch {
        return [];
      }
    }
  });

  const { data: permissoesUsuarios = [] } = useQuery({
    queryKey: ['permissoes-usuarios'],
    queryFn: async () => {
      try {
        return await base44.entities.PermissaoUsuario?.list() || [];
      } catch {
        return [];
      }
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data) => {
      localStorage.setItem('config-sistema', JSON.stringify(data));
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries({ queryKey: ['config-sistema'] });
    }
  });

  const handleSaveConfig = (e) => {
    e.preventDefault();
    updateConfigMutation.mutate(configForm);
  };

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações do Sistema</h1>
        <p className="text-gray-500 text-sm mt-1">Administração e preferências gerais</p>
      </div>

      <Tabs defaultValue="geral">
        <TabsList className="w-full sm:w-auto overflow-x-auto justify-start">
          <TabsTrigger value="geral" className="whitespace-nowrap">Geral</TabsTrigger>
          <TabsTrigger value="usuarios" className="whitespace-nowrap">Usuários</TabsTrigger>
          <TabsTrigger value="permissoes" className="whitespace-nowrap">Permissões</TabsTrigger>
          <TabsTrigger value="notificacoes" className="whitespace-nowrap">Notificações</TabsTrigger>
        </TabsList>

        {/* Geral */}
        <TabsContent value="geral">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome da Empresa</label>
                  <Input value={configForm.nomeEmpresa} onChange={(e) => setConfigForm({...configForm, nomeEmpresa: e.target.value})} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Moeda Padrão</label>
                  <ComboboxBusca
                    options={[{ value: 'BRL', label: 'Real (BRL)' }, { value: 'USD', label: 'Dólar (USD)' }, { value: 'EUR', label: 'Euro (EUR)' }]}
                    value={configForm.moedaPadrao}
                    onSelect={(v) => setConfigForm({ ...configForm, moedaPadrao: v || 'BRL' })}
                    placeholder="Selecione a moeda"
                    searchPlaceholder="Buscar moeda..."
                  />
                </div>

                <div className="space-y-3 border-t pt-4">
                  <h3 className="font-semibold">Requisitos de Aprovação</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.requerAprovacaoMedicoes}
                      onChange={(e) => setConfigForm({...configForm, requerAprovacaoMedicoes: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Requer aprovação para medições</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.requerAprovacaoCompras}
                      onChange={(e) => setConfigForm({...configForm, requerAprovacaoCompras: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Requer aprovação para compras</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.requerAuditoria}
                      onChange={(e) => setConfigForm({...configForm, requerAuditoria: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Ativar auditoria de mudanças</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={configForm.ativarWorkflows}
                      onChange={(e) => setConfigForm({...configForm, ativarWorkflows: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Ativar workflows avançados</span>
                  </label>
                </div>

                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full mt-6">Salvar Configurações</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Usuários */}
        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gestão de Usuários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <PermissaoGuard acao="criar" modulo="usuarios">
                <div className="border-b pb-6">
                  <h3 className="font-semibold mb-4">Convidar Novo Usuário</h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={novoUsuario.email}
                      onChange={(e) => setNovoUsuario({...novoUsuario, email: e.target.value})}
                    />
                    <div className="sm:w-40 shrink-0">
                      <ComboboxBusca
                        options={[{ value: 'user', label: 'Usuário' }, { value: 'admin', label: 'Admin' }]}
                        value={novoUsuario.role}
                        onSelect={(v) => setNovoUsuario({ ...novoUsuario, role: v || 'user' })}
                        placeholder="Perfil"
                      />
                    </div>
                    <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">Convidar</Button>
                  </div>
                </div>
              </PermissaoGuard>

              <div>
                <h3 className="font-semibold mb-4">Usuários Ativos</h3>
                <div className="space-y-2">
                  {usuarios.slice(0, 10).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{user.full_name || user.email}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded">{user.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Permissões */}
        <TabsContent value="permissoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Gestão de Permissões
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Permissões configuradas por usuário e módulo</p>

                {/* Cards (mobile) */}
                <div className="md:hidden flex flex-col gap-2">
                  {permissoesUsuarios.slice(0, 5).map((perm) => (
                    <div key={perm.id} className="p-3 rounded-lg border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 break-words min-w-0">{perm.user_email?.split('@')[0]}</span>
                        <span className="text-xs text-gray-500 shrink-0">{perm.modulo}</span>
                      </div>
                      <p className="text-xs text-gray-600 break-words">{perm.acoes?.join(', ')}</p>
                    </div>
                  ))}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Usuário</th>
                        <th className="px-4 py-2 text-left">Módulo</th>
                        <th className="px-4 py-2 text-left">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permissoesUsuarios.slice(0, 5).map(perm => (
                        <tr key={perm.id} className="border-t">
                          <td className="px-4 py-2">{perm.user_email?.split('@')[0]}</td>
                          <td className="px-4 py-2">{perm.modulo}</td>
                          <td className="px-4 py-2 text-xs">{perm.acoes?.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notificacoes">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Configurações de Notificações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Notificar sobre aprovações pendentes</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Notificar sobre vencimentos de contratos</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Notificar sobre estoque baixo</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm">Enviar relatórios periódicos</span>
              </label>
              <Button className="bg-blue-600 hover:bg-blue-700 w-full mt-4">Salvar Preferências</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}