import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Loader } from 'lucide-react';

const TIPOS_VEICULO = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhonete', label: 'Caminhonete' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'outro', label: 'Outro' }
];

export default function VeiculoForm({ open, onOpenChange, veiculo = null }) {
  const [formData, setFormData] = useState({
    placa: '',
    modelo: '',
    tipo: 'carro',
    ativo: true,
    rastreador_id: ''
  });

  const queryClient = useQueryClient();

  // Preencher form se editando
  useEffect(() => {
    if (veiculo) {
      setFormData({
        placa: veiculo.placa || '',
        modelo: veiculo.modelo || '',
        tipo: veiculo.tipo || 'carro',
        ativo: veiculo.ativo !== false,
        rastreador_id: veiculo.rastreador_id || ''
      });
    } else {
      setFormData({
        placa: '',
        modelo: '',
        tipo: 'carro',
        ativo: true,
        rastreador_id: ''
      });
    }
  }, [veiculo, open]);

  // Criar — também registra/sincroniza o ativo (patrimônio) vinculado.
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const v = await base44.entities.Veiculo.create(data);
      await base44.functions.invoke('criarAtivoDeVeiculo', { veiculo_id: v.id });
      return v;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      toast.success('Veículo criado e registrado como ativo!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  // Atualizar — mantém o ativo vinculado em sincronia (cria se ainda não existir).
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.Veiculo.update(veiculo.id, data);
      await base44.functions.invoke('criarAtivoDeVeiculo', { veiculo_id: veiculo.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['ativos'] });
      toast.success('Veículo atualizado com sucesso!');
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`Erro: ${error.message}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.placa.trim()) {
      toast.error('Placa é obrigatória');
      return;
    }

    const data = {
      placa: formData.placa.toUpperCase().trim(),
      modelo: formData.modelo.trim(),
      tipo: formData.tipo,
      ativo: formData.ativo,
      rastreador_id: formData.rastreador_id.trim() || null
    };

    if (veiculo) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-800 border-gray-700 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {veiculo ? 'Editar Veículo' : 'Novo Veículo'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Placa */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Placa *</Label>
            <Input
              value={formData.placa}
              onChange={(e) => setFormData({ ...formData, placa: e.target.value })}
              placeholder="ABC-1234"
              className="bg-gray-700 border-gray-600 text-white mt-1"
              disabled={isLoading}
            />
          </div>

          {/* Modelo */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Modelo</Label>
            <Input
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              placeholder="Ford F-150"
              className="bg-gray-700 border-gray-600 text-white mt-1"
              disabled={isLoading}
            />
          </div>

          {/* Tipo */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">Tipo</Label>
            <Select
              value={formData.tipo}
              onValueChange={(val) => setFormData({ ...formData, tipo: val })}
              disabled={isLoading}
            >
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_VEICULO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rastreador ID */}
          <div>
            <Label className="text-gray-300 text-xs font-semibold">
              ID Rastreador (opcional)
            </Label>
            <Input
              value={formData.rastreador_id}
              onChange={(e) => setFormData({ ...formData, rastreador_id: e.target.value })}
              placeholder="GPS-1234"
              className="bg-gray-700 border-gray-600 text-white mt-1"
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">Para integração futura com rastreamento GPS</p>
          </div>

          {/* Ativo */}
          <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded">
            <Switch
              checked={formData.ativo}
              onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
              disabled={isLoading}
            />
            <Label className="text-gray-300 text-sm cursor-pointer">
              {formData.ativo ? '✓ Ativo' : '✗ Inativo'}
            </Label>
          </div>
        </form>

        <DialogFooter className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-600 text-gray-300"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-blue-600 hover:bg-blue-700 gap-2"
            disabled={isLoading}
          >
            {isLoading && <Loader className="w-4 h-4 animate-spin" />}
            {veiculo ? 'Atualizar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}