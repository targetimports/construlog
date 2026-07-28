import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

export default function ExecuteRestoreProdModal({ open, onClose, snapshot, systemMode }) {
  const [loading, setLoading] = useState(false);
  const [aprovacao_id, setAprovacao_id] = useState('');
  const [token_plain, setToken_plain] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleExecute = async () => {
    if (!confirmed) {
      toast.error('Você deve confirmar a operação');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('executarRestoreProd', {
        snapshot_id: snapshot?.id,
        confirm: { aprovacao_id, token_plain },
        dry_run: false
      });

      if (res.data?.ok) {
        toast.success('✓ Restore em produção executado com sucesso');
        onClose?.();
        setAprovacao_id('');
        setToken_plain('');
        setConfirmed(false);
      } else {
        toast.error(res.data?.error || 'Erro na execução');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            RESTAURAR EM PRODUÇÃO
          </DialogTitle>
          <DialogDescription>
            Esta operação restaurará dados do snapshot {snapshot?.id?.substring(0, 8)}... em PRODUÇÃO.
            Requer aprovação 2-pessoas + break-glass token.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Approval ID */}
          <div>
            <label className="text-sm font-semibold block mb-1">ID da Aprovação (2-pessoas)</label>
            <Input
              placeholder="Cole o ID da OpsAprovacao aprovada"
              value={aprovacao_id}
              onChange={(e) => setAprovacao_id(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Break-glass Token */}
          <div>
            <label className="text-sm font-semibold block mb-1">Break-Glass Token</label>
            <Input
              placeholder="Cole o token de emergência (ex: A1B2-C3D4-E5F6)"
              value={token_plain}
              onChange={(e) => setToken_plain(e.target.value)}
              type="password"
              disabled={loading}
            />
          </div>

          {/* Confirmation */}
          <div className="p-3 bg-red-50 border border-red-300 rounded">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={loading}
                className="mt-1"
              />
              <span className="text-xs text-red-800">
                Entendo que esta ação restaurará dados em <strong>PRODUÇÃO</strong> e não pode ser desfeita.
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleExecute}
              disabled={loading || !confirmed || !aprovacao_id || !token_plain}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? 'Executando...' : 'RESTAURAR'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}