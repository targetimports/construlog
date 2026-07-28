import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Mail, MessageCircle, Bell, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConfiguracaoNotificacoes() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notificacoes-preferences', user?.email],
    queryFn: () => {
      if (!user?.email) return null;
      return base44.entities.PreferenciaNotificacao.filter({
        user_email: user.email
      }).then(prefs => prefs[0] || null);
    },
    enabled: !!user?.email
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (preferences?.id) {
        return base44.entities.PreferenciaNotificacao.update(preferences.id, data);
      } else {
        return base44.entities.PreferenciaNotificacao.create({
          user_email: user.email,
          ...data
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes-preferences'] });
      toast.success('Preferências salvas com sucesso!');
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + error.message);
    }
  });

  const handleToggle = (field) => {
    const newValue = !(preferences?.[field] ?? true);
    saveMutation.mutate({ [field]: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const channels = [
    {
      id: 'email',
      name: 'Email',
      description: 'Receba notificações por e-mail',
      icon: Mail,
      field: 'email_nova_requisicao',
      enabled: true,
      status: 'Ativo'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      description: 'Receba notificações via WhatsApp',
      icon: MessageCircle,
      field: 'whatsapp_nova_requisicao',
      enabled: false,
      status: 'Em Desenvolvimento'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Preferências de Notificação</h2>
        <p className="text-gray-600 mt-1">Configure como e quando deseja receber notificações</p>
      </div>

      <div className="grid gap-4">
        {channels.map(channel => {
          const Icon = channel.icon;
          const isEnabled = channel.field ? (preferences?.[channel.field] ?? true) : channel.enabled;

          return (
            <Card key={channel.id} className={!channel.enabled ? 'opacity-60' : ''}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{channel.name}</h3>
                        {!channel.enabled && (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">
                            {channel.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{channel.description}</p>
                      
                      {channel.enabled && (
                        <div className="mt-4 space-y-2 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={isEnabled}
                              onCheckedChange={() => handleToggle(channel.field)}
                              disabled={saveMutation.isPending}
                            />
                            <span className="text-gray-700">Notificações de novas requisições</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  {channel.enabled ? (
                    <div className="text-right">
                      <Badge className={isEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {isEnabled ? 'Ativado' : 'Desativado'}
                      </Badge>
                    </div>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-600">
                      Em breve
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-blue-900">Dica</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-blue-800">
          <p>Você receberá notificações de novas requisições apenas se estiver como administrador da empresa. Outras notificações irão aparecer no Centro de Notificações do sistema.</p>
        </CardContent>
      </Card>
    </div>
  );
}