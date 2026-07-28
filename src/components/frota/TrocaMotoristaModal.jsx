import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function TrocaMotoristaModal({ isOpen, onClose, uso, onSuccess }) {
  const [novo_motorista_email, setNovo_motorista_email] = useState('');
  const [novo_motorista_nome, setNovo_motorista_nome] = useState('');
  const [motivo_troca, setMotivo_troca] = useState('');
  const [km_na_troca, setKm_na_troca] = useState(uso?.km_inicial?.toString() || '');
  const queryClient = useQueryClient();

  // Buscar motoristas
  const { data: motoristas = [] } = useQuery({
    queryKey: ['motoristas'],
    queryFn: async () => {
      const cols = await base44.entities.Colaborador.filter({ cargo: 'Motorista' });
      return cols || [];
    },
    enabled: isOpen
  });

  // Trocar motorista
  const trocarMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('trocarMotorista', {
        veiculo_id: uso?.veiculo_id,
        novo_motorista_email,
        novo_motorista_nome,
        motivo_troca: motivo_troca || 'Troca autorizada',
        km_na_troca: km_na_troca ? Number(km_na_troca) : undefined
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Motorista trocado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['usos-ativos'] });
      queryClient.invalidateQueries({ queryKey: ['trocas-motorista'] });
      resetForm();
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Erro ao trocar motorista');
    }
  });

  const resetForm = () => {
    setNovo_motorista_email('');
    setNovo_motorista_nome('');
    setMotivo_troca('');
    setKm_na_troca(uso?.km_inicial?.toString() || '');
  };

  const handleSelectMotorista = (motorista) => {
    setNovo_motorista_email(motorista.email);
    setNovo_motorista_nome(motorista.nome);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!novo_motorista_email) {
      toast.error('Selecione o novo motorista');
      return;
    }
    trocarMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-blue-600" />
            Trocar Motorista
          </DialogTitle>
        </DialogHeader>

        {/* Motorista Atual */}
        <div className="space-y-3 mb-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <p className="text-xs text-gray-600">Veículo</p>
            <p className="font-semibold text-gray-900">{uso?.veiculo_placa}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Motorista Atual</p>
            <p className="font-semibold text-gray-900">{uso?.motorista_nome}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Novo Motorista */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Novo Motorista *
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
              {motoristas.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMotorista(m)}
                  className={`w-full text-left px-3 py-2 rounded text-sm ${
                    novo_motorista_email === m.email
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-900 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>

          {/* KM na Troca */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              KM na Troca (opcional)
            </label>
            <Input
              type="number"
              value={km_na_troca}
              onChange={(e) => setKm_na_troca(e.target.value)}
              placeholder={`Padrão: ${uso?.km_inicial}`}
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo da Troca
            </label>
            <Input
              value={motivo_troca}
              onChange={(e) => setMotivo_troca(e.target.value)}
              placeholder="Ex: Troca de turno"
            />
          </div>

          {/* Avisos */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              O uso anterior será encerrado e um novo será iniciado automaticamente.
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
              disabled={trocarMutation.isPending || !novo_motorista_email}
              className="flex-1 gap-2 bg-blue-600 hover:bg-blue-700"
            >
              {trocarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Trocar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}