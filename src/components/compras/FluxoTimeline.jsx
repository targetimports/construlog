import React from 'react';
import { CheckCircle2, Clock, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ETAPAS = [
  { id: 'requisicao',  label: 'Requisição',  short: 'Req.' },
  { id: 'cotacao',     label: 'Cotação',     short: 'Cot.' },
  { id: 'ordem',       label: 'Ordem (OC)',  short: 'OC'   },
  { id: 'recebimento', label: 'Recebimento', short: 'Rec.' },
  { id: 'financeiro',  label: 'Financeiro',  short: 'Fin.' },
];

/**
 * etapaAtual: 'requisicao' | 'cotacao' | 'ordem' | 'recebimento' | 'financeiro'
 * statusEtapaAtual: 'pendente' | 'ativo' | 'concluido' | 'cancelado'
 */
export default function FluxoTimeline({ etapaAtual = 'requisicao', statusEtapaAtual = 'ativo', compact = false }) {
  const idx = ETAPAS.findIndex(e => e.id === etapaAtual);

  return (
    <div className={cn('flex items-center', compact ? 'gap-0' : 'gap-0 w-full')}>
      {ETAPAS.map((etapa, i) => {
        const ativa = i === idx;
        const ativaConcluida = ativa && statusEtapaAtual === 'concluido';
        const concluida = i < idx || ativaConcluida;
        const futura = i > idx;
        const cancelada = ativa && statusEtapaAtual === 'cancelado';

        let IconComp = Circle;
        let iconClass = 'text-gray-300';
        let labelClass = 'text-gray-400';
        let dotClass = 'border-2 border-gray-200 bg-white';

        if (cancelada) {
          IconComp = AlertCircle;
          iconClass = 'text-red-400';
          labelClass = 'text-red-500 font-medium';
          dotClass = 'bg-red-100 border-2 border-red-300';
        } else if (concluida) {
          IconComp = CheckCircle2;
          iconClass = 'text-emerald-500';
          labelClass = 'text-emerald-700 font-medium';
          dotClass = 'bg-emerald-50 border-2 border-emerald-400';
        } else if (ativa) {
          IconComp = Clock;
          iconClass = 'text-blue-500';
          labelClass = 'text-blue-700 font-semibold';
          dotClass = 'bg-blue-50 border-2 border-blue-500 ring-2 ring-blue-200';
        }

        return (
          <React.Fragment key={etapa.id}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={cn('rounded-full flex items-center justify-center transition-all', compact ? 'w-7 h-7' : 'w-9 h-9', dotClass)}>
                <IconComp className={cn(compact ? 'w-3.5 h-3.5' : 'w-4.5 h-4.5', iconClass)} />
              </div>
              <span className={cn('text-center leading-tight', compact ? 'text-[10px] w-12' : 'text-xs w-16', labelClass)}>
                {compact ? etapa.short : etapa.label}
              </span>
            </div>
            {i < ETAPAS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mb-4', concluida ? 'bg-emerald-400' : 'bg-gray-200')} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}