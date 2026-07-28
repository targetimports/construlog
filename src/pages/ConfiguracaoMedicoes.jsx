import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronRight, Check, AlertCircle, Users, Settings, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import PageHeader from '../components/ui/PageHeader';

const STEPS = [
  { id: 1, title: 'Obra', icon: '', description: 'Selecione a obra' },
  { id: 2, title: 'Permissões', icon: '', description: 'Configure quem cria/edita' },
  { id: 3, title: 'Aprovadores', icon: '', description: 'Defina aprovadores' },
  { id: 4, title: 'Regras', icon: '', description: 'Configure validações' },
  { id: 5, title: 'Retenções', icon: '', description: 'Defina padrões' },
  { id: 6, title: 'Finalizar', icon: '', description: 'Revisar e ativar' }
];

export default function ConfiguracaoMedicoes() {
  const [step, setStep] = useState(1);
  const [obraId, setObraId] = useState('');
  const [config, setConfig] = useState({
    permitir_criacao: true,
    permitir_edicao: true,
    permitir_delecao: false,
    usar_sugestao_automatica: true,
    ativar_validacao_integridade: true,
    permitir_descontos: true,
    permitir_retencoes: true,
    saldo_minimo_permitido: 0,
    tipos_retencao_padrao: []
  });
  const [aprovadores, setAprovadores] = useState([]);
  const queryClient = useQueryClient();

  const { data: obras = [] } = useQuery({
    queryKey: ['obras'],
    queryFn: () => base44.entities.Obra.list()
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const { data: configExistente } = useQuery({
    queryKey: ['config-medicao', obraId],
    enabled: !!obraId,
    queryFn: () => base44.entities.ConfiguracaoMedicao.filter({ obra_id: obraId }, null, 1)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfiguracaoMedicao.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-medicao'] });
      toast.success('Configuração criada!');
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ConfiguracaoMedicao.update(configExistente[0].id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-medicao'] });
      toast.success('Configuração atualizada!');
    }
  });

  const handleSubmit = async () => {
    if (!obraId) {
      toast.error('Selecione uma obra');
      return;
    }

    const payload = {
      obra_id: obraId,
      ...config,
      aprovadores_ids: aprovadores,
      setup_completo: true,
      data_setup: new Date().toISOString()
    };

    if (configExistente && configExistente.length > 0) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const obra = obras.find(o => o.id === obraId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Setup de Medições"
        subtitle="Configure permissões, aprovadores e regras de validação"
      />

      {/* Steps Indicator */}
      <div className="flex justify-between items-center mb-8 overflow-x-auto">
        {STEPS.map((s, idx) => (
          <div key={s.id} className="flex items-center flex-1 min-w-max">
            <button
              onClick={() => setStep(s.id)}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-16 rounded-full transition-all',
                step >= s.id
                  ? 'bg-blue-500 text-white shadow-lg'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              <span className="text-2xl">{s.icon}</span>
              <span className="text-xs font-medium mt-1">{s.id}</span>
            </button>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-1 mx-2 transition-all',
                step > s.id ? 'bg-blue-500' : 'bg-gray-200'
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <Card className="min-h-96">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {STEPS[step - 1].icon} {STEPS[step - 1].title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Obra */}
          {step === 1 && (
            <div className="space-y-4">
              <Label>Selecione a Obra *</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha..." />
                </SelectTrigger>
                <SelectContent>
                  {obras.filter(o => o.status === 'em_andamento').map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {obra && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-900"><strong>Cliente:</strong> {obra.cliente}</p>
                  <p className="text-sm text-blue-900"><strong>Status:</strong> {obra.status}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Permissões */}
          {step === 2 && obraId && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Permitir criar medições</Label>
                  <Switch checked={config.permitir_criacao} onCheckedChange={(v) => setConfig({...config, permitir_criacao: v})} />
                </div>
                <p className="text-xs text-gray-600">Usuários podem criar novas medições</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Permitir editar medições</Label>
                  <Switch checked={config.permitir_edicao} onCheckedChange={(v) => setConfig({...config, permitir_edicao: v})} />
                </div>
                <p className="text-xs text-gray-600">Usuários podem modificar rascunhos</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Permitir deletar medições</Label>
                  <Switch checked={config.permitir_delecao} onCheckedChange={(v) => setConfig({...config, permitir_delecao: v})} />
                </div>
                <p className="text-xs text-gray-600">Apenas para rascunhos não aprovados</p>
              </div>
            </div>
          )}

          {/* Step 3: Aprovadores */}
          {step === 3 && obraId && (
            <div className="space-y-4">
              <Label>Selecione Aprovadores (mín. 1)</Label>
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {usuarios.filter(u => u.role === 'admin' || u.role === 'gestor').map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setAprovadores(
                        aprovadores.includes(u.email)
                          ? aprovadores.filter(a => a !== u.email)
                          : [...aprovadores, u.email]
                      );
                    }}
                    className={cn(
                      'p-3 rounded-lg border-2 transition-all text-left',
                      aprovadores.includes(u.email)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {aprovadores.includes(u.email) && <Check className="w-4 h-4 text-blue-500" />}
                      <div className="text-sm">
                        <p className="font-medium">{u.full_name}</p>
                        <p className="text-xs text-gray-600">{u.email}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <Badge variant="outline">{aprovadores.length} selecionado(s)</Badge>
            </div>
          )}

          {/* Step 4: Regras */}
          {step === 4 && obraId && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Sugestão Automática de %</Label>
                  <Switch checked={config.usar_sugestao_automatica} onCheckedChange={(v) => setConfig({...config, usar_sugestao_automatica: v})} />
                </div>
                <p className="text-xs text-gray-600">Sugerir % baseado no cronograma Gantt</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Validação de Integridade</Label>
                  <Switch checked={config.ativar_validacao_integridade} onCheckedChange={(v) => setConfig({...config, ativar_validacao_integridade: v})} />
                </div>
                <p className="text-xs text-gray-600">Verificar erros antes de salvar</p>
              </div>
              <div className="space-y-2">
                <Label>Saldo Mínimo Permitido</Label>
                <Input
                  type="number"
                  value={config.saldo_minimo_permitido}
                  onChange={(e) => setConfig({...config, saldo_minimo_permitido: Number(e.target.value)})}
                  min="0"
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-600">Alertar se saldo cair abaixo deste valor</p>
              </div>
            </div>
          )}

          {/* Step 5: Retenções */}
          {step === 5 && obraId && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Permitir Descontos</Label>
                  <Switch checked={config.permitir_descontos} onCheckedChange={(v) => setConfig({...config, permitir_descontos: v})} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Permitir Retenções</Label>
                  <Switch checked={config.permitir_retencoes} onCheckedChange={(v) => setConfig({...config, permitir_retencoes: v})} />
                </div>
              </div>
              {config.permitir_retencoes && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm font-medium text-amber-900 mb-3">Tipos Padrão de Retenção</p>
                  <div className="space-y-2 text-sm text-amber-800">
                    <p>✓ INSS</p>
                    <p>✓ ISS</p>
                    <p>✓ CSLL</p>
                    <p>✓ Retenção Técnica</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 6: Resumo */}
          {step === 6 && obraId && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Obra</span>
                  <span className="text-sm">{obra?.nome}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Aprovadores</span>
                  <Badge>{aprovadores.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Sugestão Automática</span>
                  {config.usar_sugestao_automatica ? <Check className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-orange-600" />}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">Validação</span>
                  {config.ativar_validacao_integridade ? <Check className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-orange-600" />}
                </div>
              </div>
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-900">Tudo configurado! Clique em "Ativar Setup" para finalizar.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(Math.max(1, step - 1))}
          disabled={step === 1}
        >
          ← Anterior
        </Button>
        {step < 6 ? (
          <Button onClick={() => setStep(step + 1)} className="bg-blue-600 hover:bg-blue-700">
            Próximo <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending || aprovadores.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            Ativar Setup
          </Button>
        )}
      </div>
    </div>
  );
}