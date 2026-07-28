import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw } from "lucide-react";

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContratoVersaoHeader({ versao, obra, totalContrato, onRecalc, recalcLoading }) {
  if (!versao) return null;
  const obraNome = obra ? (obra.codigo ? `${obra.codigo} - ${obra.nome}` : obra.nome) : '—';
  const status = versao.status || 'ATIVA';
  const ativa = String(status).toLowerCase() === 'ativa';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Identidade */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 bg-blue-50 rounded-lg shrink-0">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">Contrato · Versão {versao.numero_versao ?? '—'}</h2>
              <Badge className={`border-0 capitalize ${ativa ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{status}</Badge>
            </div>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{obraNome}</p>
          </div>
        </div>

        {/* Ação */}
        <Button
          onClick={onRecalc}
          disabled={recalcLoading}
          variant="outline"
          size="sm"
          className="gap-2 w-full sm:w-auto shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${recalcLoading ? 'animate-spin' : ''}`} />
          {recalcLoading ? 'Recalculando…' : 'Recalcular'}
        </Button>
      </div>

      {/* Total */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total do Contrato</p>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums mt-1">{currency.format(totalContrato || 0)}</p>
      </div>
    </div>
  );
}
