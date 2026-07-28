import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, LogOut, Send, UserPlus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function AguardandoAprovacao({ user }) {
  const [checkCount, setCheckCount] = React.useState(0);
  
  // Bypass super admin - nunca mostrar tela de aguardo
  if (user?.role && user.role !== 'user') {
    console.log('[AguardandoAprovacao] Super admin bypass');
    return null;
  }
  
  // Polling com backoff e retry para 502
  useEffect(() => {
    let pollInterval;
    let retryCount = 0;
    
    const checkApproval = async () => {
      try {
        console.log(`[AguardandoAprovacao] Poll #${checkCount}`);
        
        const snapshotRes = await base44.functions.invoke('getUserApprovalSnapshot', {});
        const snapshot = snapshotRes?.data?.snapshot;
        
        console.log('[SNAPSHOT REAL]', snapshot);
        
        // Critério: status='ativo' OU status_acesso='aprovado'
        const isApproved = snapshot?.status === 'ativo' || snapshot?.status_acesso === 'aprovado';
        
        if (isApproved) {
          console.log('[AguardandoAprovacao] APROVADO! Redirecionando...');
          toast.success('Sua conta foi aprovada! Redirecionando...');
          localStorage.removeItem('bootstrap_user');
          clearInterval(pollInterval);
          setTimeout(() => {
            window.location.href = '/Dashboard';
          }, 1000);
          return;
        }
        
        retryCount = 0; // Reset retry count on success
        setCheckCount(prev => prev + 1);
      } catch (err) {
        // Retry para 502/503 com backoff
        if ((err?.response?.status === 502 || err?.response?.status === 503) && retryCount < 2) {
          retryCount++;
          console.warn(`[AguardandoAprovacao] 502/503, retry ${retryCount}/2 em ${Math.pow(2, retryCount) * 1000}ms`);
          const delay = Math.pow(2, retryCount) * 1000;
          setTimeout(checkApproval, delay);
          return;
        }
        console.log('[AguardandoAprovacao] Aguardando aprovação...');
      }
    };
    
    // Primeira verificação imediata
    checkApproval();
    
    // Depois a cada 4 segundos
    pollInterval = setInterval(checkApproval, 4000);
    
    return () => clearInterval(pollInterval);
  }, []);
  // Sempre mostrar formulário se faltar qualquer informação obrigatória
  // Removido !user.empresa da validação para não obrigar o campo
  // Mostrar sempre em espera se pendente (não importa se formulário completo)
  const isPending = user?.status_acesso === 'pendente' || user?.status === 'aguardando_aprovacao';
  const isCadastroIncompleto = !user.full_name || !user.telefone || !user.cargo;
  const [showForm, setShowForm] = useState(isCadastroIncompleto && !isPending);
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    telefone: user.telefone || '',
    cargo: user.cargo || '',
    empresa: user.empresa || '',
    observacoes: user.observacoes || ''
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe({ 
      ...data, 
      status_acesso: 'pendente',
      perfil_acesso: 'programador'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Informações enviadas com sucesso! Aguarde aprovação do administrador.');
      setShowForm(false);
      // Recarregar página para validar novas permissões
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (err) => {
      toast.error('Erro ao enviar informações: ' + err.message);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.full_name.trim()) {
      toast.error('Por favor, preencha seu nome completo');
      return;
    }
    if (!formData.telefone.trim()) {
      toast.error('Por favor, preencha seu telefone');
      return;
    }
    if (!formData.cargo.trim()) {
      toast.error('Por favor, preencha seu cargo/função');
      return;
    }
    // Campo empresa removido da validação
    updateProfileMutation.mutate(formData);
  };

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  // Se pendente, mostrar tela de aguardando
  if (isPending) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-yellow-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Aguardando Aprovação
          </h1>
          
          <p className="text-gray-600 mb-6">
            Olá, <span className="font-semibold">{user?.full_name}</span>!
          </p>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              Sua conta está em análise e aguardando aprovação de um administrador. 
              Você receberá um e-mail assim que seu acesso for liberado.
            </p>
          </div>

          <div className="text-sm text-gray-600 space-y-1 text-left bg-gray-50 p-4 rounded-lg mb-6">
            <p><strong>E-mail:</strong> {user?.email}</p>
            {user?.telefone && <p><strong>Telefone:</strong> {user?.telefone}</p>}
            {user?.cargo && <p><strong>Cargo:</strong> {user?.cargo}</p>}
          </div>

          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full max-w-xs"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Formulário de cadastro incompleto
  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-10 h-10 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Complete seu Cadastro</h1>
            <p className="text-gray-600">
              Preencha as informações abaixo para enviar sua solicitação de acesso ao administrador
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Digite seu nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-gray-100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cargo">Cargo/Função *</Label>
                <select
                  id="cargo"
                  value={formData.cargo}
                  onChange={(e) => {
                    try {
                      setFormData(prev => ({ ...prev, cargo: e.target.value }));
                    } catch (err) {
                      console.error('Erro ao selecionar cargo:', err);
                    }
                  }}
                  className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-base text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50 md:text-sm"
                >
                  <option value="">Selecione seu cargo</option>
                  <option value="Engenheiro Civil">Engenheiro Civil</option>
                  <option value="Arquiteto">Arquiteto</option>
                  <option value="Mestre de Obras">Mestre de Obras</option>
                  <option value="Encarregado">Encarregado</option>
                  <option value="Gerente de Projetos">Gerente de Projetos</option>
                  <option value="Orçamentista">Orçamentista</option>
                  <option value="Comprador">Comprador</option>
                  <option value="Almoxarife">Almoxarife</option>
                  <option value="Fiscal de Obra">Fiscal de Obra</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Motorista">Motorista</option>
                  <option value="Diretor">Diretor</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>

            {/* Campo Empresa - OCULTO para novos usuários */}
            <input
              type="hidden"
              id="empresa"
              value={formData.empresa}
              onChange={(e) => setFormData({ ...formData, empresa: '' })}
            />

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações / Motivo do Acesso</Label>
              <Textarea
                id="observacoes"
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                placeholder="Descreva brevemente o motivo do seu acesso ao sistema"
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleLogout}
                className="flex-1"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={updateProfileMutation.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {updateProfileMutation.isPending ? 'Enviando...' : 'Enviar para Aprovação'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return null;
}