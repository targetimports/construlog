import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Zap, Settings, CheckCircle, XCircle, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Integracoes() {
  const queryClient = useQueryClient();
  const [configDialog, setConfigDialog] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState(null);
  const [configData, setConfigData] = useState({});

  const { data: integracoes = [] } = useQuery({
    queryKey: ['integracoes'],
    queryFn: () => base44.entities.Integracao.list()
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativa }) => base44.entities.Integracao.update(id, { ativa }),
    onSuccess: () => {
      queryClient.invalidateQueries(['integracoes']);
      toast.success('Status atualizado!');
    }
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ id, config }) => base44.entities.Integracao.update(id, { configuracao: config }),
    onSuccess: () => {
      queryClient.invalidateQueries(['integracoes']);
      toast.success('Configuração salva!');
      setConfigDialog(false);
    }
  });

  const testIntegration = async (integracao) => {
    try {
      toast.loading('Testando integração...');
      const response = await base44.functions.invoke('testarIntegracao', {
        integracao_id: integracao.id
      });
      
      if (response.data.success) {
        toast.success('Integração testada com sucesso!');
      } else {
        toast.error('Falha no teste: ' + response.data.message);
      }
    } catch (error) {
      toast.error('Erro ao testar integração');
    }
  };

  const integracoesDisponiveis = [
    {
      id: 'contabil',
      nome: 'Sistema Contábil',
      descricao: 'Integração com sistemas de contabilidade',
      icon: '',
      campos: ['api_url', 'api_key', 'empresa_id']
    },
    {
      id: 'erp',
      nome: 'ERP Empresarial',
      descricao: 'Sincronização com ERP corporativo',
      icon: '',
      campos: ['erp_url', 'username', 'password', 'database']
    },
    {
      id: 'nfe',
      nome: 'Notas Fiscais',
      descricao: 'Emissão e gerenciamento de NF-e',
      icon: '',
      campos: ['certificado', 'ambiente', 'municipio']
    },
    {
      id: 'banco',
      nome: 'Conta Bancária',
      descricao: 'Conciliação bancária automática',
      icon: '',
      campos: ['banco_code', 'agencia', 'conta', 'api_token']
    },
    {
      id: 'email',
      nome: 'E-mail Corporativo',
      descricao: 'Notificações e alertas por e-mail',
      icon: '',
      campos: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password']
    },
    {
      id: 'whatsapp',
      nome: 'WhatsApp Business',
      descricao: 'Mensagens e notificações via WhatsApp',
      icon: '',
      campos: ['phone_id', 'access_token', 'webhook_url']
    }
  ];

  const openConfig = (integracao) => {
    setSelectedIntegration(integracao);
    setConfigData(integracao?.configuracao || {});
    setConfigDialog(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Integrações</h1>
        <p className="text-gray-600 mt-1">Conecte o sistema com outras ferramentas</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integracoesDisponiveis.map((integracaoTipo) => {
          const integracaoAtiva = integracoes.find(i => i.tipo === integracaoTipo.id);
          const isAtiva = integracaoAtiva?.ativa || false;

          return (
            <Card key={integracaoTipo.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{integracaoTipo.icon}</span>
                    <div>
                      <CardTitle className="text-lg">{integracaoTipo.nome}</CardTitle>
                      <CardDescription className="text-sm">
                        {integracaoTipo.descricao}
                      </CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isAtiva}
                    onCheckedChange={(checked) => {
                      if (integracaoAtiva) {
                        toggleMutation.mutate({ id: integracaoAtiva.id, ativa: checked });
                      } else {
                        base44.entities.Integracao.create({
                          tipo: integracaoTipo.id,
                          nome: integracaoTipo.nome,
                          ativa: checked,
                          configuracao: {}
                        }).then(() => {
                          queryClient.invalidateQueries(['integracoes']);
                        });
                      }
                    }}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    {isAtiva ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-green-600 font-medium">Conectado</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-500">Desconectado</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => openConfig(integracaoAtiva || { tipo: integracaoTipo.id, nome: integracaoTipo.nome })}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Configurar
                    </Button>
                    {isAtiva && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testIntegration(integracaoAtiva)}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar {selectedIntegration?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedIntegration && integracoesDisponiveis
              .find(i => i.id === selectedIntegration.tipo)
              ?.campos.map((campo) => (
                <div key={campo}>
                  <Label className="capitalize">{campo.replace(/_/g, ' ')}</Label>
                  <Input
                    type={campo.includes('password') || campo.includes('token') ? 'password' : 'text'}
                    value={configData[campo] || ''}
                    onChange={(e) => setConfigData({ ...configData, [campo]: e.target.value })}
                    placeholder={`Digite ${campo}`}
                  />
                </div>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedIntegration.id) {
                  updateConfigMutation.mutate({
                    id: selectedIntegration.id,
                    config: configData
                  });
                } else {
                  base44.entities.Integracao.create({
                    ...selectedIntegration,
                    configuracao: configData,
                    ativa: true
                  }).then(() => {
                    queryClient.invalidateQueries(['integracoes']);
                    setConfigDialog(false);
                    toast.success('Integração configurada!');
                  });
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}