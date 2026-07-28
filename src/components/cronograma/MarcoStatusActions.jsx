import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: 'Não iniciado', label: 'Não iniciado', color: 'text-gray-500' },
  { value: 'Em andamento', label: 'Em andamento', color: 'text-amber-600' },
  { value: 'Concluído',    label: 'Concluído',    color: 'text-emerald-600' },
];

export default function MarcoStatusActions({ item, obraId, canEdit = true }) {
  const [open, setOpen] = useState(false);
  const [localPercent, setLocalPercent] = useState(item.percentualConcluido ?? item.percentual_concluido ?? 0);
  const queryClient = useQueryClient();

  const currentStatus = item.status || 'Não iniciado';

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey?.[0];
        return typeof k === 'string' && (k.startsWith('cronograma') || k === 'marcos-obra' || k === 'obra-kpis' || k === 'obra' || k === 'obra-resumo' || k === 'obra-detalhes');
      },
    });
  };

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: async ({ status, percent }) => {
      const progresso = status === 'Concluído' ? 100
        : status === 'Não iniciado' ? 0
        : Math.max(1, Math.min(99, percent ?? 10));

      const payload = {
        status,
        percentualConcluido: progresso,
        ...(status === 'Concluído' ? { concluido_em: new Date().toISOString() } : {}),
        atualizado_em: new Date().toISOString(),
      };

      await base44.entities.CronogramaItem.update(item.id, payload);
      return { progresso };
    },
    onSuccess: ({ progresso }) => {
      setLocalPercent(progresso);
      invalidate();
      toast.success('Status atualizado');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao atualizar'),
  });

  if (!canEdit) {
    // Read-only badge
    const opt = STATUS_OPTIONS.find(o => o.value === currentStatus) || STATUS_OPTIONS[0];
    return <span className={cn('text-xs font-medium', opt.color)}>{opt.label}</span>;
  }

  return (
    <div className="flex items-center gap-2 relative">
      {/* Botão rápido Concluir */}
      {currentStatus !== 'Concluído' && (
        <Button
          size="sm"
          variant="ghost"
          disabled={isPending}
          onClick={() => updateStatus({ status: 'Concluído', percent: 100 })}
          className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
          title="Marcar como Concluído"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
        </Button>
      )}

      {/* Dropdown de Status */}
      <div className="relative">
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => setOpen(v => !v)}
          className="h-7 px-2 gap-1 text-xs border-gray-300 bg-white text-gray-700 hover:bg-gray-50 w-[120px] justify-between"
        >
          <span className="truncate">{currentStatus}</span>
          <ChevronDown className="w-3 h-3 shrink-0" />
        </Button>

        {open && (
          <div className="absolute right-0 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[160px]">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateStatus({ status: opt.value, percent: localPercent })}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors',
                  opt.color,
                  opt.value === currentStatus && 'bg-gray-100 font-semibold'
                )}
              >
                {opt.label}
              </button>
            ))}

            {/* Input de % para Em andamento */}
            <div className="px-3 py-2 border-t border-gray-200">
              <p className="text-xs text-gray-500 mb-1">% Progresso</p>
              <input
                type="number"
                min={0} max={100}
                value={localPercent}
                onChange={e => setLocalPercent(Number(e.target.value))}
                onBlur={() => updateStatus({ status: currentStatus, percent: localPercent })}
                className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1 text-gray-900"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clique fora fecha */}
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  );
}