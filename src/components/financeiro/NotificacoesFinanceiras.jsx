import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, AlertCircle, CheckCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificacoesFinanceiras() {
  const [configuracao, setConfiguracao] = useState({
    notificar_vencimento: true,
    dias_antecedencia: 3,
    notificar_vencidas: true,
    notificar_fluxo_negativo: true,
    threshold_fluxo: 10000,
    notificar_email: true,
    notificar_sistema: true,
    frequencia: 'diaria' // diaria, semanal
  });

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: contas = [] } = useQuery({
    queryKey: ['contas-financeiras'],
    queryFn: () => base44.entities.ContaFinanceira.list()
  });

  const { data: notificacoes = [] } = useQuery({
    queryKey: ['notificacoes-financeiras', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Notificacao.filter({
        destinatario_email: user.email,
        tipo: 'alerta'
      });
    },
    enabled: !!user?.email
  });

  const salvarConfigMutation = useMutation({
    mutationFn: async (config) => {
      // Salvar nas preferências do usuário
      await base44.auth.updateMe({
        notificacoes_financeiras: config
      });
    },
    onSuccess: () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries(['user']);
    }
  });

  const marcarLidaMutation = useMutation({
    mutationFn: (id) => base44.entities.Notificacao.update(id, { lida: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notificacoes-financeiras']);
    }
  });

  // Análise de alertas ativos
  const hoje = new Date();
  const diasAntecedencia = new Date(hoje);
  diasAntecedencia.setDate(diasAntecedencia.getDate() + configuracao.dias_antecedencia);

  const contasVencendo = contas.filter(c => 
    c.status === 'pendente' &&
    new Date(c.data_vencimento) >= hoje &&
    new Date(c.data_vencimento) <= diasAntecedencia
  );

  const contasVencidas = contas.filter(c =>
    c.status === 'pendente' &&
    new Date(c.data_vencimento) < hoje
  );

  const totalReceber = contas.filter(c => c.tipo === 'receber' && c.status === 'pendente')
    .reduce((s, c) => s + (c.valor || 0), 0);
  const totalPagar = contas.filter(c => c.tipo === 'pagar' && c.status === 'pendente')
    .reduce((s, c) => s + (c.valor || 0), 0);
  const fluxo = totalReceber - totalPagar;
  const fluxoNegativo = fluxo < -configuracao.threshold_fluxo;

  const testarNotificacao = async () => {
    try {
      await base44.functions.invoke('enviarNotificacaoFinanceira', {
        tipo: 'teste',
        destinatario: user.email,
        mensagem: 'Esta é uma notificação de teste do sistema financeiro.'
      });
      toast.success('Notificação de teste enviada!');
    } catch (error) {
      toast.error('Erro ao enviar notificação: ' + error.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alertas Ativos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-medium">Vencendo em {configuracao.dias_antecedencia} dias</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">{contasVencendo.length}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Contas Vencidas</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{contasVencidas.length}</p>
              </div>
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className={fluxoNegativo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${fluxoNegativo ? 'text-red-600' : 'text-green-600'}`}>
                  Fluxo de Caixa
                </p>
                <p className={`text-2xl font-bold mt-1 ${fluxoNegativo ? 'text-red-900' : 'text-green-900'}`}>
                  {fluxo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              {fluxoNegativo ? 
                <AlertCircle className="w-10 h-10 text-red-400" /> :
                <CheckCircle className="w-10 h-10 text-green-400" />
              }
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Configurações de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Notificar Vencimentos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="vencimento">Notificar Vencimentos</Label>
                <Switch
                  id="vencimento"
                  checked={configuracao.notificar_vencimento}
                  onCheckedChange={(v) => setConfiguracao({ ...configuracao, notificar_vencimento: v })}
                />
              </div>
              {configuracao.notificar_vencimento && (
                <div>
                  <Label>Dias de antecedência</Label>
                  <Input
                    type="number"
                    value={configuracao.dias_antecedencia}
                    onChange={(e) => setConfiguracao({ ...configuracao, dias_antecedencia: parseInt(e.target.value) })}
                    className="mt-1"
                    min="1"
                    max="30"
                  />
                </div>
              )}
            </div>

            {/* Notificar Vencidas */}
            <div className="flex items-center justify-between">
              <Label htmlFor="vencidas">Notificar Contas Vencidas</Label>
              <Switch
                id="vencidas"
                checked={configuracao.notificar_vencidas}
                onCheckedChange={(v) => setConfiguracao({ ...configuracao, notificar_vencidas: v })}
              />
            </div>

            {/* Notificar Fluxo Negativo */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="fluxo">Notificar Fluxo Negativo</Label>
                <Switch
                  id="fluxo"
                  checked={configuracao.notificar_fluxo_negativo}
                  onCheckedChange={(v) => setConfiguracao({ ...configuracao, notificar_fluxo_negativo: v })}
                />
              </div>
              {configuracao.notificar_fluxo_negativo && (
                <div>
                  <Label>Threshold (R$)</Label>
                  <Input
                    type="number"
                    value={configuracao.threshold_fluxo}
                    onChange={(e) => setConfiguracao({ ...configuracao, threshold_fluxo: parseFloat(e.target.value) })}
                    className="mt-1"
                    step="1000"
                  />
                </div>
              )}
            </div>

            {/* Frequência */}
            <div>
              <Label>Frequência de Verificação</Label>
              <Select 
                value={configuracao.frequencia} 
                onValueChange={(v) => setConfiguracao({ ...configuracao, frequencia: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Canal de Notificação - Email */}
            <div className="flex items-center justify-between">
              <Label htmlFor="email">Enviar por Email</Label>
              <Switch
                id="email"
                checked={configuracao.notificar_email}
                onCheckedChange={(v) => setConfiguracao({ ...configuracao, notificar_email: v })}
              />
            </div>

            {/* Canal de Notificação - Sistema */}
            <div className="flex items-center justify-between">
              <Label htmlFor="sistema">Notificação no Sistema</Label>
              <Switch
                id="sistema"
                checked={configuracao.notificar_sistema}
                onCheckedChange={(v) => setConfiguracao({ ...configuracao, notificar_sistema: v })}
              />
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={testarNotificacao}>
              <Bell className="w-4 h-4 mr-2" />
              Testar Notificação
            </Button>
            <Button onClick={() => salvarConfigMutation.mutate(configuracao)}>
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Histórico de Notificações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {notificacoes.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Nenhuma notificação recente</p>
            ) : (
              notificacoes.slice(0, 10).map(notif => (
                <div 
                  key={notif.id}
                  className={`p-4 rounded-lg border flex items-start justify-between ${
                    notif.lida ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notif.tipo === 'alerta' ? (
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    ) : (
                      <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{notif.titulo}</p>
                      <p className="text-sm text-gray-600 mt-1">{notif.mensagem}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        {new Date(notif.created_date).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {!notif.lida && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => marcarLidaMutation.mutate(notif.id)}
                    >
                      Marcar como lida
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}