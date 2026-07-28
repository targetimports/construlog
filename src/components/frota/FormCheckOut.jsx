import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function FormCheckOut({ isOpen, onClose, uso, onSuccess }) {
  const [km_final, setKm_final] = useState('');
  const [observacao, setObservacao] = useState('');
  const queryClient = useQueryClient();

  // Finalizar uso
  const finalizarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('finalizarUsoVeiculo', {
        uso_id: uso?.id,
        km_final: Number(km_final),
        observacao: observacao || undefined
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Check-out realizado! ${data.km_percorrido} KM percorridos`);
      queryClient.invalidateQueries({ queryKey: ['usos-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos-disponiveis'] });
      resetForm();
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao finalizar uso');
    }
  });

  const resetForm = () => {
    setKm_final('');
    setObservacao('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!km_final) {
      toast.error('Informe o KM final');
      return;
    }
    if (Number(km_final) < uso?.km_inicial) {
      toast.error('KM final não pode ser menor que KM inicial');
      return;
    }
    finalizarMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Square className="w-5 h-5 text-red-600" />
            Finalizar Uso do Veículo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mb-4 p-3 bg-blue-50 rounded-lg">
          <div>
            <p className="text-xs text-blue-600">Veículo</p>
            <p className="font-semibold text-gray-900">{uso?.veiculo_placa}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600">Motorista</p>
            <p className="font-semibold text-gray-900">{uso?.motorista_nome}</p>
          </div>
          <div>
            <p className="text-xs text-blue-600">KM Inicial</p>
            <p className="font-semibold text-gray-900">{uso?.km_inicial} KM</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* KM Final */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KM Final *
            </label>
            <Input
              type="number"
              value={km_final}
              onChange={(e) => setKm_final(e.target.value)}
              placeholder={`Mínimo: ${uso?.km_inicial}`}
              required
            />
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Abastecimento necessário, danos..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              rows={3}
            />
          </div>

          {/* Avisos */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              Ao finalizar, o veículo voltará ao status DISPONÍVEL.
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
              disabled={finalizarMutation.isPending || !km_final}
              className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
            >
              {finalizarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Finalizar Uso
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}