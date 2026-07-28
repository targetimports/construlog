import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function RetificarBMDialog({ open, bm, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRetificar = async () => {
    if (!bm?.id) return;

    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('retificarBM', {
        bm_id: bm.id,
        motivo_retificacao: motivo,
      });

      if (response.data.success) {
        toast.success(`Retificação criada: BM #${response.data.bm_numero}`);
        onSuccess?.(response.data.bm_retificada_id);
        setMotivo('');
        onClose?.();
      } else {
        toast.error(response.data.error || 'Erro ao retificar');
      }
    } catch (error) {
      toast.error(error.message || 'Erro na retificação');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retificar BM #{bm?.numero}</AlertDialogTitle>
          <AlertDialogDescription>
            Será criada uma nova BM com status RETIFICADA. Os itens serão copiados para edição.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">
              Motivo da Retificação
            </label>
            <Textarea
              placeholder="Descreva o motivo da retificação..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRetificar}
            disabled={isLoading}
            className="gap-2"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Retificar
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}