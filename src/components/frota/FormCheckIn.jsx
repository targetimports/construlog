import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Play, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FormCheckIn({ isOpen, onClose, onSuccess }) {
  const [veiculo_id, setVeiculo_id] = useState('');
  const [km_inicial, setKm_inicial] = useState('');
  const [destino, setDestino] = useState('');
  const [obra_id, setObra_id] = useState('');
  const queryClient = useQueryClient();

  // Buscar veículos disponíveis
  const { data: veiculos = [], isLoading: loadingVeiculos } = useQuery({
    queryKey: ['veiculos-disponiveis'],
    queryFn: async () => {
      const vecs = await base44.entities.Veiculo.filter({ status: 'DISPONÍVEL' });
      return vecs || [];
    },
    enabled: isOpen
  });

  // Buscar obras
  const { data: obras = [] } = useQuery({
    queryKey: ['obras-ativas'],
    queryFn: async () => {
      const obr = await base44.entities.Obra.filter({ status: 'ativa' });
      return obr || [];
    },
    enabled: isOpen
  });

  // Iniciar uso
  const iniciarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('iniciarUsoVeiculo', {
        veiculo_id,
        km_inicial: Number(km_inicial),
        destino: destino || undefined,
        obra_id: obra_id || undefined
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Check-in realizado! ${data.veiculo_placa}`);
      queryClient.invalidateQueries({ queryKey: ['usos-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-disponiveis'] });
      resetForm();
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao iniciar uso');
    }
  });

  const resetForm = () => {
    setVeiculo_id('');
    setKm_inicial('');
    setDestino('');
    setObra_id('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!veiculo_id || !km_inicial) {
      toast.error('Preenchha veículo e KM inicial');
      return;
    }
    iniciarMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="w-5 h-5 text-green-600" />
            Iniciar Uso do Veículo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Veículo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Veículo *
            </label>
            <select
              value={veiculo_id}
              onChange={(e) => setVeiculo_id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              disabled={loadingVeiculos}
            >
              <option value="">Selecione um veículo</option>
              {veiculos.map(v => (
                <option key={v.id} value={v.id}>
                  {v.placa} - {v.modelo}
                </option>
              ))}
            </select>
          </div>

          {/* KM Inicial */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KM Inicial *
            </label>
            <Input
              type="number"
              value={km_inicial}
              onChange={(e) => setKm_inicial(e.target.value)}
              placeholder="Ex: 1000"
              required
            />
          </div>

          {/* Obra */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Obra (opcional)
            </label>
            <select
              value={obra_id}
              onChange={(e) => setObra_id(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Selecione uma obra</option>
              {obras.map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          </div>

          {/* Destino */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Destino (opcional)
            </label>
            <Input
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              placeholder="Ex: Compra de materiais"
            />
          </div>

          {/* Avisos */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              Você é o responsável por finalizar o uso. O veículo ficará bloqueado até então.
            </p>
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={iniciarMutation.isPending || !veiculo_id || !km_inicial}
              className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
            >
              {iniciarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Iniciar Uso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}