import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle2, XCircle, AlertCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';

const qualidadeConfig = {
  aprovado: { label: 'Aprovado', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  reprovado: { label: 'Reprovado', color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
  parcial: { label: 'Parcial', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertCircle }
};

export default function RecebimentoCard({ recebimento }) {
  const qualidade = qualidadeConfig[recebimento.qualidade] || qualidadeConfig.aprovado;
  const QualidadeIcon = qualidade.icon;

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 hover:bg-gray-800 transition-all">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-white font-semibold text-lg">{recebimento.descricao}</h3>
            <Badge className={cn("border", qualidade.color)}>
              <QualidadeIcon className="w-3 h-3 mr-1" />
              {qualidade.label}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-3">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              <span>Recebido: {new Date(recebimento.data_recebimento).toLocaleDateString('pt-BR')}</span>
            </div>
            <span>Qtd: {recebimento.quantidade_recebida} {recebimento.unidade}</span>
            {recebimento.nota_fiscal && (
              <span>NF: {recebimento.nota_fiscal}</span>
            )}
          </div>
          {recebimento.conferido_por && (
            <p className="text-gray-500 text-sm">Conferido por: {recebimento.conferido_por}</p>
          )}
          {recebimento.observacoes && (
            <p className="text-gray-400 text-sm mt-2">{recebimento.observacoes}</p>
          )}
          {recebimento.fotos && recebimento.fotos.length > 0 && (
            <div className="flex gap-2 mt-3">
              <Camera className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 text-sm">{recebimento.fotos.length} foto(s) anexada(s)</span>
            </div>
          )}
        </div>

        {recebimento.valor_nota && (
          <div className="text-right">
            <p className="text-gray-500 text-sm">Valor Nota Fiscal</p>
            <p className="text-white text-xl font-bold">
              {recebimento.valor_nota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}