import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function SCAprovacaoModal({ open, onClose, sc }) {
  const qc = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const [acao, setAcao] = useState(null); // 'APROVADA' | 'REPROVADA'

  const mutation = useMutation({
    mutationFn: async (status) => {
      const user = await base44.auth.me();
      if (status === 'REPROVADA' && !motivo.trim()) throw new Error('Informe o motivo da reprovação');
      await base44.entities.SolicitacaoCompra.update(sc.id, {
        status,
        aprovado_por: user.email,
        aprovado_em: new Date().toISOString(),
        motivo_reprovacao: status === 'REPROVADA' ? motivo.trim() : '',
      });
    },
    onSuccess: (_, status) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-compra'] });
      toast.success(status === 'APROVADA' ? 'Solicitação aprovada!' : 'Solicitação reprovada.');
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAprovar = () => mutation.mutate('APROVADA');
  const handleReprovar = () => {
    if (!motivo.trim()) { toast.error('Informe o motivo da reprovação'); return; }
    mutation.mutate('REPROVADA');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Aprovar / Reprovar Solicitação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Você está analisando a SC de <strong>{sc?.obra_nome || '—'}</strong> com prioridade <strong>{sc?.prioridade}</strong>.
          </p>

          <div>
            <Label>Motivo da reprovação <span className="text-gray-400 font-normal">(obrigatório ao reprovar)</span></Label>
            <Textarea
              placeholder="Descreva o motivo caso vá reprovar..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              className="w-full sm:flex-1 bg-green-600 hover:bg-green-700 gap-2"
              disabled={mutation.isPending}
              onClick={handleAprovar}
            >
              <CheckCircle className="w-4 h-4" /> Aprovar
            </Button>
            <Button
              className="w-full sm:flex-1 gap-2"
              variant="destructive"
              disabled={mutation.isPending}
              onClick={handleReprovar}
            >
              <XCircle className="w-4 h-4" /> Reprovar
            </Button>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={onClose}>Cancelar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}