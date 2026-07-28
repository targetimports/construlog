import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bell, X, MessageCircle } from 'lucide-react';
import { usePushNotifications } from './usePushNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function NotificationPermissionPrompt() {
  const [mostrar, setMostrar] = useState(false);
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { temSuporte, pushEnabled, solicitarPermissao } = usePushNotifications();

  useEffect(() => {
    const jaVisto = sessionStorage.getItem('notif_prompt_visto');
    if (!jaVisto && temSuporte && !pushEnabled) {
      setTimeout(() => setMostrar(true), 2000);
      sessionStorage.setItem('notif_prompt_visto', 'true');
    }
  }, [temSuporte, pushEnabled]);

  const handleAceitar = async () => {
    const resultado = await solicitarPermissao();
    if (resultado) {
      setMostrar(false);
      toast.success('Notificações ativadas!');
    }
  };

  const handleWhatsApp = () => {
    setShowWhatsAppDialog(true);
  };

  const salvarWhatsApp = async () => {
    if (!telefone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    setCarregando(true);
    try {
      await base44.auth.updateMe({
        phone: telefone.trim(),
        notificacao_preferencia: 'whatsapp'
      });

      toast.success('WhatsApp configurado! Receberá alertas por mensagem');
      setShowWhatsAppDialog(false);
      setMostrar(false);
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setCarregando(false);
    }
  };

  if (!mostrar || !temSuporte) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 animate-in slide-in-from-bottom-5">
        <Card className="w-80 shadow-lg border-blue-200 bg-white">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <Bell className="w-5 h-5 text-blue-600 mt-1" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-gray-900">
                  Como receber alertas?
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Escolha seu canal preferido para alertas críticos do Supervisor IA.
                </p>
                <div className="flex flex-col gap-2 mt-3">
                  <Button
                    size="sm"
                    onClick={handleAceitar}
                    className="bg-blue-600 hover:bg-blue-700 w-full"
                  >
                    Notificação Push
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleWhatsApp}
                    className="w-full"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setMostrar(false)}
                    className="text-gray-600 w-full"
                  >
                    Agora não
                  </Button>
                </div>
              </div>
              <button
                onClick={() => setMostrar(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showWhatsAppDialog} onOpenChange={setShowWhatsAppDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              Configurar WhatsApp
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Seu número de telefone
              </label>
              <Input
                placeholder="+55 11 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-2">
                Formato: +55 (código país) DDD NÚMERO
              </p>
            </div>

            <Button
              onClick={salvarWhatsApp}
              disabled={carregando}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {carregando ? 'Salvando...' : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}