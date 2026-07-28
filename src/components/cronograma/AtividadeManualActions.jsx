import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AtividadeManualModal from './AtividadeManualModal';

export default function AtividadeManualActions({ item, obraId, existingItems = [] }) {
  const [open, setOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('cronograma') || k === 'marcos-obra' || k === 'obra-kpis' || k === 'obra' || k === 'obra-resumo' || k === 'obra-detalhes');
      },
    });
  };

  const { mutate: excluir, isPending } = useMutation({
    mutationFn: () => base44.entities.CronogramaItem.delete(item.id),
    onSuccess: () => {
      invalidate();
      toast.success('Atividade excluída');
      setConfirmDelete(false);
    },
    onError: () => toast.error('Erro ao excluir'),
  });

  if (confirmDelete) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-red-600 mr-1">Excluir?</span>
        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => excluir()} disabled={isPending}>
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
        </Button>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setConfirmDelete(false)}>
          Não
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
          onClick={() => setShowMenu(v => !v)}
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[130px]">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                onClick={() => { setShowMenu(false); setOpen(true); }}
              >
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={() => { setShowMenu(false); setConfirmDelete(true); }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir
              </button>
            </div>
          </>
        )}
      </div>

      <AtividadeManualModal
        open={open}
        onClose={() => setOpen(false)}
        obraId={obraId}
        editItem={item}
        existingItems={existingItems}
      />
    </>
  );
}