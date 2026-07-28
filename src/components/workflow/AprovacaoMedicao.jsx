import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function AprovacaoMedicao({ medicao, onClose }) {
  const [motivo, setMotivo] = useState('');
  const queryClient = useQueryClient();

  const approveM mutation = useMutation({
    mutationFn: async (status) => {
      return base44.entities.Medicao.update(medicao.id, {
        status: status,
        observacoes: status === 'cancelada' ? motivo : medicao.observacoes
      });
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['medicoes'] });
      toast.success(`Medição ${status === 'confirmada' ? 'aprovada' : 'rejeitada'}!`);
      onClose?.();
    },
    onError: (err) => toast.error(err.message)
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aprovar/Rejeitar Medição #{medicao.numero}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <p><strong>Data:</strong> {new Date(medicao.data_medicao).toLocaleDateString('pt-BR')}</p>
          <p><strong>Valor:</strong> R$ {(medicao.valor_total_realizado || 0).toLocaleString('pt-BR')}</p>
          <p><strong>Status Atual:</strong> <Badge>{medicao.status}</Badge></p>
        </div>

        {medicao.status === 'confirmada' && (
          <>
            <div>
              <label className="block text-sm font-medium mb-2">Motivo da Rejeição (se aplicável)</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows="3"
                placeholder="Explique o motivo da rejeição"
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="bg-green-600 hover:bg-green-700 flex-1"
                onClick={() => mutation.mutate('processada')}
                disabled={mutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Aprovar
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => mutation.mutate('cancelada')}
                disabled={mutation.isPending || !motivo}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Rejeitar
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={onClose}
              >
                Cancelar
              </Button>
            </div>
          </>
        )}

        {medicao.status === 'rascunho' && (
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={() => mutation.mutate('confirmada')}
            disabled={mutation.isPending}
          >
            <Clock className="w-4 h-4 mr-2" />
            Confirmar Medição
          </Button>
        )}

        {medicao.status === 'processada' && (
          <div className="text-center text-green-600 font-semibold">
            ✓ Medição aprovada e processada
          </div>
        )}
      </CardContent>
    </Card>
  );
}