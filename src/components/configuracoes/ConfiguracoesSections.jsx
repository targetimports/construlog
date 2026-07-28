import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Palette, Bell, HelpCircle } from 'lucide-react';
import AvatarUpload from '@/components/profile/AvatarUpload';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function AjustesSection() {
  const [avatarKey, setAvatarKey] = useState(0);
  
  const { data: user, refetch } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const handleAvatarUpdated = () => {
    // Recarregar usuário para pegar avatar atualizado
    refetch();
    setAvatarKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      {user && (
        <AvatarUpload 
          key={avatarKey}
          user={user} 
          onAvatarUpdated={handleAvatarUpdated}
        />
      )}
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-blue-600" />
            Preferências
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Tema Escuro</Label>
              <p className="text-gray-500 text-sm">Usar tema escuro no sistema</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notificações por E-mail</Label>
              <p className="text-gray-500 text-sm">Receber alertas importantes por e-mail</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TermosSection() {
  const [termos, setTermos] = React.useState([]);
  const [novoTermo, setNovoTermo] = React.useState('');
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Termos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Novo termo..." 
            value={novoTermo}
            onChange={(e) => setNovoTermo(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <Button onClick={() => {
            if (novoTermo) {
              setTermos([...termos, novoTermo]);
              setNovoTermo('');
            }
          }}>
            Adicionar
          </Button>
        </div>
        <div className="space-y-2">
          {termos.map((termo, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span>{termo}</span>
              <Button variant="ghost" size="sm" onClick={() => setTermos(termos.filter((_, i) => i !== idx))}>
                ✕
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ArquivosSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Arquivos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50">
          <p className="text-gray-600">Arraste arquivos aqui ou clique para selecionar</p>
          <input type="file" className="hidden" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-900">Arquivos Recentes</p>
          <div className="text-gray-500 text-sm">Nenhum arquivo enviado ainda</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReajusteSection() {
  const [reajustes, setReajustes] = React.useState([
    { id: 1, nome: 'IPCA', percentual: 5.2, data: '2024-12' }
  ]);
  const [showModal, setShowModal] = React.useState(false);
  const [formData, setFormData] = React.useState({ nome: '', percentual: '', data: '' });
  
  const handleAddTabela = () => {
    if (formData.nome && formData.percentual && formData.data) {
      const newTabela = {
        id: Math.max(...reajustes.map(r => r.id), 0) + 1,
        nome: formData.nome,
        percentual: parseFloat(formData.percentual),
        data: formData.data
      };
      setReajustes([...reajustes, newTabela]);
      setFormData({ nome: '', percentual: '', data: '' });
      setShowModal(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tabelas de Reajuste</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => setShowModal(true)} className="mb-4">Adicionar Tabela</Button>
        
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-96">
              <CardHeader>
                <CardTitle>Nova Tabela de Reajuste</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Índice</label>
                  <input 
                    type="text" 
                    placeholder="Ex: IPCA, IGP-M, etc"
                    value={formData.nome}
                    onChange={(e) => setFormData({...formData, nome: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Percentual (%)</label>
                  <input 
                    type="number" 
                    placeholder="Ex: 5.2"
                    step="0.01"
                    value={formData.percentual}
                    onChange={(e) => setFormData({...formData, percentual: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Período (YYYY-MM)</label>
                  <input 
                    type="text" 
                    placeholder="Ex: 2024-12"
                    value={formData.data}
                    onChange={(e) => setFormData({...formData, data: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div className="flex gap-2 justify-end pt-4">
                  <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                  <Button onClick={handleAddTabela}>Salvar</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div className="space-y-3">
          {reajustes.map(r => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{r.nome}</p>
                <p className="text-sm text-gray-600">{r.data}</p>
              </div>
              <span className="text-lg font-bold text-green-600">{r.percentual}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function UsuariosSection() {
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Usuários</CardTitle>
        <Button>Convidar Usuário</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">{u.full_name}</p>
                <p className="text-sm text-gray-600">{u.email}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {u.role}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AcessoSection() {
  const { data: perfis = [] } = useQuery({
    queryKey: ['perfis'],
    queryFn: () => base44.entities.Perfil.list().catch(() => [])
  });
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Perfis de Acesso</CardTitle>
        <Button>Novo Perfil</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {perfis.length === 0 ? (
            <p className="text-gray-500">Nenhum perfil configurado</p>
          ) : (
            perfis.map(p => (
              <div key={p.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{p.nome}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{p.nivel_acesso}</span>
                </div>
                <p className="text-sm text-gray-600">{p.descricao}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function IntegracoesSection() {
  const integrationsAvailable = [
    { name: 'Google Drive', status: 'desconectado', icon: '' },
    { name: 'Slack', status: 'desconectado', icon: '' },
    { name: 'Webhook', status: 'ativo', icon: '' }
  ];
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {integrationsAvailable.map((int, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{int.icon}</span>
              <div>
                <p className="font-medium">{int.name}</p>
                <p className="text-xs text-gray-600">Status: {int.status}</p>
              </div>
            </div>
            <Button size="sm" variant={int.status === 'ativo' ? 'outline' : 'default'}>
              {int.status === 'ativo' ? 'Desconectar' : 'Conectar'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function HistoricoSection() {
  const { data: logs = [] } = useQuery({
    queryKey: ['auditoria'],
    queryFn: () => base44.entities.LogAuditoria.list().catch(() => [])
  });
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Alterações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm">Nenhuma alteração registrada</p>
          ) : (
            logs.slice(-10).reverse().map((log, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 border-l-2 border-blue-200">
                <div className="flex-1 text-sm">
                  <p className="font-medium">{log.acao} - {log.entidade}</p>
                  <p className="text-xs text-gray-600">Por: {log.usuario_email}</p>
                  <p className="text-xs text-gray-500">{new Date(log.data_hora).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AdicionaisSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Manutenção do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Sincronizar Dados</p>
              <p className="text-sm text-gray-600">Sincronizar dados com sistemas externos</p>
            </div>
            <Button size="sm">Sincronizar</Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium">Limpar Cache</p>
              <p className="text-sm text-gray-600">Limpar dados em cache do navegador</p>
            </div>
            <Button size="sm" variant="outline">Limpar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Versão:</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-gray-600">Última Atualização:</span>
            <span className="font-medium">{new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Status:</span>
            <span className="font-medium text-green-600">✓ Online</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}