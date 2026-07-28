import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';

const EQUIPAMENTOS_PREDEFINIDOS = [
  'Escavadeira',
  'Trator',
  'Pá Carregadeira',
  'Retroescavadeira',
  'Caminhão',
  'Guindaste',
  'Betoneira',
  'Compactador',
  'Escavadeira Midi',
  'Rolo Compactador',
  'Motoniveladora',
  'Perfuratriz'
];

const TIPOS_MAQUINAS = [
  { value: 'escavadeira', label: 'Escavadeira' },
  { value: 'trator', label: 'Trator' },
  { value: 'pá_carregadeira', label: 'Pá Carregadeira' },
  { value: 'retroescavadeira', label: 'Retroescavadeira' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'guindaste', label: 'Guindaste' },
  { value: 'betoneira', label: 'Betoneira' },
  { value: 'compactador', label: 'Compactador' },
  { value: 'outro', label: 'Outro' }
];

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' }
];

export default function SolicitacaoMaquinaForm({ obraId, onSuccess }) {
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    tipo_maquina: '',
    equipamento_customizado: '',
    quantidade: 1,
    periodo_previsto: '',
    data_inicio: '',
    data_fim: '',
    justificativa: '',
    prioridade: 'normal'
  });
  const [mostrarInputCustomizado, setMostrarInputCustomizado] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: obra } = useQuery({
    queryKey: ['obra', obraId],
    queryFn: () => base44.entities.Obra.filter({ id: obraId }),
    enabled: !!obraId
  });

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => base44.entities.User.list()
  });

  const createMutation = useMutation({
    mutationFn: async (dados) => {
      return base44.entities.SolicitacaoMaquina.create({
        ...dados,
        obra_id: obraId,
        obra_nome: obra?.[0]?.nome,
        solicitante_email: user?.email,
        data_envio: new Date().toISOString(),
        status: 'enviado'
      });
    },
    onSuccess: async (data) => {
      // Criar notificação no sistema
      try {
        await base44.entities.Notificacao.create({
          destinatario_email: formData.responsavel_superior_email,
          tipo: 'info',
          titulo: 'Nova Solicitação de Máquina',
          mensagem: `Solicitação de ${formData.tipo_maquina} na obra ${obra?.[0]?.nome}`,
          link_acao: `/aprovacao-maquinas`,
          usuario_relacionado_email: user?.email,
          usuario_relacionado_nome: user?.full_name
        });
      } catch (e) {
        console.error('Erro ao criar notificação:', e);
      }

      // Notificar superior por email também
      try {
        await base44.functions.invoke('notificarSolicitacaoMaquina', {
          solicitacaoId: data.id,
          responsavelEmail: formData.responsavel_superior_email,
          obraNome: obra?.[0]?.nome,
          tipoMaquina: formData.tipo_maquina,
          quantidade: formData.quantidade
        });
      } catch (e) {
        console.error('Erro ao notificar:', e);
      }

      queryClient.invalidateQueries({ queryKey: ['solicitacoes-maquinas'] });
      toast.success('Solicitação enviada com sucesso!');
      setFormData({
        titulo: '',
        descricao: '',
        tipo_maquina: '',
        equipamento_customizado: '',
        quantidade: 1,
        periodo_previsto: '',
        data_inicio: '',
        data_fim: '',
        justificativa: '',
        prioridade: 'normal'
      });
      setMostrarInputCustomizado(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast.error('Erro ao enviar solicitação: ' + error.message);
    }
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEquipamentoChange = (value) => {
    if (value === 'outro') {
      setMostrarInputCustomizado(true);
      setFormData(prev => ({ ...prev, tipo_maquina: 'outro', equipamento_customizado: '' }));
    } else {
      setMostrarInputCustomizado(false);
      setFormData(prev => ({ ...prev, tipo_maquina: 'outro', equipamento_customizado: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.titulo || !formData.equipamento_customizado || !formData.responsavel_superior_email) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    const dadosEnvio = {
      ...formData,
      tipo_maquina: formData.equipamento_customizado
    };
    delete dadosEnvio.equipamento_customizado;
    
    createMutation.mutate(dadosEnvio);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nova Solicitação de Máquina</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Obra */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              <strong>Obra:</strong> {obra?.[0]?.nome}
            </p>
          </div>

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Título *
            </label>
            <Input
              value={formData.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder="Ex: Escavadeira para fundação"
              required
            />
          </div>

          {/* Equipamento */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Equipamento *
            </label>
            <Select value={formData.equipamento_customizado} onValueChange={handleEquipamentoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o equipamento..." />
              </SelectTrigger>
              <SelectContent>
                {EQUIPAMENTOS_PREDEFINIDOS.map(eq => (
                  <SelectItem key={eq} value={eq}>
                    {eq}
                  </SelectItem>
                ))}
                <SelectItem value="outro">
                  Adicionar outro
                </SelectItem>
              </SelectContent>
            </Select>
            {mostrarInputCustomizado && (
              <Input
                type="text"
                placeholder="Digite o nome do equipamento"
                value={formData.equipamento_customizado}
                onChange={(e) => setFormData(prev => ({ ...prev, equipamento_customizado: e.target.value }))}
                className="mt-2"
                autoFocus
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Quantidade *
              </label>
              <Input
                type="number"
                min="1"
                value={formData.quantidade}
                onChange={(e) => handleChange('quantidade', parseInt(e.target.value))}
                required
              />
            </div>

            {/* Prioridade */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Prioridade
              </label>
              <Select value={formData.prioridade} onValueChange={(v) => handleChange('prioridade', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Data Início */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Data de Início
              </label>
              <Input
                type="date"
                value={formData.data_inicio}
                onChange={(e) => handleChange('data_inicio', e.target.value)}
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-1">
                Data de Término
              </label>
              <Input
                type="date"
                value={formData.data_fim}
                onChange={(e) => handleChange('data_fim', e.target.value)}
              />
            </div>
          </div>

          {/* Período Previsto */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Período Previsto
            </label>
            <Input
              value={formData.periodo_previsto}
              onChange={(e) => handleChange('periodo_previsto', e.target.value)}
              placeholder="Ex: 2 semanas, 1 mês"
            />
          </div>

          {/* Responsável Superior */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Responsável para Aprovação *
            </label>
            <Select 
              value={formData.responsavel_superior_email} 
              onValueChange={(v) => handleChange('responsavel_superior_email', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o gestor..." />
              </SelectTrigger>
              <SelectContent>
                {usuarios.map(u => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.full_name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Descrição
            </label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descreva as características e especificações necessárias..."
              rows="3"
            />
          </div>

          {/* Justificativa */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Justificativa
            </label>
            <Textarea
              value={formData.justificativa}
              onChange={(e) => handleChange('justificativa', e.target.value)}
              placeholder="Explique por que essa máquina é necessária..."
              rows="3"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Solicitação
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}