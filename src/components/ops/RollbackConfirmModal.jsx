import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function RollbackConfirmModal({ open, onClose, snapshotId, onSuccess }) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  const handleRollback = async () => {
    if (!dryRun && confirmText !== 'RESTORE') {
      toast.error('Digite "RESTORE" para confirmar');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('rollbackFromSnapshot', {
        snapshot_id: snapshotId,
        dry_run: dryRun,
        motivo: 'Manual rollback from ops console'
      });

      if (res.data?.ok) {
        toast.success(dryRun ? '✓ Plano de restore gerado' : '✓ Restore executado');
        onSuccess?.(res.data);
        onClose?.();
      } else {
        toast.error(res.data?.error || 'Erro no rollback');
      }
    } catch (e) {
      toast.error('Erro ao executar rollback');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            Rollback do Snapshot
          </DialogTitle>
          <DialogDescription>
            {dryRun ? 'Simular restore (sem alterações)' : 'ATENÇÃO: Isso restaurará dados!'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-yellow-50 rounded border border-yellow-200 text-sm">
            Snapshot: <span className="font-mono">{snapshotId?.substring(0, 8)}...</span>
          </div>

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Dry-run (apenas planejar)</span>
            </label>
          </div>

          {!dryRun && (
            <div>
              <label className="text-sm font-semibold mb-2 block">
                Digite "RESTORE" para confirmar:
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="RESTORE"
                className="font-mono"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              onClick={handleRollback}
              disabled={loading || (!dryRun && confirmText !== 'RESTORE')}
              variant={dryRun ? 'outline' : 'destructive'}
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {dryRun ? 'Planejar' : 'RESTORE REAL'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}