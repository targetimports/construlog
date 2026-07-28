import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Phone, CheckCircle2, LogOut, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';

export default function ConfiguracaoWhatsApp({ open, onOpenChange, onConectado }) {
  const [step, setStep] = useState('menu'); // menu, qr_code, confirmado
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);
  const [conectado, setConectado] = useState(false);
  const [checando, setChecando] = useState(false);

  useEffect(() => {
    if (open) {
      carregarStatus();
    }
  }, [open]);

  const carregarStatus = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      setConectado(userData.whatsapp_connected || false);
      setStep(userData.whatsapp_connected ? 'confirmado' : 'menu');
    } catch (error) {
      console.error('Erro:', error);
    }
  };

  const gerarQrCode = async () => {
    setLoading(true);
    try {
      const { data } = await base44.functions.invoke('whatsappConnect', {
        action: 'generate_qr'
      });

      if (data.success) {
        setQrCode(data.qr_code);
        setSessionId(data.session_id);
        setStep('qr_code');
        toast.success('QR Code gerado - Escaneie com WhatsApp');
        
        // Polling automático a cada 2 segundos
        const verificarConexao = setInterval(async () => {
          if (!checando) {
            setChecando(true);
            await confirmarAutenticacao(data.session_id);
            setChecando(false);
          }
        }, 2000);

        // Parar após 60 segundos
        setTimeout(() => clearInterval(verificarConexao), 60000);
      }
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmarAutenticacao = async (sid) => {
    const id = sid || sessionId;
    if (!id) return;

    try {
      const { data } = await base44.functions.invoke('whatsappConnect', {
        action: 'confirm_auth',
        session_id: id
      });

      if (data.success) {
        setConectado(true);
        setStep('confirmado');
        toast.success('WhatsApp conectado com sucesso!');
        onConectado(true);
        localStorage.setItem('whatsapp_conectado', 'true');
        await carregarStatus();
      }
    } catch (error) {
      // Silencioso durante polling
    }
  };

  const desconectar = async () => {
    setLoading(true);
    try {
      await base44.functions.invoke('whatsappConnect', {
        action: 'disconnect'
      });

      setConectado(false);
      setStep('menu');
      setQrCode(null);
      setSessionId(null);
      toast.success('WhatsApp desconectado');
      onConectado(false);
      localStorage.setItem('whatsapp_conectado', 'false');
      await carregarStatus();
    } catch (error) {
      toast.error('Erro: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
        </DialogHeader>

        {/* Menu Principal */}
        {step === 'menu' && (
          <div className="space-y-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <p className="text-sm text-blue-800">
                  Escaneie o QR Code com seu WhatsApp para receber alertas críticos do Supervisor IA.
                </p>
              </CardContent>
            </Card>

            <Button 
              onClick={gerarQrCode} 
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando QR Code...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4 mr-2" />
                  Gerar QR Code
                </>
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              Você será conectado automaticamente após escanear
            </p>
          </div>
        )}

        {/* QR Code */}
        {step === 'qr_code' && qrCode && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm font-medium mb-4 text-gray-700">Escaneie com seu WhatsApp:</p>
              <div className="bg-white p-4 rounded-lg border-2 border-gray-300 inline-block">
                <img 
                  src={qrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-56 h-56"
                />
              </div>
            </div>

            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-3">
                <div className="flex gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    Abra WhatsApp, vá em Configurações → Celular Vinculado e escaneie o código.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button 
                onClick={() => confirmarAutenticacao()}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {checando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  'Já escaneei'
                )}
              </Button>

              <Button 
                onClick={() => setStep('menu')}
                variant="ghost"
                className="flex-1"
              >
                Voltar
              </Button>
            </div>
          </div>
        )}

        {/* Confirmado */}
        {step === 'confirmado' && conectado && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-700">Conectado!</p>
              <p className="text-sm text-green-600 mt-1 font-mono">
                {user?.whatsapp_phone || 'Seu WhatsApp'}
              </p>
            </div>

            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <p className="text-xs text-green-800">
                  Alertas críticos serão enviados automaticamente para este WhatsApp.
                </p>
              </CardContent>
            </Card>

            <Button 
              onClick={desconectar}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Desconectar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}