import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ChangeRequestApprovalModal({ open, onClose, changeRequest, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [decisao, setDecisao] = useState('aprovar');
  const [motivo, setMotivo] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await base44.functions.invoke('aprovarOpsChangeRequest', {
        change_id: changeRequest?.id,
        decisao,
        motivo
      });

      if (res.data?.ok) {
        toast.success(`✓ CR ${decisao === 'aprovar' ? 'aprovado' : 'rejeitado'}`);
        setMotivo('');
        onClose();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.data?.error || 'Erro ao processar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    }
    setLoading(false);
  };

  if (!changeRequest) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar'} Change Request</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-blue-50 rounded border border-blue-200">
            <p className="text-sm font-semibold">{changeRequest.tipo}</p>
            <p className="text-xs text-gray-600">{changeRequest.descricao}</p>
          </div>

          <div>
            <Label>Decisão</Label>
            <div className="flex gap-3 mt-2">
              <Button
                type="button"
                variant={decisao === 'aprovar' ? 'default' : 'outline'}
                onClick={() => setDecisao('aprovar')}
                className="flex-1"
              >
                Aprovar ✓
              </Button>
              <Button
                type="button"
                variant={decisao === 'rejeitar' ? 'destructive' : 'outline'}
                onClick={() => setDecisao('rejeitar')}
                className="flex-1"
              >
                Rejeitar ✗
              </Button>
            </div>
          </div>

          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea
              placeholder="Motivo da decisão"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="h-20"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}