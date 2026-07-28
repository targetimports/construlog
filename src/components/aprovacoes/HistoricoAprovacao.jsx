import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, X, ArrowRight, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Exibe o histórico completo de aprovações de um registro
 * Usado na página de aprovações e em detalhes de OC/SC/Pagamento
 */
export default function HistoricoAprovacao({ historico = [], nivelAtual = 1, nivelMaximo = 1, status }) {
  if (!historico || historico.length === 0) {
    return <p className="text-sm text-gray-500">Nenhum histórico disponível</p>;
  }

  const acaoConfig = {
    solicitado: { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Solicitado' },
    aprovado: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', label: 'Aprovado' },
    rejeitado: { icon: X, color: 'text-red-600', bg: 'bg-red-100', label: 'Rejeitado' },
    escalado: { icon: ArrowRight, color: 'text-amber-600', bg: 'bg-amber-100', label: 'Escalado' }
  };

  return (
    <div className="space-y-1">
      {/* Timeline header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 font-medium">Fluxo de Aprovação</span>
        <div className="flex items-center gap-1">
          {Array.from({ length: nivelMaximo }, (_, i) => (
            <React.Fragment key={i}>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                i + 1 < nivelAtual ? "bg-green-100 text-green-700" :
                i + 1 === nivelAtual && status === 'pendente' ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300" :
                i + 1 === nivelAtual && status === 'rejeitado' ? "bg-red-100 text-red-700" :
                i + 1 === nivelAtual && status === 'aprovado' ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-400"
              )}>
                N{i + 1}
              </div>
              {i < nivelMaximo - 1 && <div className="w-4 h-px bg-gray-300" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Eventos */}
      <div className="relative pl-6 space-y-3">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200" />
        {historico.map((evento, idx) => {
          const config = acaoConfig[evento.acao] || acaoConfig.solicitado;
          const Icon = config.icon;
          const dataFormatada = evento.data
            ? new Date(evento.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
            : '';

          return (
            <div key={idx} className="relative flex gap-3">
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 -ml-6 z-10", config.bg)}>
                <Icon className={cn("w-3.5 h-3.5", config.color)} />
              </div>
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn("text-xs", config.bg, config.color)}>{config.label}</Badge>
                  {evento.nivel_label && (
                    <Badge variant="outline" className="text-xs">{evento.nivel_label}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                  <User className="w-3 h-3" />
                  <span>{evento.usuario_nome || evento.usuario_email}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-400">{dataFormatada}</span>
                </div>
                {evento.comentario && (
                  <p className="text-xs text-gray-500 mt-1 italic">"{evento.comentario}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}