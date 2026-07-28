import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Loader } from 'lucide-react';
import ChecklistVistoriaItems from './ChecklistVistoriaItems';
import UploadFotosVistoria from './UploadFotosVistoria';

const TIPOS_VISTORIA = [
  { value: 'SAIDA', label: '▶Saída' },
  { value: 'RETORNO', label: '◀Retorno' }
];

export default function FormVistoria({ onCancelada, obraId = null }) {
  const [step, setStep] = useState(1); // 1: básico, 2: checklist, 3: fotos
  const [formData, setFormData] = useState({
    veiculo_id: '',
    tipo: 'SAIDA',
    km: '',
    observacao: '',
    obra_id: obraId || null,
    tipo: 'SAIDA'
  });
  const [itensChecklist, setItensChecklist] = useState([]);
  const [fotos, setFotos] = useState([]);

  const queryClient = useQueryClient();
  const user = base44.auth.me();

  // Buscar veículos
  const { data: veiculos = [] } = useQuery({
    queryKey: ['veiculos-form'],
    queryFn: () => base44.entities.Veiculo.list('-updated_date', 500),
    select: (data) => data.filter((v) => v.ativo !== false)
  });

  // Buscar template de checklist padrão
  const { data: templateChecklist = [] } = useQuery({
    queryKey: ['template-checklist'],
    queryFn: async () => {
      try {
        // Tentar buscar template de configuração
        const config = await base44.entities.ConfiguracaoSistema.filter({
          chave: 'vistoria_checklist_items'
        });
        if (config.length > 0 && config[0].valor) {
          return JSON.parse(config[0].valor);
        }
      } catch (e) {
        // Usar padrão se não existir
      }

      // Template padrão
      return [
        { item_nome: 'Pneus', status: 'OK', observacao: '' },
        { item_nome: 'Óleo/Fluidos', status: 'OK', observacao: '' },
        { item_nome: 'Faróis/Lanternas', status: 'OK', observacao: '' },
        { item_nome: 'Kit de Segurança', status: 'OK', observacao: '' },
        { item_nome: 'Documentação', status: 'OK', observacao: '' },
        { item_nome: 'Avarias/Danos', status: 'OK', observacao: '' },
        { item_nome: 'Limpeza Interna', status: 'OK', observacao: '' }
      ];
    },
    onSuccess: (data) => {
      if (itensChecklist.length === 0) {
        setItensChecklist(data);
      }
    }
  });

  // Criar vistoria
  const createMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Criar vistoria
      const vistoria = await base44.entities.Vistoria.create({
        veiculo_id: data.veiculo_id,
        obra_id: data.obra_id,
        data_hora: new Date().toISOString(),
        tipo: data.tipo,
        km: parseFloat(data.km),
        responsavel_id: (await user).email,
        observacao: data.observacao
      });

      // 2. Criar itens do checklist
      for (const item of data.itens) {
        await base44.entities.VistoriaItem.create({
          vistoria_id: vistoria.id,
          item_nome: item.item_nome,
          status: item.status,
          observacao: item.observacao
        });
      }

      // 3. Criar mídia
      for (const foto of data.fotos) {
        await base44.entities.VistoriaMidia.create({
          vistoria_id: vistoria.id,
          tipo: 'FOTO',
          arquivo_url: foto.arquivo_url,
          legenda: foto.legenda
        });
      }

      return vistoria;
    },
    onSuccess: (vistoria) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      toast.success('Vistoria registrada com sucesso!');
      onCancelada?.();
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  });

  const handleProximo = () => {
    if (step === 1) {
      if (!formData.veiculo_id || !formData.km) {
        toast.error('Selecione veículo e KM');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleSalvar = () => {
    // Validações finais
    const fotosValidas = fotos.filter((f) => f.arquivo_url).length;
    if (fotosValidas < 4) {
      toast.error('Mínimo 4 fotos obrigatórias (frente, lateral, traseira, painel)');
      return;
    }

    createMutation.mutate({
      veiculo_id: formData.veiculo_id,
      obra_id: formData.obra_id,
      tipo: formData.tipo,
      km: formData.km,
      observacao: formData.observacao,
      itens: itensChecklist,
      fotos: fotos.filter((f) => f.arquivo_url)
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          onClick={onCancelada}
          variant="ghost"
          size="icon"
          className="text-gray-400"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Nova Vistoria</h1>
          <p className="text-gray-400 text-sm">Passo {step} de 3</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      {/* STEP 1: Informações Básicas */}
      {step === 1 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Veículo */}
            <div>
              <Label className="text-gray-300 text-xs font-semibold">Veículo *</Label>
              <Select
                value={formData.veiculo_id}
                onValueChange={(val) => setFormData({ ...formData, veiculo_id: val })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                  <SelectValue placeholder="Selecione um veículo" />
                </SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa} — {v.modelo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo */}
            <div>
              <Label className="text-gray-300 text-xs font-semibold">Tipo de Vistoria *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(val) => setFormData({ ...formData, tipo: val })}
              >
                <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_VISTORIA.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KM */}
            <div>
              <Label className="text-gray-300 text-xs font-semibold">Quilometragem *</Label>
              <Input
                type="number"
                value={formData.km}
                onChange={(e) => setFormData({ ...formData, km: e.target.value })}
                placeholder="12500"
                className="bg-gray-700 border-gray-600 text-white mt-1"
              />
            </div>

            {/* Observação geral */}
            <div>
              <Label className="text-gray-300 text-xs font-semibold">Observação Geral</Label>
              <Textarea
                value={formData.observacao}
                onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                placeholder="Detalhes adicionais..."
                className="bg-gray-700 border-gray-600 text-white mt-1"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Checklist */}
      {step === 2 && (
        <ChecklistVistoriaItems itens={itensChecklist} onChange={setItensChecklist} />
      )}

      {/* STEP 3: Fotos */}
      {step === 3 && (
        <UploadFotosVistoria fotos={fotos} onFotosChange={setFotos} />
      )}

      {/* Botões */}
      <div className="flex gap-3 justify-end">
        {step > 1 && (
          <Button
            onClick={() => setStep(step - 1)}
            variant="outline"
            className="border-gray-600 text-gray-300"
          >
            ← Voltar
          </Button>
        )}

        {step < 3 ? (
          <Button
            onClick={handleProximo}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            Próximo →
          </Button>
        ) : (
          <Button
            onClick={handleSalvar}
            className="bg-green-600 hover:bg-green-700 gap-2"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <Loader className="w-4 h-4 animate-spin" />}
            Salvar Vistoria
          </Button>
        )}
      </div>
    </div>
  );
}