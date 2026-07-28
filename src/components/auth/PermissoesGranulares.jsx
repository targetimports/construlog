import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Save, User, Lock } from 'lucide-react';
import { toast } from 'sonner';

const permissoesFinanceiras = [
  { id: 'visualizar_contas', label: 'Visualizar Contas', descricao: 'Ver contas a pagar e receber' },
  { id: 'criar_contas', label: 'Criar Contas', descricao: 'Adicionar novas contas' },
  { id: 'editar_contas', label: 'Editar Contas', descricao: 'Modificar contas existentes' },
  { id: 'excluir_contas', label: 'Excluir Contas', descricao: 'Remover contas' },
  { id: 'aprovar_pagamentos', label: 'Aprovar Pagamentos', descricao: 'Aprovar pagamentos pendentes' },
  { id: 'visualizar_relatorios', label: 'Visualizar Relatórios', descricao: 'Acessar relatórios financeiros' },
  { id: 'exportar_dados', label: 'Exportar Dados', descricao: 'Exportar dados financeiros' },
  { id: 'configurar_alertas', label: 'Configurar Alertas', descricao: 'Gerenciar notificações financeiras' }
];

const permissoesCompras = [
  { id: 'visualizar_requisicoes', label: 'Visualizar Requisições', descricao: 'Ver requisições de compra' },
  { id: 'criar_requisicoes', label: 'Criar Requisições', descricao: 'Adicionar requisições' },
  { id: 'editar_requisicoes', label: 'Editar Requisições', descricao: 'Modificar requisições' },
  { id: 'aprovar_requisicoes', label: 'Aprovar Requisições', descricao: 'Aprovar requisições de compra' },
  { id: 'criar_ordens', label: 'Criar Ordens de Compra', descricao: 'Gerar ordens de compra' },
  { id: 'visualizar_fornecedores', label: 'Visualizar Fornecedores', descricao: 'Acessar dados de fornecedores' },
  { id: 'gerenciar_fornecedores', label: 'Gerenciar Fornecedores', descricao: 'Adicionar e editar fornecedores' },
  { id: 'visualizar_orcamentos', label: 'Visualizar Orçamentos', descricao: 'Ver orçamentos das obras' }
];

export default function PermissoesGranulares() {
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
  const queryClient = useQueryClient();

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: permissoes, isLoading } = useQuery({
    queryKey: ['permissoes-granulares', usuarioSelecionado],
    queryFn: async () => {
      if (!usuarioSelecionado) return null;
      const resultado = await base44.entities.PermissaoUsuario.filter({
        user_email: usuarioSelecionado
      });
      return resultado[0] || null;
    },
    enabled: !!usuarioSelecionado
  });

  const salvarPermissoesMutation = useMutation({
    mutationFn: async (novasPermissoes) => {
      if (permissoes?.id) {
        return base44.entities.PermissaoUsuario.update(permissoes.id, novasPermissoes);
      } else {
        return base44.entities.PermissaoUsuario.create({
          user_email: usuarioSelecionado,
          ...novasPermissoes
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['permissoes-granulares']);
      toast.success('Permissões atualizadas com sucesso!');
    }
  });

  const [permissoesTemp, setPermissoesTemp] = useState({
    financeiro: {},
    compras: {}
  });

  React.useEffect(() => {
    if (permissoes) {
      setPermissoesTemp({
        financeiro: permissoes.permissoes_financeiro || {},
        compras: permissoes.permissoes_compras || {}
      });
    } else {
      setPermissoesTemp({
        financeiro: {},
        compras: {}
      });
    }
  }, [permissoes]);

  const togglePermissao = (modulo, permissaoId) => {
    setPermissoesTemp(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [permissaoId]: !prev[modulo][permissaoId]
      }
    }));
  };

  const handleSalvar = () => {
    salvarPermissoesMutation.mutate({
      permissoes_financeiro: permissoesTemp.financeiro,
      permissoes_compras: permissoesTemp.compras
    });
  };

  const usuario = usuarios.find(u => u.email === usuarioSelecionado);

  return (
    <div className="space-y-6">
      {/* Seletor de Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Selecionar Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um usuário..." />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map(user => (
                <SelectItem key={user.email} value={user.email}>
                  <div className="flex items-center gap-2">
                    {user.full_name || user.email}
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {usuarioSelecionado && (
        <>
          {/* Informações do Usuário */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Configurando permissões para:</p>
                  <p className="text-xl font-bold text-blue-900 mt-1">{usuario?.full_name || usuarioSelecionado}</p>
                  <p className="text-sm text-blue-700 mt-1">{usuario?.email}</p>
                </div>
                <Badge variant={usuario?.role === 'admin' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                  {usuario?.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Permissões Financeiras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Permissões do Módulo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {permissoesFinanceiras.map(perm => (
                  <div key={perm.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <Label className="font-medium text-gray-900">{perm.label}</Label>
                      <p className="text-sm text-gray-600 mt-1">{perm.descricao}</p>
                    </div>
                    <Switch
                      checked={permissoesTemp.financeiro[perm.id] || false}
                      onCheckedChange={() => togglePermissao('financeiro', perm.id)}
                      className="ml-4"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Permissões de Compras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-purple-600" />
                Permissões do Módulo de Compras
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {permissoesCompras.map(perm => (
                  <div key={perm.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <Label className="font-medium text-gray-900">{perm.label}</Label>
                      <p className="text-sm text-gray-600 mt-1">{perm.descricao}</p>
                    </div>
                    <Switch
                      checked={permissoesTemp.compras[perm.id] || false}
                      onCheckedChange={() => togglePermissao('compras', perm.id)}
                      className="ml-4"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSalvar}
              disabled={salvarPermissoesMutation.isPending}
              size="lg"
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              {salvarPermissoesMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
            </Button>
          </div>
        </>
      )}

      {!usuarioSelecionado && (
        <Card className="bg-gray-50">
          <CardContent className="p-12 text-center">
            <Lock className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">Selecione um usuário para configurar permissões</p>
            <p className="text-gray-600 mt-2">
              Configure o acesso granular aos módulos financeiro e de compras
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}