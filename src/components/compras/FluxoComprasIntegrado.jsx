import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle, FileText, ShoppingCart, PackageCheck } from 'lucide-react';
import { createPageUrl } from '../../utils';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const etapasFluxo = [
  { id: 'solicitacao', label: 'Solicitação', icon: FileText, color: 'blue' },
  { id: 'aprovacao', label: 'Aprovação', icon: CheckCircle, color: 'emerald' },
  { id: 'cotacao', label: 'Cotação', icon: FileText, color: 'purple' },
  { id: 'ordem', label: 'Ordem Compra', icon: ShoppingCart, color: 'amber' },
  { id: 'recebimento', label: 'Recebimento', icon: PackageCheck, color: 'green' }
];

export default function FluxoComprasIntegrado({ solicitacao }) {
  const getEtapaAtual = () => {
    if (solicitacao.status_aprovacao === 'aguardando') return 'solicitacao';
    if (solicitacao.status_aprovacao === 'recusada') return 'solicitacao';
    if (solicitacao.status_atendimento === 'em_aberto') return 'aprovacao';
    if (solicitacao.status_atendimento === 'em_cotacao') return 'cotacao';
    if (solicitacao.status_atendimento === 'em_compra') return 'ordem';
    if (solicitacao.status_atendimento === 'a_receber') return 'ordem';
    if (solicitacao.status_atendimento === 'recebido_parcial' || solicitacao.status_atendimento === 'concluido') return 'recebimento';
    return 'solicitacao';
  };

  const etapaAtual = getEtapaAtual();

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="text-white">Fluxo de Compras</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          {etapasFluxo.map((etapa, index) => {
            const Icon = etapa.icon;
            const etapaIndex = etapasFluxo.findIndex(e => e.id === etapaAtual);
            const concluida = index < etapaIndex;
            const ativa = etapa.id === etapaAtual;
            const futura = index > etapaIndex;

            return (
              <React.Fragment key={etapa.id}>
                <div className="flex-1 flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all",
                    concluida && `bg-${etapa.color}-500`,
                    ativa && `bg-${etapa.color}-500 ring-4 ring-${etapa.color}-500/30`,
                    futura && "bg-gray-800 border-2 border-gray-700"
                  )}>
                    <Icon className={cn(
                      "w-6 h-6",
                      (concluida || ativa) ? "text-white" : "text-gray-600"
                    )} />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-xs font-medium",
                      (concluida || ativa) ? "text-white" : "text-gray-600"
                    )}>
                      {etapa.label}
                    </p>
                    {concluida && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs mt-1">
                        Concluído
                      </Badge>
                    )}
                    {ativa && (
                      <Badge className={`bg-${etapa.color}-500/10 text-${etapa.color}-400 border-${etapa.color}-500/20 text-xs mt-1`}>
                        Atual
                      </Badge>
                    )}
                  </div>
                </div>
                {index < etapasFluxo.length - 1 && (
                  <ArrowRight className={cn(
                    "w-5 h-5 flex-shrink-0",
                    concluida ? "text-emerald-500" : "text-gray-700"
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}