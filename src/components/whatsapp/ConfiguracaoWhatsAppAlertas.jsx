import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, MessageCircle, QrCode, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function ConfiguracaoWhatsAppAlertas() {
  const [qrCode, setQrCode] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [numeroDestino, setNumeroDestino] = useState('');
  const [intervalId, setIntervalId] = useState(null);
  const [qrCodeExpirando, setQrCodeExpirando] = useState(false);
  const queryClient = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ['config-whatsapp-alertas'],
    queryFn: async () => {
      const configs = await base44.entities.ConfiguracaoSistema.filter({ 
        chave: 'whatsapp_alertas' 
      });
      return configs[0] || null;
    }
  });

  useEffect(() => {
    if (config?.valor?.numeroDestino) {
      setNumeroDestino(config.valor.numeroDestino);
    }
  }, [config]);

  const verificarStatusMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('whatsappConnect', { 
        action: 'get_status' 
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast.success('WhatsApp conectado!');
        setQrCode(null);
        setConectando(false);
      }
    }
  });

  const conectarMutation = useMutation({
    mutationFn: async () => {
      setConectando(true);
      setQrCodeExpirando(false);
      const response = await base44.functions.invoke('whatsappConnect', { 
        action: 'generate_qr' 
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.error || data.message?.includes('não configurado') || data.message?.includes('não disponível')) {
        toast.error('Serviço WhatsApp aguardando infraestrutura externa (Baileys em VPS/Docker)');
        setConectando(false);
        return;
      }

      if (data.qr_code) {
        setQrCode(data.qr_code);
        toast.info('Escaneie o QR code no WhatsApp');
        
        if (intervalId) clearInterval(intervalId);
        
        const interval = setInterval(async () => {
          try {
            const status = await verificarStatusMutation.mutateAsync();
            if (status.connected) {
              clearInterval(interval);
              setQrCode(null);
              setConectando(false);
              setIntervalId(null);
              toast.success('WhatsApp conectado com sucesso!');
              queryClient.invalidateQueries(['config-whatsapp-alertas']);
            }
          } catch (error) {
            console.error('Erro ao verificar status:', error);
          }
        }, 3000);

        setIntervalId(interval);

        setTimeout(() => setQrCodeExpirando(true), 45000);
        setTimeout(() => {
          clearInterval(interval);
          setQrCode(null);
          setConectando(false);
          setIntervalId(null);
          toast.error('QR code expirado. Clique em "Gerar Novo QR Code"');
        }, 60000);
      } else if (data.already_connected) {
        toast.success('WhatsApp já está conectado!');
        setConectando(false);
        queryClient.invalidateQueries(['config-whatsapp-alertas']);
      }
    },
    onError: () => {
      toast.error('Serviço WhatsApp não disponível');
      setConectando(false);
    }
  });

  // Limpar intervalo ao desmontar componente
  useEffect(() => {
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalId]);

  const desconectarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('whatsappConnect', { 
        action: 'disconnect' 
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('WhatsApp desconectado');
      setQrCode(null);
      setConectando(false);
      queryClient.invalidateQueries(['config-whatsapp-alertas']);
    }
  });

  const salvarConfigMutation = useMutation({
    mutationFn: async (dados) => {
      if (config) {
        return await base44.entities.ConfiguracaoSistema.update(config.id, {
          valor: { ...config.valor, ...dados }
        });
      } else {
        return await base44.entities.ConfiguracaoSistema.create({
          chave: 'whatsapp_alertas',
          valor: dados,
          descricao: 'Configuração de alertas via WhatsApp'
        });
      }
    },
    onSuccess: () => {
      toast.success('Configuração salva');
      queryClient.invalidateQueries(['config-whatsapp-alertas']);
    }
  });

  const testarEnvioMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('enviarWhatsAppAlerta', {
        numero: numeroDestino,
        titulo: 'Teste de Alerta',
        mensagem: 'Este é um teste do sistema de alertas via WhatsApp do Construlog Construlog.',
        tipo: 'info'
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Mensagem de teste enviada!');
    },
    onError: () => {
      toast.error('Erro ao enviar mensagem de teste');
    }
  });

  const statusConexao = verificarStatusMutation.data?.connected;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-green-600" />
          WhatsApp - Alertas Automáticos
        </CardTitle>
        <CardDescription>
          Conecte seu WhatsApp para receber alertas críticos automaticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status da Conexão */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-3 h-3 rounded-full",
              statusConexao ? "bg-green-500 animate-pulse" : "bg-gray-300"
            )} />
            <div>
              <p className="font-medium text-gray-900">
                {statusConexao ? 'Conectado' : 'Desconectado'}
              </p>
              <p className="text-sm text-gray-500">
                {statusConexao 
                  ? 'WhatsApp está pronto para enviar alertas'
                  : 'Conecte o WhatsApp para ativar alertas'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => verificarStatusMutation.mutate()}
            disabled={verificarStatusMutation.isPending}
          >
            {verificarStatusMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Verificar'
            )}
          </Button>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className={cn(
            "flex flex-col items-center gap-4 p-6 bg-white border-2 rounded-lg transition-all",
            qrCodeExpirando ? "border-amber-500" : "border-green-500"
          )}>
            <QrCode className={cn(
              "w-8 h-8",
              qrCodeExpirando ? "text-amber-600" : "text-green-600"
            )} />
            <p className="text-sm font-medium text-gray-900">
              Escaneie este QR Code no WhatsApp
            </p>
            <div className="relative">
              <img 
                src={qrCode} 
                alt="QR Code WhatsApp" 
                className={cn(
                  "w-64 h-64 border-4 border-gray-200 rounded-lg transition-opacity",
                  qrCodeExpirando && "opacity-50"
                )}
              />
              {qrCodeExpirando && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium text-sm">
                    Expirando...
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Aguardando conexão...
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => conectarMutation.mutate()}
                disabled={conectarMutation.isPending}
              >
                {conectarMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    Gerar Novo QR Code
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Ações de Conexão */}
        <div className="flex gap-3">
          {!statusConexao ? (
            <Button
              onClick={() => conectarMutation.mutate()}
              disabled={conectando}
              className="flex-1"
            >
              {conectando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Conectar WhatsApp
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => desconectarMutation.mutate()}
              disabled={desconectarMutation.isPending}
              className="flex-1"
            >
              {desconectarMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Desconectar
            </Button>
          )}
        </div>

        {/* Configuração de Número */}
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label htmlFor="numeroDestino">
              Número para receber alertas
            </Label>
            <Input
              id="numeroDestino"
              placeholder="5511999999999"
              value={numeroDestino}
              onChange={(e) => setNumeroDestino(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Formato: código do país + DDD + número (somente números)
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Alertas ativos</p>
              <p className="text-sm text-gray-500">
                Obras atrasadas, contas vencidas, veículos em manutenção
              </p>
            </div>
            <Switch
              checked={config?.valor?.alertasAtivos !== false}
              onCheckedChange={(checked) => 
                salvarConfigMutation.mutate({ 
                  alertasAtivos: checked,
                  numeroDestino 
                })
              }
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => salvarConfigMutation.mutate({ numeroDestino })}
              disabled={salvarConfigMutation.isPending || !numeroDestino}
              className="flex-1"
            >
              {salvarConfigMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Salvar Número
            </Button>
            <Button
              variant="outline"
              onClick={() => testarEnvioMutation.mutate()}
              disabled={testarEnvioMutation.isPending || !statusConexao || !numeroDestino}
            >
              {testarEnvioMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <MessageCircle className="w-4 h-4 mr-2" />
              )}
              Testar
            </Button>
          </div>
        </div>

        {/* Informações */}
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div className="text-sm text-yellow-900">
              <p className="font-semibold mb-2">Infraestrutura Pendente</p>
              <p className="text-yellow-800 mb-2">
                O serviço WhatsApp (Baileys) requer deploy em VPS/Docker separado.
                Não funciona em ambiente serverless Base44.
              </p>
              <p className="text-xs text-yellow-700 font-mono bg-yellow-100 p-2 rounded">
                Ver: functions/WHATSAPP_ARCHITECTURE.md
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Após deploy do serviço:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Configure WHATSAPP_SERVICE_URL nas secrets</li>
                <li>Conecte seu WhatsApp pessoal/Business escaneando QR</li>
                <li>Configure o número que receberá os alertas</li>
                <li>Alertas críticos serão enviados automaticamente</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}