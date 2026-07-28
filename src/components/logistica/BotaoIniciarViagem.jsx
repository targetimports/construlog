import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PlayCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export default function BotaoIniciarViagem({ rota, onSuccess }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const iniciarMutation = useMutation({
    mutationFn: async (rotaId) => {
      const res = await base44.functions.invoke('iniciarViagemComRastreamento', {
        rota_id: rotaId
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rotas-motorista'] });
      toast.success('Viagem iniciada! GPS rastreando em tempo real.');
      if (onSuccess) onSuccess(data.rota);
    },
    onError: (err) => {
      toast.error('Erro ao iniciar viagem: ' + (err?.message || 'Tente novamente'));
    }
  });

  const handleIniciar = () => {
    if (rota.status !== 'planejada' && rota.status !== 'checklist_pendente') {
      toast.error('Rota deve estar em status "Planejada" ou "Checklist Pendente"');
      return;
    }
    iniciarMutation.mutate(rota.id);
  };

  const isVisible = rota.status === 'planejada' || rota.status === 'checklist_pendente';

  if (!isVisible) return null;

  return (
    <Button
      onClick={handleIniciar}
      disabled={iniciarMutation.isPending}
      className="w-full bg-green-600 hover:bg-green-700"
    >
      {iniciarMutation.isPending ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Iniciando...
        </>
      ) : (
        <>
          <PlayCircle className="w-4 h-4 mr-2" />
          Iniciar Viagem com GPS
        </>
      )}
    </Button>
  );
}