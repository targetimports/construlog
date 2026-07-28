import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Phone, Save, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormSkeleton } from '@/components/shared/Skeletons';

export default function ConfiguracaoPage() {
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [telefoneSalvo, setTelefoneSalvo] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Carregar telefone do usuário ao montar
  useEffect(() => {
    if (user?.telefone) {
      setTelefone(user.telefone);
    }
  }, [user]);

  const salvarTelefone = async () => {
    if (!telefone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    // Validação básica
    const numLimpo = telefone.replace(/\D/g, '');
    if (numLimpo.length < 10 || numLimpo.length > 15) {
      toast.error('Número inválido (mínimo 10 dígitos)');
      return;
    }

    setSalvando(true);
    try {
      await base44.auth.updateMe({
        telefone: numLimpo,
        telefone_whatsapp: `+55${numLimpo}`
      });

      setTelefoneSalvo(true);
      toast.success('Número de telefone salvo com sucesso!');
      
      setTimeout(() => setTelefoneSalvo(false), 3000);
    } catch (error) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <FormSkeleton fields={4} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-600 mt-2">Gerencie suas preferências de alertas e notificações</p>
      </div>

      {/* Card de Telefone para Alertas */}
      <Card className="border border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Número de Telefone para Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-blue-100 border-blue-300">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 text-sm">
              Adicione seu número de WhatsApp para receber alertas críticos do Supervisor IA. Os alertas serão enviados para este número automaticamente.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="telefone" className="text-gray-700">
              Número de WhatsApp (com DDD)
            </Label>
            <Input
              id="telefone"
              mask="telefone"
              type="tel"
              placeholder="11987654321"
              value={telefone}
              onChange={(e) => {
                // Permitir apenas números
                const valor = e.target.value.replace(/\D/g, '');
                setTelefone(valor);
              }}
              className="font-mono text-lg"
            />
            <p className="text-xs text-gray-500">
              Formato: DDDnúmero (ex: 11987654321 para São Paulo)
            </p>
          </div>

          {telefoneSalvo && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-700">Salvo com sucesso!</span>
            </div>
          )}

          <Button
            onClick={salvarTelefone}
            disabled={salvando}
            className="w-full bg-blue-600 hover:bg-blue-700"
            size="lg"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Número
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info sobre Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-700">
          <p>
            <strong>Alertas Críticos:</strong> Você receberá mensagens no WhatsApp quando o Supervisor IA detectar:
          </p>
          <ul className="ml-4 space-y-1 list-disc">
            <li>Contas financeiras atrasadas</li>
            <li>Desvios orçamentários acima de 25%</li>
            <li>Obras sem equipe alocada</li>
            <li>Materiais com estoque crítico</li>
          </ul>
          <p className="mt-4">
            ℹ<strong>Notificações de Sistema:</strong> Você também receberá notificações push no navegador/app quando conectado.
          </p>
          <p className="text-gray-600 italic mt-2">
            Nenhum dado será compartilhado com terceiros. Seus alertas são privados e seguros.
          </p>
        </CardContent>
      </Card>

      {/* Status Atual */}
      {user && (
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm">Status Atual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Telefone configurado:</span>
              <span className="font-semibold">
                {user.telefone ? `+55${user.telefone}` : 'Não configurado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">WhatsApp:</span>
              <span className="font-semibold">
                {user.whatsapp_connected ? 'Conectado' : 'Não conectado'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Push Notifications:</span>
              <span className="font-semibold">
                {user.push_notification_tokens?.length > 0 ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Alertas Críticos:</span>
              <span className="font-semibold">
                {user.receber_alertas_criticos ? 'Ativo' : 'Desativado'}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}